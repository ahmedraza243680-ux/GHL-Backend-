import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';
import { publishLocalPostToGoogle } from './gbp.service.js';
import { updateLocationCustomFields } from './ghl.service.js';
import { getMediaForPost } from './media.service.js';

const POST_TYPES = new Set(['UPDATE', 'OFFER', 'EVENT']);

function validatePublishBody(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Request body must be a JSON object.', 400, { code: 'INVALID_BODY' });
  }
  const { type, content, mediaUrl } = body;
  if (type == null || !POST_TYPES.has(String(type).toUpperCase())) {
    throw new AppError('Field `type` must be one of: UPDATE, OFFER, EVENT.', 400, {
      code: 'INVALID_BODY',
    });
  }
  if (content == null || typeof content !== 'string' || content.trim() === '') {
    throw new AppError('Field `content` must be a non-empty string.', 400, {
      code: 'INVALID_BODY',
    });
  }
  if (mediaUrl != null && typeof mediaUrl !== 'string') {
    throw new AppError('Field `mediaUrl` must be a string when provided.', 400, {
      code: 'INVALID_BODY',
    });
  }
  return {
    type: String(type).toUpperCase(),
    content: content.trim(),
    mediaUrl: mediaUrl != null && mediaUrl !== '' ? String(mediaUrl).trim() : null,
  };
}

async function syncGhlAfterPublish(location, post) {
  try {
    await updateLocationCustomFields(
      location.ghlLocationId,
      post.postedAt ?? new Date(),
      post.status,
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        event: 'ghl_custom_fields_after_publish_failed',
        locationId: location.id,
        ghlLocationId: location.ghlLocationId,
        postId: post.id,
        error: e?.message ?? String(e),
      }),
    );
  }
}

/**
 * Publishes to GBP (unless mock) and updates GHL custom fields.
 */
async function executeExternalPublish(location, post) {
  if (!env.MOCK_MODE) {
    await publishLocalPostToGoogle(location, {
      type: post.type,
      content: post.content,
      mediaUrl: post.mediaUrl,
    });
  }
  await syncGhlAfterPublish(location, post);
}

async function getLocationOrThrow(locationId) {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }
  return location;
}

async function getPendingPostOrThrow(locationId, postId) {
  const post = await prisma.post.findFirst({
    where: { id: postId, locationId },
  });
  if (!post) {
    throw new AppError('Post not found.', 404, { code: 'POST_NOT_FOUND' });
  }
  if (post.status !== 'PENDING') {
    throw new AppError('Post is not pending approval.', 400, {
      code: 'POST_NOT_PENDING',
      details: { status: post.status },
    });
  }
  return post;
}

/**
 * Publishes a post (or queues for approval), persists Post + AuditLog, returns saved Post.
 */
export async function publishPostForLocation(locationId, body) {
  const { type, content, mediaUrl: bodyMediaUrl } = validatePublishBody(body);
  const location = await getLocationOrThrow(locationId);
  const mediaUrl = bodyMediaUrl ?? (await getMediaForPost(locationId, type));

  if (location.requiresApproval) {
    try {
      const [post] = await prisma.$transaction([
        prisma.post.create({
          data: {
            locationId,
            type,
            content,
            mediaUrl,
            status: 'PENDING',
            platform: 'google',
          },
        }),
        prisma.auditLog.create({
          data: {
            action: 'POST_PENDING_APPROVAL',
            locationId,
            details: { type, mockMode: env.MOCK_MODE },
          },
        }),
      ]);
      return post;
    } catch (e) {
      if (e?.name === 'PrismaClientKnownRequestError') {
        throw new AppError('Failed to save post.', 500, { code: 'POST_SAVE_FAILED' });
      }
      throw e;
    }
  }

  if (!env.MOCK_MODE) {
    await publishLocalPostToGoogle(location, { type, content, mediaUrl });
  }

  const now = new Date();

  try {
    const [post] = await prisma.$transaction([
      prisma.post.create({
        data: {
          locationId,
          type,
          content,
          mediaUrl,
          status: 'PUBLISHED',
          postedAt: now,
          platform: 'google',
        },
      }),
      prisma.auditLog.create({
        data: {
          action: 'POST_PUBLISHED',
          locationId,
          details: { type, mockMode: env.MOCK_MODE },
        },
      }),
    ]);

    await syncGhlAfterPublish(location, post);
    return post;
  } catch (e) {
    if (e?.name === 'PrismaClientKnownRequestError') {
      throw new AppError('Failed to save post.', 500, { code: 'POST_SAVE_FAILED' });
    }
    throw e;
  }
}

/**
 * Approves a pending post, publishes externally, and marks PUBLISHED.
 */
export async function approvePostForLocation(locationId, postId) {
  const location = await getLocationOrThrow(locationId);
  await getPendingPostOrThrow(locationId, postId);

  const now = new Date();

  const post = await prisma.$transaction(async (tx) => {
    const updated = await tx.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        postedAt: now,
      },
    });
    await tx.auditLog.create({
      data: {
        action: 'POST_APPROVED',
        locationId,
        details: { postId, mockMode: env.MOCK_MODE },
      },
    });
    return updated;
  });

  await executeExternalPublish(location, post);
  return post;
}

/**
 * Rejects a pending post without publishing externally.
 */
export async function rejectPostForLocation(locationId, postId) {
  await getLocationOrThrow(locationId);
  await getPendingPostOrThrow(locationId, postId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.post.update({
      where: { id: postId },
      data: { status: 'REJECTED' },
    });
    await tx.auditLog.create({
      data: {
        action: 'POST_REJECTED',
        locationId,
        details: { postId },
      },
    });
    return updated;
  });
}

export async function listPostsForLocation(locationId) {
  await getLocationOrThrow(locationId);

  return prisma.post.findMany({
    where: { locationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPostForLocation(locationId, postId) {
  await getLocationOrThrow(locationId);

  const post = await prisma.post.findFirst({
    where: { id: postId, locationId },
  });
  if (!post) {
    throw new AppError('Post not found.', 404, { code: 'POST_NOT_FOUND' });
  }
  return post;
}
