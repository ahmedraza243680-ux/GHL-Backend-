import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { BackToTop } from '@/src/components/BackToTop';
import { getLocationPages, getSiteBySlug } from '@/src/lib/api';
import { parseJson, type HomeContent } from '@/src/lib/content';
import { resolveTheme } from '@/src/lib/theme';
import type { SiteTheme } from '@/src/lib/types';
import clsx from 'clsx';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return { title: 'Site Not Found' };

  const home = parseJson<HomeContent>(site.homeContent, {});
  const seo = home.seo;

  return {
    title: seo?.title || `${site.businessName} | ${site.city}, ${site.state}`,
    description:
      seo?.metaDescription ||
      site.description ||
      `Professional ${site.industry} services in ${site.city}, ${site.state}.`,
    robots: { index: false, follow: false },
  };
}

export default async function SiteLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const locations = await getLocationPages(slug);
  const homeContent = parseJson<HomeContent>(site.homeContent, {});
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
      <Navbar site={site} theme={theme} homeContent={homeContent} locations={locations} />
      <main className="flex-1">{children}</main>
      <Footer site={site} theme={theme} />
      <BackToTop accentColor={theme.accentColor} />
    </div>
  );
}
