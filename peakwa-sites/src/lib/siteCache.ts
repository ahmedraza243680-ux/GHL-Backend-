/** Next.js fetch cache tags for site API responses. */
export function siteCacheTag(slug: string): string {
  return `site-${slug}`;
}

export const ALL_SITES_CACHE_TAG = 'sites';
