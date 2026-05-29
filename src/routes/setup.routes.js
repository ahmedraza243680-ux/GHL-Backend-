import { Router } from 'express';
import prisma from '../database/client.js';
import { createGHLCustomFieldsForLocation } from '../services/ghlSetup.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const SETUP_GHL_LOCATION_IDS = [
  '4diJ9Q8sTqY55I5ihUD7',
  'NDYfMNSuMjNJz3N2CjPd',
  'cFaTJXAmUqSLpoaxQ2fn',
];

router.post(
  '/ghl-fields',
  asyncHandler(async (req, res) => {
    const results = [];

    for (const ghlLocationId of SETUP_GHL_LOCATION_IDS) {
      const location = await prisma.location.findUnique({
        where: { ghlLocationId },
        select: { id: true, ghlLocationId: true },
      });

      if (!location) {
        console.warn(
          JSON.stringify({
            event: 'ghl_setup_location_skipped',
            ghlLocationId,
            reason: 'not_found_in_database',
          }),
        );
        results.push({
          ghlLocationId,
          success: false,
          skipped: true,
          error: 'Location not found in database',
        });
        continue;
      }

      try {
        const data = await createGHLCustomFieldsForLocation(ghlLocationId);
        results.push({ success: true, ...data });
      } catch (err) {
        const message = err?.message ?? String(err);
        results.push({
          ghlLocationId,
          success: false,
          error: message,
          code: err?.code,
        });
      }
    }

    return res.json({
      success: true,
      data: { results },
      requestId: req.requestId,
    });
  }),
);

export default router;
