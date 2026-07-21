import type { MetadataRoute } from 'next';
import { IS_SEARCH_INDEXABLE, SITE_BASE_URL } from '@/src/config/config';

/** Root robots.txt — allows crawlers when the deployment URL is indexable. */
export default function robots(): MetadataRoute.Robots {
  if (!IS_SEARCH_INDEXABLE) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  const base = SITE_BASE_URL.replace(/\/$/, '');

  return {
    rules: { userAgent: '*', allow: '/' },
    host: base,
  };
}
