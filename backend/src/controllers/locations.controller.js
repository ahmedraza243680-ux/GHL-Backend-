import { fetchGbpLocationDetails } from '../services/gbp.service.js';
import {
  deleteMediaForLocation,
  listMediaForLocation,
  uploadAndSaveMedia,
} from '../services/media.service.js';
import {
  listAllLocations,
  listLocationSummaries,
  listPendingPosts,
  updateOfferConfig,
  updateServiceAreaTowns,
} from '../services/locations.service.js';
import {
  approvePostForLocation,
  deletePostForLocation,
  getPostForLocation,
  listPostsForLocation,
  publishPostForLocation,
  rejectPostForLocation,
  updatePostForLocation,
} from '../services/posts.service.js';
import { AppError } from '../utils/AppError.js';

export async function listLocations(req, res, next) {
  try {
    const locations = await listAllLocations();
    return res.json({
      success: true,
      data: { locations },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function listLocationsSummary(req, res, next) {
  try {
    const summaries = await listLocationSummaries();
    return res.json({
      success: true,
      data: { summaries },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function listAllPendingPosts(req, res, next) {
  try {
    const posts = await listPendingPosts();
    return res.json({
      success: true,
      data: { posts, total: posts.length },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function updateLocationServiceTowns(req, res, next) {
  try {
    const { locationId } = req.params;
    if (!locationId) {
      throw new AppError('locationId is required.', 400, { code: 'INVALID_PARAMS' });
    }

    const location = await updateServiceAreaTowns(locationId, req.body?.towns);

    return res.json({
      success: true,
      data: { serviceAreaTowns: location.serviceAreaTowns },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function updateLocationOfferConfig(req, res, next) {
  try {
    const { locationId } = req.params;
    if (!locationId) {
      throw new AppError('locationId is required.', 400, { code: 'INVALID_PARAMS' });
    }

    const { couponCode, terms, redeemUrl } = req.body ?? {};
    const location = await updateOfferConfig(locationId, { couponCode, terms, redeemUrl });

    return res.json({
      success: true,
      data: {
        offerCouponCode: location.offerCouponCode,
        offerTerms: location.offerTerms,
        offerRedeemUrl: location.offerRedeemUrl,
      },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

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

    const data = await listPostsForLocation(locationId, req.query);

    return res.json({
      success: true,
      data,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function listLocationMedia(req, res, next) {
  try {
    const { locationId } = req.params;
    if (!locationId) {
      throw new AppError('locationId is required.', 400, { code: 'INVALID_PARAMS' });
    }

    const media = await listMediaForLocation(locationId);

    return res.json({
      success: true,
      data: { media },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function deleteLocationMedia(req, res, next) {
  try {
    const { locationId, mediaId } = req.params;
    if (!locationId || !mediaId) {
      throw new AppError('locationId and mediaId are required.', 400, {
        code: 'INVALID_PARAMS',
      });
    }

    const result = await deleteMediaForLocation(locationId, mediaId);

    return res.json({
      success: true,
      data: result,
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

export async function updateLocationPost(req, res, next) {
  try {
    const { locationId, postId } = req.params;
    if (!locationId || !postId) {
      throw new AppError('locationId and postId are required.', 400, { code: 'INVALID_PARAMS' });
    }

    const post = await updatePostForLocation(locationId, postId, req.body);

    return res.json({
      success: true,
      data: post,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function deleteLocationPost(req, res, next) {
  try {
    const { locationId, postId } = req.params;
    if (!locationId || !postId) {
      throw new AppError('locationId and postId are required.', 400, { code: 'INVALID_PARAMS' });
    }

    const result = await deletePostForLocation(locationId, postId);

    return res.json({
      success: true,
      data: result,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}
