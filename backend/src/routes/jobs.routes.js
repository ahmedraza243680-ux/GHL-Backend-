import { Router } from 'express';
import { runDailyPostPublisher } from '../jobs/dailyPostPublisher.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/** Manual trigger for the daily publisher (available in production for the dashboard). */
router.post(
  '/run-daily-job',
  asyncHandler(async (req, res) => {
    const data = await runDailyPostPublisher({ force: true });
    return res.json({
      success: true,
      data,
      requestId: req.requestId,
    });
  }),
);

export default router;
