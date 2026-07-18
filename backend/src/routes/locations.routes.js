import { Router } from 'express';
import {
  approveLocationPost,
  deleteLocationPost,
  getLocationGbp,
  getLocationPost,
  listAllPendingPosts,
  deleteLocationMedia,
  listLocationMedia,
  listLocationPosts,
  listLocations,
  listLocationsSummary,
  publishLocationPost,
  rejectLocationPost,
  updateLocationGoogleLocation,
  updateLocationOfferConfig,
  updateLocationPost,
  updateLocationPostLength,
  updateLocationServiceTowns,
  uploadLocationMedia,
} from '../controllers/locations.controller.js';
import { parseMediaMultipart } from '../middleware/mediaUpload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(listLocations));
router.get('/summary', asyncHandler(listLocationsSummary));
router.get('/pending-posts', asyncHandler(listAllPendingPosts));
router.get('/:locationId/gbp', asyncHandler(getLocationGbp));
router.patch('/:locationId/service-towns', asyncHandler(updateLocationServiceTowns));
router.patch('/:locationId/offer-config', asyncHandler(updateLocationOfferConfig));
router.patch('/:locationId/post-length', asyncHandler(updateLocationPostLength));
router.patch('/:locationId/google-location', asyncHandler(updateLocationGoogleLocation));
router.get('/:locationId/media', asyncHandler(listLocationMedia));
router.post(
  '/:locationId/media/upload',
  parseMediaMultipart,
  asyncHandler(uploadLocationMedia),
);
router.delete('/:locationId/media/:mediaId', asyncHandler(deleteLocationMedia));
router.post('/:locationId/posts/publish', asyncHandler(publishLocationPost));
router.post('/:locationId/posts/:postId/approve', asyncHandler(approveLocationPost));
router.post('/:locationId/posts/:postId/reject', asyncHandler(rejectLocationPost));
router.patch('/:locationId/posts/:postId', asyncHandler(updateLocationPost));
router.delete('/:locationId/posts/:postId', asyncHandler(deleteLocationPost));
router.get('/:locationId/posts/:postId', asyncHandler(getLocationPost));
router.get('/:locationId/posts', asyncHandler(listLocationPosts));

export default router;
