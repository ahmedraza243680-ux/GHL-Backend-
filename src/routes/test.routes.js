import { Router } from 'express';
import { runDailyPostPublisher } from '../jobs/dailyPostPublisher.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/** TEMPORARY: manual trigger for daily publisher — only mounted in development */
router.post(
  '/run-daily-job',
  asyncHandler(async (req, res) => {
    const data = await runDailyPostPublisher();
    return res.json({
      success: true,
      data,
      requestId: req.requestId,
    });
  }),
);

export default router;
