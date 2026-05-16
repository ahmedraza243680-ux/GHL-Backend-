import { Router } from 'express';
import {
  approveLocationPost,
  getLocationGbp,
  getLocationPost,
  listLocationPosts,
  publishLocationPost,
  rejectLocationPost,
  uploadLocationMedia,
} from '../controllers/locations.controller.js';
import { parseMediaMultipart } from '../middleware/mediaUpload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/:locationId/gbp', asyncHandler(getLocationGbp));
router.post(
  '/:locationId/media/upload',
  parseMediaMultipart,
  asyncHandler(uploadLocationMedia),
);
router.post('/:locationId/posts/publish', asyncHandler(publishLocationPost));
router.post('/:locationId/posts/:postId/approve', asyncHandler(approveLocationPost));
router.post('/:locationId/posts/:postId/reject', asyncHandler(rejectLocationPost));
router.get('/:locationId/posts/:postId', asyncHandler(getLocationPost));
router.get('/:locationId/posts', asyncHandler(listLocationPosts));

export default router;
