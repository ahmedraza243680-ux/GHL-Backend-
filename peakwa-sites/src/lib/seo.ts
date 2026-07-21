import type { Metadata } from 'next';
import { IS_SEARCH_INDEXABLE, SITE_BASE_URL } from '@/src/config/config';

/** Shared robots directive — indexable in production, blocked on localhost. */
export function getSiteRobots(): NonNullable<Metadata['robots']> {
  if (!IS_SEARCH_INDEXABLE) {
    return { index: false, follow: false };
  }

  return {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  };
}

/** Builds an absolute canonical URL for a site page path (without leading slash). */
export function buildCanonicalUrl(...pathParts: string[]): string {
  const base = SITE_BASE_URL.replace(/\/$/, '');
  const path = pathParts.filter(Boolean).join('/');
  return path ? `${base}/${path}` : base;
}

export function getMetadataBase(): URL {
  return new URL(`${SITE_BASE_URL.replace(/\/$/, '')}/`);
}
