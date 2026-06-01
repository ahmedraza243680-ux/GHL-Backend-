import { Router } from 'express';
import {
  getLocationScheduleHandler,
  putLocationScheduleHandler,
} from '../controllers/schedule.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/:locationId/schedule', asyncHandler(getLocationScheduleHandler));
router.put('/:locationId/schedule', asyncHandler(putLocationScheduleHandler));

export default router;
