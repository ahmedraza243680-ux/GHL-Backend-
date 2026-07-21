import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildCanonicalUrl, getSiteRobots } from '@/src/lib/seo';
import { Breadcrumbs } from '@/src/components/Breadcrumbs';
import { HeroBanner } from '@/src/components/HeroBanner';
import { SectionWrapper } from '@/src/components/SectionWrapper';
import { SiteImage } from '@/src/components/SiteImage';
import { getSiteBySlug } from '@/src/lib/api';
import { parseJson, type AboutContent } from '@/src/lib/content';
import { getSiteImages } from '@/src/lib/images';
import { hexToRgb, resolveTheme } from '@/src/lib/theme';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};

  const about = parseJson<AboutContent>(site.aboutContent, {});

  return {
    // Title is deterministic and page-distinct so it can never collide with the
    // home/services titles the way the generic AI-generated seo.title does.
    title: `About ${site.businessName} | ${site.city}, ${site.state}`,
    description:
      about?.seo?.metaDescription ||
      `Learn about ${site.businessName} in ${site.city} ${site.state}`,
    alternates: { canonical: buildCanonicalUrl(site.slug, 'about') },
    robots: getSiteRobots(),
  };
}

function colorWithOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default async function AboutPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const images = await getSiteImages(slug);
  const content = parseJson<AboutContent>(site.aboutContent, {});
  const theme = resolveTheme(site);
  const hero = content.hero ?? {};
  const story = content.story ?? {};
  const mission = content.mission ?? {};
  const values = content.values ?? [];

  return (
    <>
      <HeroBanner
        site={site}
        heroImage={images.hero}
        title={hero.heading || 'About Us'}
        subtitle={hero.subheading}
      >
        <Breadcrumbs site={site} items={[{ label: 'About' }]} />
      </HeroBanner>

      <SectionWrapper background="#fff">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
          <div className={images.about ? 'md:order-2' : ''}>
            <p
              className="text-sm font-semibold uppercase tracking-widest"
              style={{ color: theme.accentColor }}
            >
              Our Story
            </p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
              {story.heading || 'Our Story'}
            </h2>
            <div className="mt-5 h-1 w-16 rounded-full" style={{ backgroundColor: theme.accentColor }} />
            <div className="mt-8 max-w-2xl space-y-6 text-base leading-8 text-gray-600 md:text-lg md:leading-8">
              <p>{story.paragraph1}</p>
              <p>{story.paragraph2}</p>
            </div>
          </div>
          <div className={images.about ? 'md:order-1 md:sticky md:top-24 md:self-start' : ''}>
            {images.about ? (
              <div className="relative">
                <div
                  className="absolute -bottom-5 -right-5 hidden h-full w-full rounded-3xl md:block"
                  style={{ backgroundColor: colorWithOpacity(theme.accentColor, 0.15) }}
                />
                <div className="relative h-[320px] w-full overflow-hidden rounded-3xl shadow-xl md:h-[600px]">
                  <SiteImage
                    src={images.about}
                    alt={`${site.businessName} team and story`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    fallback={
                      <div
                        className="h-full w-full"
                        style={{ backgroundColor: colorWithOpacity(theme.accentColor, 0.15) }}
                      />
                    }
                  />
                </div>
              </div>
            ) : (
              <div
                className="flex h-[320px] items-center justify-center rounded-3xl md:h-[600px]"
                style={{ backgroundColor: colorWithOpacity(theme.secondaryColor, 0.5) }}
              >
                <p className="text-6xl font-serif opacity-20" style={{ color: theme.accentColor }}>
                  “
                </p>
              </div>
            )}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper background={theme.secondaryColor}>
        <blockquote
          className="mx-auto max-w-3xl border-l-4 py-2 pl-6 text-2xl italic text-gray-800 md:text-3xl"
          style={{ borderColor: theme.accentColor }}
        >
          {mission.statement || mission.heading}
        </blockquote>
      </SectionWrapper>

      <SectionWrapper background="#fff">
        <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">Our Values</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {values.map((v, i) => (
            <article key={`${v.title}-${i}`} className="rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">{v.title}</h3>
              <p className="mt-3 text-gray-600">{v.description}</p>
            </article>
          ))}
        </div>
      </SectionWrapper>

      {content.team ? (
        <SectionWrapper background={theme.secondaryColor}>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-gray-900">{content.team.heading}</h2>
            <p className="mt-4 text-lg text-gray-600">{content.team.description}</p>
          </div>
        </SectionWrapper>
      ) : null}
    </>
  );
}
