import OpenAI from 'openai';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';
import { getSchemaForIndustry } from './industrySchema.service.js';

const DEFAULT_THEME = {
  primaryColor: '#1F2937',
  secondaryColor: '#F3F4F6',
  accentColor: '#6366F1',
  heroStyle: 'dark',
  fontStyle: 'modern',
};

const HERO_STYLES = new Set(['dark', 'light']);
const FONT_STYLES = new Set(['modern', 'classic', 'friendly']);

function normalizeHexColor(value) {
  const v = String(value ?? '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v.toUpperCase()}`;
  return null;
}

function buildThemeUserPrompt(businessName, industry, city) {
  return `Generate a professional color theme for ${businessName}, a ${industry} business in ${city}.
Return ONLY valid JSON with exactly these fields:

{
"primaryColor": "hex color that represents this industry professionally",
"secondaryColor": "lighter complementary hex color for backgrounds and sections",
"accentColor": "contrasting hex color for CTA buttons and highlights",
"heroStyle": "dark or light depending on which looks better with primaryColor",
"fontStyle": "modern or classic or friendly based on industry personality"
}

Color guidelines per industry type:
HVAC heating cooling: blues and navy tones
Automotive car dealer: bold reds or dark charcoal
Restaurant food: warm oranges greens or earthy tones
Plumbing: deep blues or teals
Electrical: yellows ambers or dark charcoal
Legal law: navy dark blue or burgundy
Medical health: clean blues greens or whites
Construction: oranges browns or industrial grays
Cleaning: fresh greens or sky blues
General business: professional navy indigo or slate

Rules:
primaryColor must have good contrast with white text
secondaryColor must be light enough for dark text on top
accentColor must stand out clearly against both primary and secondary
Never generate clashing or unprofessional color combinations
Colors must feel appropriate for the specific industry
fontStyle modern for tech and automotive, classic for legal and medical, friendly for restaurants and cleaning`;
}

function validateTheme(theme) {
  if (!theme || typeof theme !== 'object') return null;

  const primaryColor = normalizeHexColor(theme.primaryColor);
  const secondaryColor = normalizeHexColor(theme.secondaryColor);
  const accentColor = normalizeHexColor(theme.accentColor);
  const heroStyle = String(theme.heroStyle ?? '').trim().toLowerCase();
  const fontStyle = String(theme.fontStyle ?? '').trim().toLowerCase();

  if (
    !primaryColor ||
    !secondaryColor ||
    !accentColor ||
    !HERO_STYLES.has(heroStyle) ||
    !FONT_STYLES.has(fontStyle)
  ) {
    return null;
  }

  return { primaryColor, secondaryColor, accentColor, heroStyle, fontStyle };
}

export async function generateSiteTheme(businessName, industry, city) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn(JSON.stringify({ event: 'site_theme_skipped', reason: 'OPENAI_API_KEY not configured' }));
    return { ...DEFAULT_THEME };
  }

  const systemPrompt =
    'You are a professional web designer who creates color themes for business websites. You understand color psychology and industry conventions. Always return valid JSON only, no extra text.';
  const userPrompt = buildThemeUserPrompt(businessName, industry, city);

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('OpenAI returned empty theme');
    }

    const parsed = JSON.parse(raw);
    const validated = validateTheme(parsed);
    if (!validated) {
      throw new Error('Theme validation failed');
    }

    return validated;
  } catch (e) {
    console.warn(
      JSON.stringify({
        event: 'site_theme_generate_failed',
        error: e?.message ?? String(e),
        businessName,
        industry,
        city,
      }),
    );
    return { ...DEFAULT_THEME };
  }
}

function slugify(...parts) {
  return parts
    .filter(Boolean)
    .join('-')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureUniqueSiteSlug(baseSlug) {
  let candidate = baseSlug;
  let suffix = 2;

  while (await prisma.generatedSite.findUnique({ where: { slug: candidate } })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function findTemplateByIndustry(industry) {
  const normalized = String(industry ?? '').trim();
  if (!normalized) {
    throw new AppError('Field `industry` is required.', 400, { code: 'INVALID_BODY' });
  }

  const byIndustry = await prisma.template.findFirst({
    where: {
      isActive: true,
      industry: { equals: normalized, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (byIndustry) return byIndustry;

  const general = await prisma.template.findFirst({
    where: {
      isActive: true,
      industry: { equals: 'general', mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (general) return general;

  const fallback = await prisma.template.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (fallback) return fallback;

  throw new AppError('No active templates found. Create at least one template.', 404, {
    code: 'TEMPLATE_NOT_FOUND',
  });
}

function validateFormData(formData) {
  if (!formData || typeof formData !== 'object') {
    throw new AppError('Request body must be a JSON object.', 400, { code: 'INVALID_BODY' });
  }

  const businessName = String(formData.businessName ?? '').trim();
  const industry = String(formData.industry ?? '').trim();
  const city = String(formData.city ?? '').trim();
  const state = String(formData.state ?? 'NJ').trim() || 'NJ';

  if (!businessName) {
    throw new AppError('Field `businessName` is required.', 400, { code: 'INVALID_BODY' });
  }
  if (!industry) {
    throw new AppError('Field `industry` is required.', 400, { code: 'INVALID_BODY' });
  }
  if (!city) {
    throw new AppError('Field `city` is required.', 400, { code: 'INVALID_BODY' });
  }

  return {
    businessName,
    industry,
    city,
    state,
    phone: formData.phone != null && formData.phone !== '' ? String(formData.phone).trim() : null,
    email: formData.email != null && formData.email !== '' ? String(formData.email).trim() : null,
    description:
      formData.description != null && formData.description !== ''
        ? String(formData.description).trim()
        : null,
  };
}

function buildPagePrompt(businessData, pageSchema, pageType, contextNote = '') {
  const {
    businessName,
    industry,
    city,
    state,
    phone,
    email,
    description,
  } = businessData;

  const details = [
    contextNote,
    `Phone: ${phone ?? 'not provided'}.`,
    email ? `Email: ${email}.` : null,
    description ? `Description: ${description}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return `Generate ${pageType} page content for ${businessName}, a ${industry} business in ${city}, ${state}. ${details} Return ONLY valid JSON matching this exact structure: ${pageSchema}. Stay within all word and character limits. Content must be specific to this business and city.`;
}

async function callOpenAiForPage(systemPrompt, userPrompt) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError('OpenAI is not configured.', 503, { code: 'OPENAI_NOT_CONFIGURED' });
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 2500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('OpenAI returned empty content');
  }

  return raw;
}

function parseJsonContent(raw) {
  return JSON.parse(raw);
}

/**
 * @param {object} businessData
 * @param {string} pageSchema - JSON schema string from IndustrySchema
 * @param {string} systemPrompt
 * @param {string} pageType - home | about | services | contact | blog | location
 * @param {string} [contextNote]
 */
export async function generatePageContent(
  businessData,
  pageSchema,
  systemPrompt,
  pageType,
  contextNote = '',
) {
  const userPrompt = buildPagePrompt(businessData, pageSchema, pageType, contextNote);

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const raw = await callOpenAiForPage(systemPrompt, userPrompt);
      return parseJsonContent(raw);
    } catch (e) {
      lastError = e;
      console.warn(
        JSON.stringify({
          event: 'page_content_generate_retry',
          pageType,
          attempt,
          error: e?.message ?? String(e),
          businessName: businessData?.businessName,
        }),
      );
    }
  }

  throw lastError ?? new Error(`Failed to generate ${pageType} page content`);
}

export async function generateSite(formData) {
  try {
    const validated = validateFormData(formData);
    const [template, schema] = await Promise.all([
      findTemplateByIndustry(validated.industry),
      getSchemaForIndustry(validated.industry),
    ]);

    const [homeResult, aboutResult, servicesResult, contactResult, blogResult, theme] =
      await Promise.all([
        generatePageContent(
          validated,
          schema.homePageSchema,
          schema.systemPrompt,
          'home',
        ),
        generatePageContent(
          validated,
          schema.aboutPageSchema,
          schema.systemPrompt,
          'about',
        ),
        generatePageContent(
          validated,
          schema.servicesPageSchema,
          schema.systemPrompt,
          'services',
        ),
        generatePageContent(
          validated,
          schema.contactPageSchema,
          schema.systemPrompt,
          'contact',
        ),
        generatePageContent(
          validated,
          schema.blogPageSchema,
          schema.systemPrompt,
          'blog',
        ),
        generateSiteTheme(validated.businessName, validated.industry, validated.city),
      ]);

    const baseSlug = slugify(validated.businessName, validated.city);
    const slug = await ensureUniqueSiteSlug(baseSlug);

    const site = await prisma.generatedSite.create({
      data: {
        businessName: validated.businessName,
        industry: validated.industry,
        city: validated.city,
        state: validated.state,
        phone: validated.phone,
        email: validated.email,
        description: validated.description,
        slug,
        templateId: template.id,
        homeContent: JSON.stringify(homeResult),
        aboutContent: JSON.stringify(aboutResult),
        servicesContent: JSON.stringify(servicesResult),
        contactContent: JSON.stringify(contactResult),
        blogContent: JSON.stringify(blogResult),
        status: 'ACTIVE',
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        accentColor: theme.accentColor,
        heroStyle: theme.heroStyle,
        fontStyle: theme.fontStyle,
      },
      include: { template: true },
    });

    console.info(
      JSON.stringify({
        event: 'site_generated',
        siteId: site.id,
        slug: site.slug,
        templateId: template.id,
        industrySchema: schema.industry,
        industry: validated.industry,
        theme,
      }),
    );

    return site;
  } catch (e) {
    if (e instanceof AppError) {
      throw e;
    }

    console.error(
      JSON.stringify({
        event: 'site_generate_failed',
        error: e?.message ?? String(e),
        businessName: formData?.businessName,
      }),
    );

    throw new AppError(e?.message ?? 'Failed to generate site.', 502, {
      code: 'SITE_GENERATION_FAILED',
    });
  }
}

export async function listGeneratedSites(query = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page ?? 1), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.limit ?? 12), 10) || 12),
  );
  const search = String(query.search ?? '').trim();
  const status = String(query.status ?? '').trim().toUpperCase();

  const where = {};

  if (search) {
    where.OR = [
      { businessName: { contains: search, mode: 'insensitive' } },
      { industry: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { state: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status && ['PENDING', 'ACTIVE', 'INACTIVE'].includes(status)) {
    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [sites, total] = await Promise.all([
    prisma.generatedSite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        template: true,
        _count: { select: { locationPages: true } },
      },
    }),
    prisma.generatedSite.count({ where }),
  ]);

  return {
    sites,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getGeneratedSiteBySlug(slug) {
  const normalized = slugify(slug);
  const site = await prisma.generatedSite.findUnique({
    where: { slug: normalized },
    include: {
      template: true,
      locationPages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!site) {
    throw new AppError('Generated site not found.', 404, { code: 'SITE_NOT_FOUND' });
  }

  return site;
}
