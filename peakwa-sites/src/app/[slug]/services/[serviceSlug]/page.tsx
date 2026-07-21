import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SITE_BASE_URL } from '@/src/config/config';
import { Breadcrumbs } from '@/src/components/Breadcrumbs';
import { CtaBanner } from '@/src/components/CtaBanner';
import { FaqAccordion } from '@/src/components/FaqAccordion';
import { FAQSchema } from '@/src/components/SchemaMarkup';
import { SectionWrapper } from '@/src/components/SectionWrapper';
import { SiteImage } from '@/src/components/SiteImage';
import { getServicePageContent, getSiteBySlug } from '@/src/lib/api';
import { parseJson, type ServicesContent } from '@/src/lib/content';
import { getIcon } from '@/src/lib/iconMap';
import { getSiteImages } from '@/src/lib/images';
import { getTextColor, hexToRgb, resolveTheme } from '@/src/lib/theme';
import type { GeneratedSite, SiteTheme } from '@/src/lib/types';

type PageProps = { params: Promise<{ slug: string; serviceSlug: string }> };

type ServicePageContent = {
  heroHeading?: string;
  heroSubheading?: string;
  overview?: string;
  process?: Array<{ step?: string; description?: string }>;
  benefits?: Array<{ title?: string; description?: string }>;
  faqs?: Array<{ question?: string; answer?: string }>;
  whyUs?: string;
  seo?: { title?: string; metaDescription?: string };
};

function slugifyService(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function colorWithOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function headingFromParagraph(paragraph: string): string {
  const words = paragraph.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length === 0) return 'Service Details';
  const heading = words.join(' ');
  return heading.charAt(0).toUpperCase() + heading.slice(1);
}

function extractBenefits(fullDescription: string): string[] {
  const sentences = fullDescription
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length >= 3) return sentences.slice(0, 3);
  const paragraphs = splitParagraphs(fullDescription);
  if (paragraphs.length >= 3) return paragraphs.slice(0, 3);
  return [
    'Experienced technicians dedicated to quality workmanship.',
    'Transparent pricing with no hidden fees.',
    'Reliable service backed by customer satisfaction.',
  ];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, serviceSlug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};

  const services = parseJson<ServicesContent>(site.servicesContent, {});
  const service = services?.services?.find((s) => slugifyService(s.title || '') === serviceSlug);
  if (!service) return {};

  const content = (await getServicePageContent(slug, serviceSlug)) as ServicePageContent | null;

  return {
    // Title is deterministic and built from the unique per-service title so each
    // service page stays distinct instead of reusing a generic AI seo.title.
    title: `${service.title} | ${site.businessName} | ${site.city}, ${site.state}`,
    description:
      content?.seo?.metaDescription ||
      service.shortDescription ||
      service.fullDescription?.slice(0, 155) ||
      '',
    alternates: {
      canonical: `${SITE_BASE_URL}/${slug}/services/${serviceSlug}`,
    },
    robots: { index: false, follow: false },
  };
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { slug, serviceSlug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const services = parseJson<ServicesContent>(site.servicesContent, {});
  const allServices = services?.services || [];
  const service = allServices.find((s) => slugifyService(s.title || '') === serviceSlug);
  if (!service) notFound();

  const images = await getSiteImages(slug);
  const serviceIndex = allServices.indexOf(service);
  const serviceImage = images.services[serviceIndex] || images.hero;
  const theme = resolveTheme(site);
  const otherServices = allServices
    .filter((s) => slugifyService(s.title || '') !== serviceSlug)
    .slice(0, 3);
  const serviceTitle = service.title || 'Service';

  const content = (await getServicePageContent(slug, serviceSlug)) as ServicePageContent | null;

  if (content) {
    return (
      <ServiceDetailFromContent
        site={site}
        slug={slug}
        serviceTitle={serviceTitle}
        serviceImage={serviceImage}
        overviewImage={images.about ?? images.services[serviceIndex + 1] ?? images.hero}
        theme={theme}
        otherServices={otherServices}
        content={content}
      />
    );
  }

  const paragraphs = splitParagraphs(service.fullDescription || service.shortDescription || '');
  const benefits = extractBenefits(service.fullDescription || service.shortDescription || '');

  const faqs = [
    {
      question: `How much does ${serviceTitle} cost?`,
      answer: `${site.businessName} offers competitive pricing for ${serviceTitle.toLowerCase()} in ${site.city}. Costs vary based on scope and requirements — contact us for a free estimate tailored to your needs.`,
    },
    {
      question: `How long does ${serviceTitle} take?`,
      answer: `Most ${serviceTitle.toLowerCase()} jobs are completed efficiently, with timelines depending on the specific project. We provide a clear schedule upfront so you know exactly what to expect.`,
    },
    {
      question: `Do you offer emergency ${serviceTitle}?`,
      answer: `Yes, ${site.businessName} understands urgent situations. Call us at ${site.phone || 'our office'} for emergency ${serviceTitle.toLowerCase()} availability in ${site.city} and surrounding areas.`,
    },
  ];

  return (
    <>
      <section className="relative flex min-h-[420px] items-center overflow-hidden md:min-h-[480px]">
        {serviceImage ? (
          <>
            <div className="absolute inset-0">
              <SiteImage
                src={serviceImage}
                alt={`${serviceTitle} service`}
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
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Breadcrumbs
            site={site}
            items={[
              { label: 'Services', href: `/${slug}/services` },
              { label: serviceTitle },
            ]}
          />
          <h1 className="mt-6 max-w-3xl text-4xl font-bold text-white md:text-5xl">
            {serviceTitle}
          </h1>
          {service.shortDescription ? (
            <p className="mt-4 max-w-2xl text-lg text-white/90">{service.shortDescription}</p>
          ) : null}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href={`/${slug}/contact`}
              className="inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-semibold shadow-lg transition hover:scale-105"
              style={{
                backgroundColor: theme.accentColor,
                color: getTextColor(theme.accentColor),
              }}
            >
              Get a Free Quote
            </Link>
            {site.phone ? (
              <a
                href={`tel:${site.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Phone className="h-4 w-4" />
                {site.phone}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <SectionWrapper background="#fff" className="py-20">
        <div className="mx-auto max-w-3xl">
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, i) => (
              <div key={i} className={i > 0 ? 'mt-10' : ''}>
                <h2 className="text-2xl font-bold text-gray-900">
                  {i === 0 ? `About ${serviceTitle}` : headingFromParagraph(paragraph)}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-gray-600">{paragraph}</p>
              </div>
            ))
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900">About {serviceTitle}</h2>
              <p className="mt-4 text-lg leading-relaxed text-gray-600">
                {service.shortDescription ||
                  `${site.businessName} provides professional ${serviceTitle.toLowerCase()} in ${site.city}, ${site.state}.`}
              </p>
            </>
          )}
        </div>
      </SectionWrapper>

      <SectionWrapper background={theme.secondaryColor} className="py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Why Choose Our {serviceTitle}
          </h2>
          <ul className="mt-10 space-y-6">
            {benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="mt-0.5 shrink-0" style={{ color: theme.accentColor }}>
                  {getIcon('check-circle', 'w-6 h-6')}
                </span>
                <p className="text-lg leading-relaxed text-gray-700">{benefit}</p>
              </li>
            ))}
          </ul>
        </div>
      </SectionWrapper>

      <SectionWrapper background="#fff" className="py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <div className="mt-10">
            <FaqAccordion faqs={faqs} accentColor={theme.accentColor} />
          </div>
        </div>
      </SectionWrapper>

      {otherServices.length > 0 ? (
        <SectionWrapper background={theme.secondaryColor} className="py-20">
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">
            Our Other Services
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {otherServices.map((other) => {
              const otherSlug = slugifyService(other.title || '');
              return (
                <Link
                  key={other.title}
                  href={`/${slug}/services/${otherSlug}`}
                  className="group flex flex-col rounded-2xl bg-white p-6 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                  style={{ borderTop: `4px solid ${theme.accentColor}` }}
                >
                  <span style={{ color: theme.accentColor }}>
                    {getIcon(other.icon || 'wrench', 'w-8 h-8')}
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-gray-900 group-hover:underline">
                    {other.title}
                  </h3>
                  <p className="mt-2 flex-1 text-gray-600">{other.shortDescription}</p>
                  <span
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                    style={{ color: theme.accentColor }}
                  >
                    Learn More <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        </SectionWrapper>
      ) : null}

      <CtaBanner
        site={site}
        heading={`Call Us Today for ${serviceTitle}`}
        subtext={
          site.phone
            ? `Reach ${site.businessName} at ${site.phone} — serving ${site.city}, ${site.state}.`
            : `Contact ${site.businessName} today — serving ${site.city}, ${site.state}.`
        }
        buttonText={site.phone ? 'Call Now' : 'Contact Us'}
      />
    </>
  );
}

type ServiceDetailFromContentProps = {
  site: GeneratedSite;
  slug: string;
  serviceTitle: string;
  serviceImage: string | null;
  overviewImage: string | null;
  theme: SiteTheme;
  otherServices: Array<{ title?: string; shortDescription?: string; icon?: string }>;
  content: ServicePageContent;
};

function ServiceDetailFromContent({
  site,
  slug,
  serviceTitle,
  serviceImage,
  overviewImage,
  theme,
  otherServices,
  content,
}: ServiceDetailFromContentProps) {
  const heroHeading = content.heroHeading || serviceTitle;
  const process = content.process || [];
  const benefits = content.benefits || [];
  const faqs = (content.faqs || []).filter(
    (faq): faq is { question: string; answer: string } => Boolean(faq.question && faq.answer),
  );

  return (
    <>
      <section className="relative flex min-h-[420px] items-center overflow-hidden md:min-h-[480px]">
        {serviceImage ? (
          <>
            <div className="absolute inset-0">
              <SiteImage
                src={serviceImage}
                alt={`${serviceTitle} service`}
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
          <div className="absolute inset-0" style={{ backgroundColor: theme.primaryColor }} />
        )}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Breadcrumbs
            site={site}
            items={[
              { label: 'Services', href: `/${slug}/services` },
              { label: serviceTitle },
            ]}
          />
          <h1 className="mt-6 max-w-3xl text-4xl font-bold text-white md:text-5xl">
            {heroHeading}
          </h1>
          {content.heroSubheading ? (
            <p className="mt-4 max-w-2xl text-lg text-white/90">{content.heroSubheading}</p>
          ) : null}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href={`/${slug}/contact`}
              className="inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-semibold shadow-lg transition hover:scale-105"
              style={{
                backgroundColor: theme.accentColor,
                color: getTextColor(theme.accentColor),
              }}
            >
              Get a Free Quote
            </Link>
            {site.phone ? (
              <a
                href={`tel:${site.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Phone className="h-4 w-4" />
                {site.phone}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {content.overview ? (
        <SectionWrapper background="#fff" className="py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">About {serviceTitle}</h2>
              <div
                className="my-6 h-1 w-16 rounded-full"
                style={{ backgroundColor: theme.accentColor }}
              />
              <p className="text-lg leading-relaxed text-gray-600">{content.overview}</p>
            </div>
            {overviewImage ? (
              <div className="relative h-[320px] w-full overflow-hidden rounded-3xl shadow-xl lg:h-[440px]">
                <SiteImage
                  src={overviewImage}
                  alt={`${serviceTitle} at ${site.businessName}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  fallback={
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: colorWithOpacity(theme.accentColor, 0.15) }}
                    />
                  }
                />
              </div>
            ) : null}
          </div>
        </SectionWrapper>
      ) : null}

      {process.length > 0 ? (
        <SectionWrapper background={theme.secondaryColor} className="py-20">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">Our Process</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {process.map((step, i) => (
              <div key={step.step ?? i} className="text-center">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
                  style={{ backgroundColor: theme.accentColor }}
                >
                  {i + 1}
                </div>
                <h3 className="mt-5 text-lg font-bold text-gray-900">{step.step}</h3>
                <p className="mt-3 text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </SectionWrapper>
      ) : null}

      {benefits.length > 0 ? (
        <SectionWrapper background="#fff" className="py-20">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            Benefits of Our {serviceTitle}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit, i) => (
              <div
                key={benefit.title ?? i}
                className="flex items-start gap-4 rounded-2xl bg-white p-6 shadow-md"
                style={{ borderTop: `4px solid ${theme.accentColor}` }}
              >
                <span className="mt-0.5 shrink-0" style={{ color: theme.accentColor }}>
                  {getIcon('check-circle', 'w-6 h-6')}
                </span>
                <div>
                  <h3 className="font-bold text-gray-900">{benefit.title}</h3>
                  <p className="mt-2 text-gray-600">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionWrapper>
      ) : null}

      {faqs.length > 0 ? (
        <SectionWrapper background={theme.secondaryColor} className="py-20">
          <FAQSchema faqs={faqs} />
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold text-gray-900">
              Frequently Asked Questions
            </h2>
            <div className="mt-10">
              <FaqAccordion faqs={faqs} accentColor={theme.accentColor} />
            </div>
          </div>
        </SectionWrapper>
      ) : null}

      {content.whyUs ? (
        <SectionWrapper background="#fff" className="py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-gray-900">Why Choose {site.businessName}</h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">{content.whyUs}</p>
          </div>
        </SectionWrapper>
      ) : null}

      {otherServices.length > 0 ? (
        <SectionWrapper background={theme.secondaryColor} className="py-20">
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">
            Our Other Services
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {otherServices.map((other) => {
              const otherSlug = slugifyService(other.title || '');
              return (
                <Link
                  key={other.title}
                  href={`/${slug}/services/${otherSlug}`}
                  className="group flex flex-col rounded-2xl bg-white p-6 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                  style={{ borderTop: `4px solid ${theme.accentColor}` }}
                >
                  <span style={{ color: theme.accentColor }}>
                    {getIcon(other.icon || 'wrench', 'w-8 h-8')}
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-gray-900 group-hover:underline">
                    {other.title}
                  </h3>
                  <p className="mt-2 flex-1 text-gray-600">{other.shortDescription}</p>
                  <span
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                    style={{ color: theme.accentColor }}
                  >
                    Learn More <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        </SectionWrapper>
      ) : null}

      <CtaBanner
        site={site}
        heading={`Call Us Today for ${serviceTitle}`}
        subtext={
          site.phone
            ? `Reach ${site.businessName} at ${site.phone} — serving ${site.city}, ${site.state}.`
            : `Contact ${site.businessName} today — serving ${site.city}, ${site.state}.`
        }
        buttonText={site.phone ? 'Call Now' : 'Contact Us'}
      />
    </>
  );
}
