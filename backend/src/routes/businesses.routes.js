import { Router } from 'express';
import { createBusiness } from '../controllers/businesses.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/', asyncHandler(createBusiness));

export default router;
