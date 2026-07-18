import crypto from 'node:crypto';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';
import { updateLocationSchedule } from './schedule.service.js';

function slugify(str) {
  return String(str ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function shortId(length = 10) {
  return crypto.randomBytes(16).toString('hex').slice(0, length);
}

function cleanOptional(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Creates a Business and its linked Location. GHL identifiers are auto-generated
 * (unique) when not supplied, since businesses added via the dashboard are not
 * necessarily provisioned in GoHighLevel yet. Optionally seeds the posting
 * schedule from postDays/postTime.
 */
export async function createBusinessWithLocation(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Request body must be a JSON object.', 400, { code: 'INVALID_BODY' });
  }

  const name = String(body.name ?? '').trim();
  if (!name) {
    throw new AppError('Field `name` is required.', 400, { code: 'INVALID_BODY' });
  }

  const category = cleanOptional(body.category);
  const city = cleanOptional(body.city);
  const timezone = String(body.timezone ?? '').trim() || 'America/New_York';

  const ghlAccountId =
    cleanOptional(body.ghlAccountId) || `${slugify(name) || 'business'}-${shortId()}`;
  const ghlLocationId =
    cleanOptional(body.ghlLocationId) || `loc-${slugify(name) || 'location'}-${shortId()}`;

  let business;
  let location;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: {
          name,
          category,
          ghlAccountId,
          status: 'ACTIVE',
        },
      });

      const createdLocation = await tx.location.create({
        data: {
          businessId: createdBusiness.id,
          ghlLocationId,
          city,
          timezone,
          status: 'ACTIVE',
          requiresApproval: false,
        },
      });

      return { createdBusiness, createdLocation };
    });
    business = result.createdBusiness;
    location = result.createdLocation;
  } catch (e) {
    if (e.code === 'P2002') {
      throw new AppError(
        'A business or location with this unique identifier already exists.',
        409,
        { code: 'CONFLICT', details: e.meta },
      );
    }
    throw e;
  }

  let schedule = null;
  const postDaysInput = Array.isArray(body.postDays)
    ? [...new Set(body.postDays.map((d) => String(d).trim()).filter(Boolean))]
    : [];

  if (postDaysInput.length > 0) {
    schedule = await updateLocationSchedule(location.id, {
      postsPerWeek: postDaysInput.length,
      postDays: postDaysInput,
      postTime: String(body.postTime ?? '09:00').trim() || '09:00',
      postTypes:
        Array.isArray(body.postTypes) && body.postTypes.length > 0
          ? body.postTypes
          : ['UPDATE', 'OFFER', 'VIDEO'],
      timezone,
    });
  }

  return { business, location, schedule };
}
