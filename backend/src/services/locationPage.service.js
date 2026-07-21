import OpenAI from 'openai';
import prisma from '../database/client.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { getSchemaForIndustry } from './industrySchema.service.js';

const OPENAI_CONTENT_MODEL = 'gpt-4o';

const LOCATION_PAGE_SCHEMA = {
  heroHeading: 'city name included, max 10 words',
  heroSubheading: 'city and service mention, max 20 words',
  localIntro:
    '200-250 words specific to this city with local landmarks, neighborhoods, community details, and industry keywords woven in naturally',
  whyLocal:
    '150-200 words on why this business is the best choice for residents of this city, with local and industry keywords',
  serviceArea:
    '100-150 words about serving this city and nearby areas, naming specific neighborhoods and surrounding communities',
  localStats: {
    yearsServing: 'reasonable number as string e.g. 10+',
    customersServed: '200+ or 500+',
    responseTime: 'specific to industry e.g. Same-day or Within 24 hours',
  },
  process: [
    { step: 'contact step specific to this city, max 6 words', description: '40-50 words' },
    { step: 'assessment step, max 6 words', description: '40-50 words' },
    { step: 'service delivery step, max 6 words', description: '40-50 words' },
  ],
  faqs: [
    {
      question: 'Do you serve the city area question mentioning city name',
      answer: '50-60 words mentioning neighborhoods and service area',
    },
    {
      question: 'How quickly can you reach the city question',
      answer: '50-60 words with realistic response time for this industry',
    },
    {
      question: 'What industry services are available in the city question',
      answer: '50-60 words listing specific services offered in this city',
    },
  ],
  seo: {
    title: 'city + industry + business, max 60 characters',
    metaDescription: 'city + state + service keywords, max 155 characters',
  },
};

const FIELD_MIN_WORDS = {
  localIntro: 200,
  whyLocal: 150,
  serviceArea: 100,
};

const DEFAULT_LOCATION_COUNT = 6;

function slugify(...parts) {
  return parts
    .filter(Boolean)
    .join('-')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function validateLocations(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    throw new AppError('Field `locations` must be a non-empty array.', 400, {
      code: 'INVALID_BODY',
    });
  }

  return locations.map((loc, index) => {
    if (!loc || typeof loc !== 'object') {
      throw new AppError(`locations[${index}] must be an object.`, 400, { code: 'INVALID_BODY' });
    }

    const city = String(loc.city ?? '').trim();
    const county = String(loc.county ?? '').trim();
    const state = String(loc.state ?? 'NJ').trim() || 'NJ';

    if (!city) {
      throw new AppError(`locations[${index}].city is required.`, 400, { code: 'INVALID_BODY' });
    }
    if (!county) {
      throw new AppError(`locations[${index}].county is required.`, 400, { code: 'INVALID_BODY' });
    }

    return { city, county, state };
  });
}

function buildLocationSeoRequirements({ businessName, industry, city, state }) {
  return [
    ' IMPORTANT SEO REQUIREMENTS:',
    `Include city name ${city} and state ${state} naturally at least 3 times.`,
    `Include industry keyword ${industry} naturally at least 4 times.`,
    `Include business name ${businessName} naturally at least 2 times per section.`,
    `Use long tail keywords related to ${industry} services in ${city}.`,
    'Write minimum 150 words per paragraph not 60-80.',
    'Add specific details about services offered.',
    `Make content feel local and specific to ${city} ${state}.`,
    'Mention real local landmarks, neighborhoods, and community details for this city.',
    'Word counts in the schema are strict minimums — reach the lower bound of every range.',
  ].join(' ');
}

function buildLocationPagePrompt(businessData, location, site, systemPrompt) {
  const { businessName, industry, city, state, phone, email, description } = businessData;
  const targetCity = location.city;
  const targetCounty = location.county;
  const targetState = location.state;

  const details = [
    `Target city: ${targetCity}, ${targetCounty} County, ${targetState}.`,
    `Main business location: ${site.city}, ${site.state}.`,
    `Phone: ${phone ?? 'not provided'}.`,
    email ? `Email: ${email}.` : null,
    description ? `Description: ${description}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const seoRequirements = buildLocationSeoRequirements({
    businessName,
    industry,
    city: targetCity,
    state: targetState,
  });

  return [
    `Generate a detailed location landing page for ${businessName}, a ${industry} business, targeting ${targetCity}, ${targetCounty} County, ${targetState}.`,
    details,
    seoRequirements,
    'Return ONLY valid JSON matching this exact structure:',
    JSON.stringify(LOCATION_PAGE_SCHEMA),
    'For every field with a word range, treat the lower number as a strict minimum.',
    'Content must be hyper-local to the target city — reference specific neighborhoods, landmarks, and community character.',
    'Never use generic filler; write as a real local business owner who knows this city.',
    systemPrompt ? `Industry voice: ${systemPrompt}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

async function callOpenAi(systemPrompt, userPrompt, maxTokens = 4500) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError('OpenAI is not configured.', 503, { code: 'OPENAI_NOT_CONFIGURED' });
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: OPENAI_CONTENT_MODEL,
    temperature: 0.7,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a professional SEO content writer for local business location landing pages. Write natural, keyword-optimized copy specific to each city. Always return valid JSON only.',
      },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('OpenAI returned empty location page content');
  }

  return JSON.parse(raw);
}

async function expandLocationField(businessData, location, fieldName, label, currentText, minWords, maxWords) {
  const { businessName, industry } = businessData;
  const targetCity = location.city;
  const targetState = location.state;

  const userPrompt = [
    `Rewrite and expand this ${label} for ${businessName}, a ${industry} business serving ${targetCity}, ${targetState}.`,
    buildLocationSeoRequirements({ businessName, industry, city: targetCity, state: targetState }),
    `Current draft (${countWords(currentText)} words): "${currentText}"`,
    `Return ONLY valid JSON: { "${fieldName}": "${minWords}-${maxWords} words of expanded, keyword-optimized, locally specific content" }`,
    `The ${fieldName} MUST be at least ${minWords} words.`,
  ].join(' ');

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const parsed = await callOpenAi('', userPrompt, 1200);
      const text = parsed?.[fieldName];
      if (countWords(text) >= minWords) {
        return text;
      }
      if (attempt === 2) {
        return text || currentText;
      }
    } catch (e) {
      if (attempt === 2) {
        console.warn(
          JSON.stringify({
            event: 'location_field_expand_failed',
            fieldName,
            city: targetCity,
            error: e?.message ?? String(e),
            businessName,
          }),
        );
      }
    }
  }

  return currentText;
}

const EXPANSION_LABELS = {
  localIntro: 'location page local introduction',
  whyLocal: 'location page why choose us locally section',
  serviceArea: 'location page service area description',
};

async function ensureLocationPageLength(content, businessData, location) {
  const result = { ...content };

  await Promise.all(
    Object.entries(FIELD_MIN_WORDS).map(async ([fieldName, minWords]) => {
      const currentText = result[fieldName];
      if (!currentText || countWords(currentText) >= minWords) {
        return;
      }

      const maxWords = fieldName === 'localIntro' ? 250 : fieldName === 'whyLocal' ? 200 : 150;
      result[fieldName] = await expandLocationField(
        businessData,
        location,
        fieldName,
        EXPANSION_LABELS[fieldName],
        currentText,
        minWords,
        maxWords,
      );
    }),
  );

  return result;
}

function validateLocationContent(content) {
  const issues = [];
  for (const [field, minimum] of Object.entries(FIELD_MIN_WORDS)) {
    const words = countWords(content?.[field]);
    if (words > 0 && words < minimum) {
      issues.push({ field, words, minimum });
    }
  }
  return issues;
}

async function generateLocationPageContent(businessData, location, site, systemPrompt) {
  const userPrompt = buildLocationPagePrompt(businessData, location, site, systemPrompt);

  let content;
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      content = await callOpenAi(systemPrompt, userPrompt, 4500);
      break;
    } catch (e) {
      lastError = e;
      console.warn(
        JSON.stringify({
          event: 'location_page_generate_retry',
          city: location.city,
          attempt,
          error: e?.message ?? String(e),
          businessName: businessData?.businessName,
        }),
      );
    }
  }

  if (!content) {
    throw lastError ?? new Error(`Failed to generate location page for ${location.city}`);
  }

  content = await ensureLocationPageLength(content, businessData, location);

  const remaining = validateLocationContent(content);
  if (remaining.length > 0) {
    console.warn(
      JSON.stringify({
        event: 'location_page_length_below_minimum',
        city: location.city,
        issues: remaining,
        businessName: businessData?.businessName,
      }),
    );
  }

  return content;
}

/**
 * Uses AI to discover real neighborhoods and suburbs a local business would serve
 * around its primary city. Called automatically when a new site is generated.
 */
async function discoverServiceAreaLocations(city, state, industry) {
  const userPrompt = [
    `List exactly ${DEFAULT_LOCATION_COUNT} real neighborhoods, suburbs, or nearby communities`,
    `that a ${industry} business based in ${city}, ${state} would realistically serve.`,
    'Return ONLY valid JSON:',
    '{ "locations": [{ "city": "real place name", "county": "accurate county name", "state": "two-letter or full state" }] }',
    `Use genuine local place names near ${city}, ${state} — not generic labels like "North Area".`,
    `Each entry must have the correct county for that community.`,
    `Do not repeat ${city} unless it is a distinct neighborhood name separate from the city proper.`,
  ].join(' ');

  try {
    const parsed = await callOpenAi('', userPrompt, 800);
    const locations = Array.isArray(parsed?.locations) ? parsed.locations : [];
    return locations
      .map((loc) => ({
        city: String(loc?.city ?? '').trim(),
        county: String(loc?.county ?? '').trim(),
        state: String(loc?.state ?? state).trim() || state,
      }))
      .filter((loc) => loc.city && loc.county)
      .slice(0, DEFAULT_LOCATION_COUNT);
  } catch (e) {
    console.warn(
      JSON.stringify({
        event: 'discover_service_area_failed',
        city,
        state,
        error: e?.message ?? String(e),
      }),
    );
    return [];
  }
}

/**
 * Generates default neighborhood location pages for a newly created site.
 * Skips silently if the site already has location pages.
 */
export async function generateDefaultLocationPagesForSite(siteId) {
  const site = await prisma.generatedSite.findUnique({ where: { id: siteId } });
  if (!site) {
    return [];
  }

  const existingCount = await prisma.locationPage.count({ where: { siteId } });
  if (existingCount > 0) {
    return [];
  }

  const locations = await discoverServiceAreaLocations(site.city, site.state, site.industry);
  if (locations.length === 0) {
    console.warn(
      JSON.stringify({
        event: 'default_location_pages_skipped',
        siteId,
        reason: 'no_locations_discovered',
        city: site.city,
      }),
    );
    return [];
  }

  console.info(
    JSON.stringify({
      event: 'default_location_pages_start',
      siteId,
      slug: site.slug,
      count: locations.length,
      cities: locations.map((l) => l.city),
    }),
  );

  return generateLocationPages(siteId, locations);
}

export async function generateLocationPages(siteId, locations) {
  try {
    const site = await prisma.generatedSite.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new AppError('Generated site not found.', 404, { code: 'SITE_NOT_FOUND' });
    }

    const schema = await getSchemaForIndustry(site.industry);
    const validatedLocations = validateLocations(locations);
    const createdPages = [];

    for (const location of validatedLocations) {
      const pageSlug = slugify(location.city, `${location.county}-county`);

      const existing = await prisma.locationPage.findUnique({
        where: {
          siteId_slug: { siteId, slug: pageSlug },
        },
      });

      if (existing) {
        throw new AppError(
          `Location page already exists for slug "${pageSlug}".`,
          409,
          { code: 'LOCATION_PAGE_EXISTS' },
        );
      }

      const businessData = {
        businessName: site.businessName,
        industry: site.industry,
        city: location.city,
        state: location.state,
        county: location.county,
        phone: site.phone,
        email: site.email,
        description: site.description,
      };

      const generated = await generateLocationPageContent(
        businessData,
        location,
        site,
        schema.systemPrompt,
      );

      const page = await prisma.locationPage.create({
        data: {
          siteId,
          city: location.city,
          county: location.county,
          state: location.state,
          slug: pageSlug,
          content: JSON.stringify(generated),
        },
      });

      createdPages.push(page);

      console.info(
        JSON.stringify({
          event: 'location_page_generated',
          siteId,
          pageId: page.id,
          slug: page.slug,
          city: location.city,
          county: location.county,
          localIntroWords: countWords(generated?.localIntro),
          whyLocalWords: countWords(generated?.whyLocal),
          serviceAreaWords: countWords(generated?.serviceArea),
          industrySchema: schema.industry,
        }),
      );
    }

    return createdPages;
  } catch (e) {
    if (e instanceof AppError) {
      throw e;
    }

    console.error(
      JSON.stringify({
        event: 'location_pages_generate_failed',
        siteId,
        error: e?.message ?? String(e),
      }),
    );

    throw new AppError(e?.message ?? 'Failed to generate location pages.', 502, {
      code: 'LOCATION_PAGE_GENERATION_FAILED',
    });
  }
}
