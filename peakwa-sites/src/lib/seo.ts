import type { Metadata } from 'next';
import { IS_SEARCH_INDEXABLE, SITE_BASE_URL } from '@/src/config';
import type { GeneratedSite } from '@/src/lib/types';

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

/** Builds an absolute canonical URL for a site page path segments. */
export function buildCanonicalUrl(...pathParts: string[]): string {
  const base = SITE_BASE_URL.replace(/\/$/, '');
  const path = pathParts.filter(Boolean).join('/');
  return path ? `${base}/${path}` : base;
}

export function getMetadataBase(): URL {
  return new URL(`${SITE_BASE_URL.replace(/\/$/, '')}/`);
}

type BuildPageMetadataInput = {
  site: GeneratedSite;
  title: string;
  description: string;
  pathParts: string[];
  openGraphType?: 'website' | 'article';
};

/**
 * Single metadata builder for all site pages — canonical, robots, Open Graph,
 * publisher, and authorship from one place.
 */
export function buildPageMetadata({
  site,
  title,
  description,
  pathParts,
  openGraphType = 'website',
}: BuildPageMetadataInput): Metadata {
  const canonical = buildCanonicalUrl(...pathParts);

  return {
    title,
    description,
    alternates: { canonical },
    robots: getSiteRobots(),
    authors: [{ name: site.businessName }],
    creator: site.businessName,
    publisher: site.businessName,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: site.businessName,
      locale: 'en_US',
      type: openGraphType,
    },
    other: {
      publisher: site.businessName,
    },
  };
}
