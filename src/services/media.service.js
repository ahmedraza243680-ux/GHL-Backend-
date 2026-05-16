import { unlink } from 'node:fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';

const PLACEHOLDER_IMAGE_URL =
  'https://placehold.co/1200x630/png?text=GBP+Automation+Post';

const POST_TYPES = new Set(['UPDATE', 'OFFER', 'EVENT']);

function normalizePostType(postType) {
  const t = String(postType ?? '').toUpperCase();
  if (!POST_TYPES.has(t)) {
    throw new AppError('postType must be one of: UPDATE, OFFER, EVENT.', 400, {
      code: 'INVALID_POST_TYPE',
    });
  }
  return t;
}

function cloudinaryFolder(locationId, postType) {
  return `gbp-automation/${locationId}/${normalizePostType(postType)}`;
}

function ensureCloudinaryConfigured() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError('Cloudinary is not configured.', 500, { code: 'CLOUDINARY_NOT_CONFIGURED' });
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * @param {string} filePath
 * @param {string} locationId
 * @param {string} postType
 * @returns {Promise<string>} secure URL
 */
export async function uploadMedia(filePath, locationId, postType) {
  const type = normalizePostType(postType);
  const folder = cloudinaryFolder(locationId, type);

  if (env.MOCK_MODE) {
    console.info(
      JSON.stringify({
        event: 'cloudinary_upload_mock',
        locationId,
        postType: type,
        folder,
        filePath,
      }),
    );
    return PLACEHOLDER_IMAGE_URL;
  }

  ensureCloudinaryConfigured();

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'image',
    });
    return result.secure_url;
  } catch (e) {
    throw new AppError(`Cloudinary upload failed: ${e.message}`, 502, {
      code: 'CLOUDINARY_UPLOAD_ERROR',
    });
  }
}

/**
 * Picks a random image URL from Cloudinary folder (or DB fallback).
 */
export async function getMediaForPost(locationId, postType) {
  const type = normalizePostType(postType);
  const folder = cloudinaryFolder(locationId, type);

  if (env.MOCK_MODE) {
    return PLACEHOLDER_IMAGE_URL;
  }

  ensureCloudinaryConfigured();

  try {
    const { resources } = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: 100,
    });

    if (resources?.length) {
      const pick = resources[Math.floor(Math.random() * resources.length)];
      if (pick.secure_url) return pick.secure_url;
    }
  } catch (e) {
    console.warn(
      JSON.stringify({
        event: 'cloudinary_list_failed',
        folder,
        error: e?.message ?? String(e),
      }),
    );
  }

  const stored = await prisma.media.findMany({
    where: { locationId, postType: type },
    select: { url: true },
  });
  if (stored.length > 0) {
    return stored[Math.floor(Math.random() * stored.length)].url;
  }

  return PLACEHOLDER_IMAGE_URL;
}

/**
 * Persists an uploaded media URL for a location + post type.
 */
export async function saveMediaRecord(locationId, postType, url) {
  const type = normalizePostType(postType);

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { id: true },
  });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }

  return prisma.media.create({
    data: {
      locationId,
      postType: type,
      url,
    },
  });
}

/**
 * Upload file from disk, save URL to DB, remove temp file.
 */
export async function uploadAndSaveMedia(filePath, locationId, postType) {
  const url = await uploadMedia(filePath, locationId, postType);
  const record = await saveMediaRecord(locationId, postType, url);
  try {
    await unlink(filePath);
  } catch {
    // temp cleanup best-effort
  }
  return { url, media: record };
}
