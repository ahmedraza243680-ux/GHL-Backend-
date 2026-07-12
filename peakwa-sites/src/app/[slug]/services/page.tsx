import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SITE_BASE_URL } from '@/src/config/config';
import { Breadcrumbs } from '@/src/components/Breadcrumbs';
import { CtaBanner } from '@/src/components/CtaBanner';
import { HeroBanner } from '@/src/components/HeroBanner';
import { ServiceSchema } from '@/src/components/SchemaMarkup';
import { SectionWrapper } from '@/src/components/SectionWrapper';
import { SiteImage } from '@/src/components/SiteImage';
import { getSiteBySlug } from '@/src/lib/api';
import { parseJson, type ServicesContent } from '@/src/lib/content';
import { getIcon } from '@/src/lib/iconMap';
import { getSiteImages } from '@/src/lib/images';
import { getTextColor, hexToRgb, resolveTheme } from '@/src/lib/theme';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};

  const services = parseJson<ServicesContent>(site.servicesContent, {});

  return {
    title:
      services?.seo?.title ||
      `Services | ${site.businessName} | ${site.city}, ${site.state}`,
    description:
      services?.seo?.metaDescription ||
      `Professional ${site.industry} services by ${site.businessName} in ${site.city} ${site.state}`,
    alternates: { canonical: `${SITE_BASE_URL}/${site.slug}/services` },
    robots: { index: false, follow: false },
  };
}

function colorWithOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default async function ServicesPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const images = await getSiteImages(slug);
  const content = parseJson<ServicesContent>(site.servicesContent, {});
  const theme = resolveTheme(site);
  const services = content.services ?? [];

  return (
    <>
      <ServiceSchema businessName={site.businessName} services={services} />
      <HeroBanner
        site={site}
        heroImage={images.hero}
        title={content.hero?.heading || 'Our Services'}
        subtitle={content.hero?.subheading}
      >
        <Breadcrumbs site={site} items={[{ label: 'Services' }]} />
      </HeroBanner>

      <SectionWrapper background="#fff" className="py-20">
        <p className="mx-auto max-w-2xl text-center text-lg leading-relaxed text-gray-600">
          {content.intro}
        </p>
      </SectionWrapper>

      <SectionWrapper background={theme.secondaryColor} className="py-20">
        <div className="space-y-20">
          {services.map((service, i) => (
            <article
              key={`${service.title}-${i}`}
              id={slugify(service.title || `service-${i}`)}
              className={`grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 ${
                i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
              }`}
            >
              <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
                {images.services[i] ? (
                  <div className="relative aspect-[4/3] w-full">
                    <SiteImage
                      src={images.services[i]!}
                      alt={`${service.title} service`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      fallback={
                        <div
                          className="flex h-full flex-col items-center justify-center gap-4"
                          style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.12) }}
                        >
                          <span style={{ color: theme.accentColor }}>
                            {getIcon(service.icon || 'wrench', 'w-16 h-16')}
                          </span>
                          <span
                            className="text-5xl font-black"
                            style={{ color: colorWithOpacity(theme.accentColor, 0.4) }}
                          >
                            {String(i + 1).padStart(2, '0')}
                          </span>
                        </div>
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div
                      className="flex h-20 items-center justify-center"
                      style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.2) }}
                    >
                      <span style={{ color: theme.accentColor }}>
                        {getIcon(service.icon || 'wrench', 'w-10 h-10')}
                      </span>
                    </div>
                    <div
                      className="flex aspect-[4/3] flex-col items-center justify-center gap-4"
                      style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.12) }}
                    >
                      <span style={{ color: theme.accentColor }}>
                        {getIcon(service.icon || 'wrench', 'w-16 h-16')}
                      </span>
                      <span
                        className="text-5xl font-black"
                        style={{ color: colorWithOpacity(theme.accentColor, 0.4) }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="py-4">
                <span
                  className="text-sm font-bold uppercase tracking-widest"
                  style={{ color: theme.accentColor }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  <Link
                    href={`/${slug}/services/${slugify(service.title || `service-${i}`)}`}
                    className="transition hover:opacity-80"
                  >
                    {service.title}
                  </Link>
                </h2>
                <p className="mt-3 text-lg font-medium text-gray-700">{service.shortDescription}</p>
                <p className="mt-4 leading-relaxed text-gray-600">{service.fullDescription}</p>
                <Link
                  href={`/${slug}/services/${slugify(service.title || `service-${i}`)}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition hover:opacity-90"
                  style={{
                    backgroundColor: theme.accentColor,
                    color: getTextColor(theme.accentColor),
                  }}
                >
                  Read More <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionWrapper>

      <CtaBanner
        site={site}
        heading={content.cta?.heading || 'Let us help with your next project'}
        buttonText={content.cta?.buttonText}
      />
    </>
  );
}
