import { Router } from 'express';
import { createBusiness, deleteBusiness } from '../controllers/businesses.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/', asyncHandler(createBusiness));
router.delete('/:businessId', asyncHandler(deleteBusiness));

export default router;
