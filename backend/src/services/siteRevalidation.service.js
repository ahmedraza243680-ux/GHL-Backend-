import {
  PRODUCTION_REVALIDATE_SECRET,
  PRODUCTION_SITE_FRONTEND_URL,
} from '../config/defaults.js';
import { env } from '../config/env.js';

function frontendBaseUrl() {
  const configured = String(env.SITE_FRONTEND_URL ?? '').trim();
  return (configured || PRODUCTION_SITE_FRONTEND_URL).replace(/\/$/, '');
}

function revalidateSecret() {
  const configured = String(env.REVALIDATE_SECRET ?? '').trim();
  return configured || PRODUCTION_REVALIDATE_SECRET;
}

/** Purges the Next.js data cache for a site after backend content changes. */
export async function revalidateSiteFrontendCache(slug) {
  const secret = revalidateSecret();
  const url = `${frontendBaseUrl()}/api/revalidate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, slug }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn(
      JSON.stringify({
        event: 'frontend_revalidate_failed',
        slug,
        status: response.status,
        payload,
      }),
    );
    return { ok: false, status: response.status, payload };
  }

  console.info(JSON.stringify({ event: 'frontend_revalidate_success', slug, payload }));
  return { ok: true, payload };
}
