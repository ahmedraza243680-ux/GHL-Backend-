import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';

const SCHEMA_FIELDS = [
  'industry',
  'displayName',
  'systemPrompt',
  'homePageSchema',
  'aboutPageSchema',
  'servicesPageSchema',
  'contactPageSchema',
  'locationPageSchema',
  'blogPageSchema',
];

function normalizeIndustryKey(industry) {
  return String(industry ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateIndustrySchemaPayload(data, { partial = false } = {}) {
  if (!data || typeof data !== 'object') {
    throw new AppError('Request body must be a JSON object.', 400, { code: 'INVALID_BODY' });
  }

  const result = {};

  if (!partial || data.industry !== undefined) {
    const industry = normalizeIndustryKey(data.industry);
    if (!industry) {
      throw new AppError('Field `industry` is required.', 400, { code: 'INVALID_BODY' });
    }
    result.industry = industry;
  }

  if (!partial || data.displayName !== undefined) {
    const displayName = String(data.displayName ?? '').trim();
    if (!displayName) {
      throw new AppError('Field `displayName` is required.', 400, { code: 'INVALID_BODY' });
    }
    result.displayName = displayName;
  }

  for (const field of SCHEMA_FIELDS) {
    if (field === 'industry' || field === 'displayName') continue;
    if (!partial || data[field] !== undefined) {
      const value = String(data[field] ?? '').trim();
      if (!value) {
        throw new AppError(`Field \`${field}\` is required.`, 400, { code: 'INVALID_BODY' });
      }
      result[field] = value;
    }
  }

  if (data.isDefault !== undefined) {
    result.isDefault = Boolean(data.isDefault);
  }

  return result;
}

export async function getSchemaForIndustry(industry) {
  const normalized = normalizeIndustryKey(industry);

  if (normalized) {
    const match = await prisma.industrySchema.findFirst({
      where: { industry: { equals: normalized, mode: 'insensitive' } },
    });
    if (match) return match;
  }

  const fallback = await prisma.industrySchema.findFirst({
    where: { isDefault: true },
  });

  if (!fallback) {
    throw new AppError('No industry schema found.', 404, { code: 'INDUSTRY_SCHEMA_NOT_FOUND' });
  }

  return fallback;
}

export async function getAllIndustrySchemas(query = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page ?? 1), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.limit ?? 12), 10) || 12),
  );
  const search = String(query.search ?? '').trim();
  const defaultFilter = String(query.default ?? 'all').trim().toLowerCase();

  const where = {};

  if (search) {
    where.OR = [
      { industry: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (defaultFilter === 'true' || defaultFilter === 'default' || defaultFilter === 'yes') {
    where.isDefault = true;
  } else if (
    defaultFilter === 'false' ||
    defaultFilter === 'non-default' ||
    defaultFilter === 'no'
  ) {
    where.isDefault = false;
  }

  const skip = (page - 1) * limit;

  const [schemas, total] = await Promise.all([
    prisma.industrySchema.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { displayName: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.industrySchema.count({ where }),
  ]);

  return {
    schemas,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function createIndustrySchema(data) {
  const payload = validateIndustrySchemaPayload(data);

  const existing = await prisma.industrySchema.findUnique({
    where: { industry: payload.industry },
  });
  if (existing) {
    throw new AppError('An industry schema with this industry already exists.', 409, {
      code: 'INDUSTRY_SCHEMA_EXISTS',
    });
  }

  if (payload.isDefault) {
    await prisma.industrySchema.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.industrySchema.create({ data: payload });
}

export async function updateIndustrySchema(id, data) {
  const existing = await prisma.industrySchema.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Industry schema not found.', 404, { code: 'INDUSTRY_SCHEMA_NOT_FOUND' });
  }

  const payload = validateIndustrySchemaPayload(data, { partial: true });
  if (Object.keys(payload).length === 0) {
    throw new AppError('No valid fields to update.', 400, { code: 'INVALID_BODY' });
  }

  if (payload.industry && payload.industry !== existing.industry) {
    const conflict = await prisma.industrySchema.findUnique({
      where: { industry: payload.industry },
    });
    if (conflict) {
      throw new AppError('An industry schema with this industry already exists.', 409, {
        code: 'INDUSTRY_SCHEMA_EXISTS',
      });
    }
  }

  if (payload.isDefault) {
    await prisma.industrySchema.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  return prisma.industrySchema.update({
    where: { id },
    data: payload,
  });
}
