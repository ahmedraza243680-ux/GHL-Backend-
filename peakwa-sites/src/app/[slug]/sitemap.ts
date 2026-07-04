import type { MetadataRoute } from 'next';
import { SITE_BASE_URL } from '@/src/config/config';
import { getSiteBySlug } from '@/src/lib/api';

type SitemapProps = {
  params: Promise<{ slug: string }>;
};

export default async function sitemap({ params }: SitemapProps): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return [];

  const baseUrl = `${SITE_BASE_URL.replace(/\/$/, '')}/${slug}`;
  const lastModified = new Date(
    (site as { updatedAt?: string }).updatedAt ?? Date.now(),
  );

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/services`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.6,
    },
  ];
}
