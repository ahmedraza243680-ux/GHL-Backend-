import { Router } from 'express';
import {
  getAuthUrl,
  getGoogleOAuthCallback,
  getGoogleAccounts,
  getGoogleDebugAccounts,
  postGoogleAuth,
  postRefreshToken,
} from '../controllers/auth.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/google/url', asyncHandler(getAuthUrl));
router.get('/google/accounts', asyncHandler(getGoogleAccounts));
router.get('/google/debug-accounts', asyncHandler(getGoogleDebugAccounts));
router.get('/google/callback', asyncHandler(getGoogleOAuthCallback));
router.post('/google', asyncHandler(postGoogleAuth));
router.post('/refresh/:locationId', asyncHandler(postRefreshToken));

export default router;
