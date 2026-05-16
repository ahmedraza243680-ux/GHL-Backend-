import cron from 'node-cron';
import prisma from '../database/client.js';
import { publishPostForLocation } from '../services/posts.service.js';

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

export function buildDailyPostContent(businessName, categoryLabel) {
  const name = businessName.trim() || 'Our business';
  const cat = categoryLabel.trim() || 'services';
  return `Good morning from ${name}! Discover today's highlights in ${cat} — quality you can trust. Visit ${name} soon for the latest updates and special attention to your needs.`;
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

  for (const loc of locations) {
    const businessName = loc.business?.name ?? 'Business';
    const categoryLabel = inferCategoryLabel(businessName);
    const content = buildDailyPostContent(businessName, categoryLabel);

    try {
      const post = await publishPostForLocation(loc.id, {
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
          error: message,
        }),
      );

      await safeCreateAuditLog({
        action: 'DAILY_POST_JOB_FAILED',
        locationId: loc.id,
        details: {
          error: message,
          source: 'dailyPostPublisher',
        },
      });
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
