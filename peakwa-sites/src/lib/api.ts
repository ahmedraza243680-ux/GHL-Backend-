import { API_URL } from '@/src/config/config';
import { ALL_SITES_CACHE_TAG, siteCacheTag } from '@/src/lib/siteCache';
import type { GeneratedSite, LocationPage } from './types';

export async function getSiteBySlug(slug: string): Promise<GeneratedSite | null> {
  const res = await fetch(`${API_URL}/phase4/sites/${encodeURIComponent(slug)}`, {
    next: { revalidate: 3600, tags: [ALL_SITES_CACHE_TAG, siteCacheTag(slug)] },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.site || null;
}

export async function getAllSites(): Promise<GeneratedSite[]> {
  const res = await fetch(`${API_URL}/phase4/sites`, {
    next: { revalidate: 3600, tags: [ALL_SITES_CACHE_TAG] },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.sites || [];
}

export async function getLocationPages(slug: string): Promise<LocationPage[]> {
  const res = await fetch(
    `${API_URL}/phase4/sites/${encodeURIComponent(slug)}/location-pages`,
    { next: { revalidate: 3600, tags: [siteCacheTag(slug), `${siteCacheTag(slug)}-locations`] } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.pages || [];
}

export async function getServicePageContent(slug: string, serviceSlug: string) {
  const res = await fetch(
    `${API_URL}/phase4/sites/${encodeURIComponent(slug)}/services/${encodeURIComponent(serviceSlug)}`,
    {
      next: {
        revalidate: 86400,
        tags: [siteCacheTag(slug), `${siteCacheTag(slug)}-service-${serviceSlug}`],
      },
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.content || null;
}
