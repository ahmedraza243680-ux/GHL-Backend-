import { fetchGbpLocationDetails } from '../services/gbp.service.js';
import { uploadAndSaveMedia } from '../services/media.service.js';
import {
  approvePostForLocation,
  getPostForLocation,
  listPostsForLocation,
  publishPostForLocation,
  rejectPostForLocation,
} from '../services/posts.service.js';
import { AppError } from '../utils/AppError.js';

export async function getLocationGbp(req, res, next) {
  try {
    const { locationId } = req.params;
    if (!locationId) {
      throw new AppError('locationId is required.', 400, { code: 'INVALID_PARAMS' });
    }

    const profile = await fetchGbpLocationDetails(locationId);

    return res.json({
      success: true,
      data: profile,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function publishLocationPost(req, res, next) {
  try {
    const { locationId } = req.params;
    if (!locationId) {
      throw new AppError('locationId is required.', 400, { code: 'INVALID_PARAMS' });
    }

    const post = await publishPostForLocation(locationId, req.body);

    return res.status(201).json({
      success: true,
      data: post,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function approveLocationPost(req, res, next) {
  try {
    const { locationId, postId } = req.params;
    if (!locationId || !postId) {
      throw new AppError('locationId and postId are required.', 400, { code: 'INVALID_PARAMS' });
    }

    const post = await approvePostForLocation(locationId, postId);

    return res.json({
      success: true,
      data: post,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function rejectLocationPost(req, res, next) {
  try {
    const { locationId, postId } = req.params;
    if (!locationId || !postId) {
      throw new AppError('locationId and postId are required.', 400, { code: 'INVALID_PARAMS' });
    }

    const post = await rejectPostForLocation(locationId, postId);

    return res.json({
      success: true,
      data: post,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function listLocationPosts(req, res, next) {
  try {
    const { locationId } = req.params;
    if (!locationId) {
      throw new AppError('locationId is required.', 400, { code: 'INVALID_PARAMS' });
    }

    const posts = await listPostsForLocation(locationId);

    return res.json({
      success: true,
      data: { posts },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function uploadLocationMedia(req, res, next) {
  try {
    const { locationId } = req.params;
    if (!locationId) {
      throw new AppError('locationId is required.', 400, { code: 'INVALID_PARAMS' });
    }

    const filePath = req.uploadedFile?.path;
    const postType = req.parsedPostType;

    if (!filePath || !postType) {
      throw new AppError('Upload was not parsed. Ensure multipart middleware ran first.', 500, {
        code: 'UPLOAD_PARSE_ERROR',
      });
    }

    const { url, media } = await uploadAndSaveMedia(filePath, locationId, postType);

    return res.status(201).json({
      success: true,
      data: { url, media },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function getLocationPost(req, res, next) {
  try {
    const { locationId, postId } = req.params;
    if (!locationId || !postId) {
      throw new AppError('locationId and postId are required.', 400, { code: 'INVALID_PARAMS' });
    }

    const post = await getPostForLocation(locationId, postId);

    return res.json({
      success: true,
      data: post,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}
