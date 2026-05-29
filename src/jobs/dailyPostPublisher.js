import cron from 'node-cron';
import prisma from '../database/client.js';
import { RETRY_DELAYS_MS, sendFailureAlert, sleep } from '../services/alert.service.js';
import { generatePostContent } from '../services/contentGenerator.service.js';
import { publishPostForLocation } from '../services/posts.service.js';

const MAX_RETRIES = 3;

/**
 * Rough category label for post copy when no category is stored in DB.
 */
function inferCategoryLabel(businessName) {
  const n = businessName.toLowerCase();
  if (n.includes('car') || n.includes('auto') || n.includes('vehicle')) {
    return 'automotive';
  }
  if (n.includes('restaurant') || n.includes('cafe') || n.includes('dining')) {
    return 'dining';
  }
  if (n.includes('salon') || n.includes('spa') || n.includes('beauty')) {
    return 'beauty';
  }
  return 'local business';
}

async function safeCreateAuditLog(data) {
  try {
    await prisma.auditLog.create({ data });
  } catch (e) {
    console.error(
      JSON.stringify({
        event: 'daily_post_audit_log_failed',
        error: e?.message ?? String(e),
      }),
    );
  }
}

/**
 * Publish with up to 3 retries (5s between attempts). Returns post or throws last error.
 */
async function publishLocationWithRetries(locationId, payload) {
  let lastError;
  const attempts = 1 + MAX_RETRIES;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await publishPostForLocation(locationId, payload);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        console.warn(
          JSON.stringify({
            event: 'daily_post_retry',
            locationId,
            attempt,
            maxAttempts: attempts,
            error: err?.message ?? String(err),
          }),
        );
        await sleep(RETRY_DELAYS_MS);
      }
    }
  }

  throw lastError;
}

/**
 * One run: active locations → template post → publish service (respects MOCK_MODE).
 * @returns {Promise<{ locationCount: number; ok: number; failed: number; results: Array<{ locationId: string; success: boolean; postId?: string; error?: string }> }>}
 */
export async function runDailyPostPublisher() {
  const locations = await prisma.location.findMany({
    where: {
      status: 'ACTIVE',
      business: { status: 'ACTIVE' },
    },
    include: { business: true },
  });

  console.info(
    JSON.stringify({
      event: 'daily_post_job_start',
      locationCount: locations.length,
    }),
  );

  let ok = 0;
  let failed = 0;
  /** @type {Array<{ locationId: string; success: boolean; postId?: string; error?: string }>} */
  const results = [];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000,
  );

  for (const loc of locations) {
    const businessName = loc.business?.name ?? 'Business';
    const category = inferCategoryLabel(businessName);
    const content = await generatePostContent(
      businessName,
      category,
      'New Jersey',
      'UPDATE',
      dayOfYear,
    );

    try {
      const post = await publishLocationWithRetries(loc.id, {
        type: 'UPDATE',
        content,
        mediaUrl: null,
      });

      ok += 1;
      results.push({ locationId: loc.id, success: true, postId: post.id });
      await safeCreateAuditLog({
        action: 'DAILY_POST_JOB_SUCCESS',
        locationId: loc.id,
        details: {
          postId: post.id,
          source: 'dailyPostPublisher',
        },
      });

      console.info(
        JSON.stringify({
          event: 'daily_post_location_ok',
          locationId: loc.id,
          businessName,
          postId: post.id,
        }),
      );
    } catch (err) {
      failed += 1;
      const message = err?.message ?? String(err);
      results.push({ locationId: loc.id, success: false, error: message });

      console.error(
        JSON.stringify({
          event: 'daily_post_location_failed',
          locationId: loc.id,
          businessName,
          error: message,
          retriesExhausted: MAX_RETRIES,
        }),
      );

      await safeCreateAuditLog({
        action: 'DAILY_POST_JOB_FAILED',
        locationId: loc.id,
        details: {
          error: message,
          source: 'dailyPostPublisher',
          retriesExhausted: MAX_RETRIES,
        },
      });

      try {
        await sendFailureAlert(loc.id, businessName, message);
      } catch (alertErr) {
        console.error(
          JSON.stringify({
            event: 'failure_alert_send_failed',
            locationId: loc.id,
            error: alertErr?.message ?? String(alertErr),
          }),
        );
      }
    }
  }

  const summary = {
    locationCount: locations.length,
    ok,
    failed,
    results,
  };

  console.info(
    JSON.stringify({
      event: 'daily_post_job_complete',
      ok,
      failed,
    }),
  );

  return summary;
}

/** 09:00 America/New_York daily */
export function startDailyPostPublisher() {
  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        await runDailyPostPublisher();
      } catch (e) {
        console.error(
          JSON.stringify({
            event: 'daily_post_job_fatal',
            error: e?.message ?? String(e),
          }),
        );
      }
    },
    { timezone: 'America/New_York' },
  );

  console.info(
    JSON.stringify({
      event: 'daily_post_scheduler_registered',
      cron: '0 9 * * *',
      timezone: 'America/New_York',
    }),
  );
}
