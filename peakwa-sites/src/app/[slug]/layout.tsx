import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { BackToTop } from '@/src/components/BackToTop';
import { SiteLoader } from '@/src/components/SiteLoader';
import { API_URL } from '@/src/config/config';
import { getLocationPages } from '@/src/lib/api';
import type { GeneratedSite } from '@/src/lib/types';
import { parseJson, type ServicesContent } from '@/src/lib/content';
import { resolveTheme } from '@/src/lib/theme';
import { getMetadataBase, getSiteRobots } from '@/src/lib/seo';
import clsx from 'clsx';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

async function fetchSiteBySlug(slug: string): Promise<GeneratedSite | null> {
  const res = await fetch(`${API_URL}/phase4/sites/${encodeURIComponent(slug)}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.site ?? null;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await fetchSiteBySlug(slug);
  if (!site) return { title: 'Site Not Found' };

  return {
    metadataBase: getMetadataBase(),
    robots: getSiteRobots(),
  };
}

export default async function SiteLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const site = await fetchSiteBySlug(slug);
  if (!site) notFound();

  const locations = await getLocationPages(slug);
  const servicesContent = parseJson<ServicesContent>(site.servicesContent, {});
  const theme = resolveTheme(site);
  const fontClass =
    theme.fontStyle === 'classic'
      ? 'font-classic'
      : theme.fontStyle === 'friendly'
        ? 'font-friendly'
        : 'font-modern';

  const cssVars = {
    '--color-primary': theme.primaryColor,
    '--color-secondary': theme.secondaryColor,
    '--color-accent': theme.accentColor,
  } as React.CSSProperties;

  return (
    <div className={clsx('flex min-h-screen flex-col', fontClass)} style={cssVars}>
      <SiteLoader
        businessName={site.businessName}
        primaryColor={theme.primaryColor}
        accentColor={theme.accentColor}
        tagline={`${site.city}, ${site.state}`}
      />
      <Navbar
        site={site}
        theme={theme}
        servicesContent={servicesContent}
        locations={locations}
      />
      <main className="flex-1">{children}</main>
      <Footer site={site} theme={theme} />
      <BackToTop accentColor={theme.accentColor} />
    </div>
  );
}
