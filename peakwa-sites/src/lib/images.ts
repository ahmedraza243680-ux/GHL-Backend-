import { API_URL } from '@/src/config/config';

export type SiteImages = {
  hero: string | null;
  about: string | null;
  services: (string | null)[];
  blog: (string | null)[];
};

const emptyImages: SiteImages = {
  hero: null,
  about: null,
  services: [],
  blog: [],
};

export async function getSiteImages(slug: string): Promise<SiteImages> {
  try {
    const res = await fetch(`${API_URL}/phase4/sites/${encodeURIComponent(slug)}/images`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return emptyImages;
    const data = await res.json();
    const images = data.data?.images;
    if (!images) return emptyImages;
    return {
      hero: images.hero ?? null,
      about: images.about ?? null,
      services: Array.isArray(images.services) ? images.services : [],
      blog: Array.isArray(images.blog) ? images.blog : [],
    };
  } catch {
    return emptyImages;
  }
}
