import { API_URL } from '@/src/config/config';
import type { GeneratedSite, LocationPage } from './types';

const fetchOptions = { next: { revalidate: 3600 } };

export async function getSiteBySlug(slug: string): Promise<GeneratedSite | null> {
  const res = await fetch(`${API_URL}/phase4/sites/${encodeURIComponent(slug)}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.site || null;
}

export async function getAllSites(): Promise<GeneratedSite[]> {
  const res = await fetch(`${API_URL}/phase4/sites`, fetchOptions);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.sites || [];
}

export async function getLocationPages(slug: string): Promise<LocationPage[]> {
  const res = await fetch(
    `${API_URL}/phase4/sites/${encodeURIComponent(slug)}/location-pages`,
    fetchOptions,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.pages || [];
}
