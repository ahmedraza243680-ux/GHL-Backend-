/**
 * Global app config for peakwa-sites.
 *
 * Override via environment variables (recommended for Vercel/Railway):
 *   NEXT_PUBLIC_SITE_BASE_URL=https://site.peakwa.com
 *   NEXT_PUBLIC_API_URL=https://ghl-backend-production-80ca.up.railway.app
 *   NEXT_PUBLIC_ALLOW_SEARCH_INDEXING=true   (optional; auto-enabled on non-localhost URLs)
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isLocalHostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return url.includes('localhost') || url.includes('127.0.0.1');
  }
}

const configuredSiteBase = process.env.NEXT_PUBLIC_SITE_BASE_URL?.trim();
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

export const SITE_BASE_URL = stripTrailingSlash(
  configuredSiteBase ||
    (process.env.NODE_ENV === 'production'
      ? 'https://site.peakwa.com'
      : 'http://localhost:3000'),
);

export const API_URL = stripTrailingSlash(
  configuredApiUrl ||
    (process.env.NODE_ENV === 'production'
      ? 'https://ghl-backend-production-80ca.up.railway.app'
      : 'http://localhost:4000'),
);

/**
 * Search engines may index the site when the public base URL is not localhost.
 * Set NEXT_PUBLIC_ALLOW_SEARCH_INDEXING=true to force-enable (e.g. staging).
 * Set NEXT_PUBLIC_ALLOW_SEARCH_INDEXING=false to force-disable.
 */
export const IS_SEARCH_INDEXABLE =
  process.env.NEXT_PUBLIC_ALLOW_SEARCH_INDEXING === 'true' ||
  (process.env.NEXT_PUBLIC_ALLOW_SEARCH_INDEXING !== 'false' &&
    !isLocalHostUrl(SITE_BASE_URL));
