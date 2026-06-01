import { Router } from 'express';
import { runDailyPostPublisher } from '../jobs/dailyPostPublisher.js';
import { sendFailureAlert } from '../services/alert.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/** TEMPORARY: manual trigger for daily publisher — only mounted in development */
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

/** TEMPORARY: trigger failure alert email (or mock log) — only mounted in development */
router.post(
  '/trigger-failure-alert',
  asyncHandler(async (req, res) => {
    const result = await sendFailureAlert(
      'test-location-123',
      'Bergen Car Company',
      'Test failure alert from GBP Automation',
    );
    return res.json({
      success: true,
      data: { message: 'Failure alert sent.', result },
      requestId: req.requestId,
    });
  }),
);

export default router;
