import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, MapPin, Phone, Users } from 'lucide-react';
import { buildCanonicalUrl, getSiteRobots } from '@/src/lib/seo';
import { Breadcrumbs } from '@/src/components/Breadcrumbs';
import { FaqAccordion } from '@/src/components/FaqAccordion';
import { FAQSchema } from '@/src/components/SchemaMarkup';
import { SectionWrapper } from '@/src/components/SectionWrapper';
import { SiteImage } from '@/src/components/SiteImage';
import { getLocationPages, getSiteBySlug } from '@/src/lib/api';
import { parseJson } from '@/src/lib/content';
import { getTextColor, hexToRgb, resolveTheme } from '@/src/lib/theme';
import type { GeneratedSite } from '@/src/lib/types';

type LocationPageContent = {
  heroHeading?: string;
  heroSubheading?: string;
  /** @deprecated Legacy nested hero format */
  hero?: { heading?: string; subheading?: string };
  localIntro?: string;
  whyLocal?: string;
  serviceArea?: string;
  localStats?: {
    yearsServing?: string;
    customersServed?: string;
    responseTime?: string;
  };
  process?: Array<{ step?: string; description?: string }>;
  faqs?: Array<{ question?: string; answer?: string }>;
  seo?: { title?: string; metaDescription?: string };
  /** @deprecated Legacy CTA format */
  cta?: { heading?: string; buttonText?: string };
};

type PageProps = { params: Promise<{ slug: string; locationSlug: string }> };

function colorWithOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function resolveHeroHeading(content: LocationPageContent, site: GeneratedSite, city: string) {
  return content.heroHeading || content.hero?.heading || `${site.businessName} in ${city}`;
}

function resolveHeroSubheading(content: LocationPageContent, site: GeneratedSite, city: string) {
  return (
    content.heroSubheading ||
    content.hero?.subheading ||
    `Trusted ${site.industry} services in ${city}, ${site.state}`
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, locationSlug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};

  const pages = await getLocationPages(slug);
  const page = pages.find((p) => p.slug === locationSlug);
  if (!page) return {};

  const content = parseJson<LocationPageContent>(page.content, {});
  const fallbackTitle = `${site.businessName} | ${page.city}, ${page.state}`;
  const fallbackDescription = `${site.businessName} serving ${page.city}, ${page.state} and surrounding neighborhoods`;

  return {
    title: content.seo?.title || fallbackTitle,
    description: content.seo?.metaDescription || fallbackDescription,
    alternates: { canonical: buildCanonicalUrl(site.slug, locationSlug) },
    robots: getSiteRobots(),
  };
}

export default async function LocationPage({ params }: PageProps) {
  const { slug, locationSlug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const pages = await getLocationPages(slug);
  const page = pages.find((p) => p.slug === locationSlug);
  if (!page) notFound();

  const content = parseJson<LocationPageContent>(page.content, {});
  const theme = resolveTheme(site);
  const heroImage = page.imageUrl;
  const heroHeading = resolveHeroHeading(content, site, page.city);
  const heroSubheading = resolveHeroSubheading(content, site, page.city);
  const heroTextColor = heroImage ? '#FFFFFF' : getTextColor(theme.primaryColor);

  const stats = [
    {
      icon: Clock,
      label: 'Years Serving',
      value: content.localStats?.yearsServing || '10+',
    },
    {
      icon: Users,
      label: 'Customers Served',
      value: content.localStats?.customersServed || '500+',
    },
    {
      icon: MapPin,
      label: 'Response Time',
      value: content.localStats?.responseTime || 'Same-day',
    },
  ];

  const processSteps = (content.process ?? []).filter((step) => step.step || step.description);
  const faqs = (content.faqs ?? []).filter(
    (faq): faq is { question: string; answer: string } => Boolean(faq.question && faq.answer),
  );

  return (
    <>
      <section className="relative flex min-h-[420px] items-center overflow-hidden md:min-h-[480px]">
        {heroImage ? (
          <>
            <div className="absolute inset-0">
              <SiteImage
                src={heroImage}
                alt={`${site.businessName} serving ${page.city}, ${page.state}`}
                fill
                className="object-cover"
                priority
                sizes="100vw"
                fallback={
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                }
              />
            </div>
            <div
              className="absolute inset-0"
              style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.7) }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: theme.primaryColor }}
          />
        )}
        <div
          className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
          style={{ color: heroTextColor }}
        >
          <Breadcrumbs site={site} items={[{ label: `${page.city}, ${page.county} County` }]} />
          <h1 className="mt-6 text-4xl font-bold md:text-5xl">{heroHeading}</h1>
          {heroSubheading ? (
            <p className="mt-4 max-w-2xl text-lg opacity-90">{heroSubheading}</p>
          ) : null}
        </div>
      </section>

      {content.localIntro ? (
        <SectionWrapper background="#fff">
          <div className="mx-auto max-w-6xl">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
                {site.industry.charAt(0).toUpperCase() + site.industry.slice(1)} in {page.city},{' '}
                {page.state}
              </h2>
              <div
                className="my-5 h-1 w-14 rounded-full"
                style={{ backgroundColor: theme.accentColor }}
              />
              <p className="max-w-4xl text-base leading-7 text-gray-600 md:text-[17px] md:leading-8">
                {content.localIntro}
              </p>
            </div>
          </div>
        </SectionWrapper>
      ) : null}

      <SectionWrapper background={theme.secondaryColor}>
        <div className="grid gap-6 md:grid-cols-3">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"
            >
              <span
                className="mb-4 inline-flex rounded-full p-3"
                style={{ backgroundColor: colorWithOpacity(theme.accentColor, 0.12), color: theme.accentColor }}
              >
                <stat.icon className="h-6 w-6" />
              </span>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-gray-600">{stat.label}</p>
            </article>
          ))}
        </div>
      </SectionWrapper>

      {content.whyLocal ? (
        <SectionWrapper background="#fff">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Why {page.city} Residents Choose {site.businessName}
            </h2>
            <div
              className="my-5 h-1 w-14 rounded-full"
              style={{ backgroundColor: theme.accentColor }}
            />
            <p className="max-w-4xl text-base leading-7 text-gray-600 md:text-[17px] md:leading-8">
              {content.whyLocal}
            </p>
          </div>
        </SectionWrapper>
      ) : null}

      {processSteps.length > 0 ? (
        <SectionWrapper background={theme.secondaryColor}>
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
              How We Serve {page.city}
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {processSteps.map((step, index) => (
                <article key={`${step.step}-${index}`} className="rounded-2xl bg-white p-8 shadow-sm">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: theme.accentColor }}
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-gray-900">{step.step}</h3>
                  <p className="mt-3 leading-relaxed text-gray-600">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </SectionWrapper>
      ) : null}

      {content.serviceArea ? (
        <SectionWrapper background="#fff">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-gray-900">Areas We Serve Near {page.city}</h2>
            <p className="mt-8 text-lg leading-relaxed text-gray-600">{content.serviceArea}</p>
          </div>
        </SectionWrapper>
      ) : null}

      {faqs.length > 0 ? (
        <SectionWrapper background={theme.secondaryColor}>
          <FAQSchema faqs={faqs} />
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">
              Frequently Asked Questions — {page.city}
            </h2>
            <FaqAccordion faqs={faqs} accentColor={theme.accentColor} />
          </div>
        </SectionWrapper>
      ) : null}

      <SectionWrapper background={theme.primaryColor} className="py-16 md:py-16">
        <div className="text-center" style={{ color: getTextColor(theme.primaryColor) }}>
          <h2 className="text-3xl font-bold md:text-4xl">
            Ready to Get Started in {page.city}?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
            Contact {site.businessName} today for trusted {site.industry} services in {page.city},{' '}
            {page.state}.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={`/${site.slug}/contact`}
              className="rounded-full px-8 py-3 text-sm font-semibold shadow-lg transition hover:scale-105"
              style={{ backgroundColor: '#fff', color: theme.primaryColor }}
            >
              Contact Us
            </a>
            {site.phone ? (
              <a
                href={`tel:${site.phone}`}
                className="inline-flex items-center gap-2 text-sm font-semibold opacity-90 hover:opacity-100"
              >
                <Phone className="h-4 w-4" />
                {site.phone}
              </a>
            ) : null}
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}
