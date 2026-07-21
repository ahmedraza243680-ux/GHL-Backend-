import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_BASE_URL } from '@/src/config/config';
import { ArrowRight, ChevronDown, Phone, Quote, Star } from 'lucide-react';
import { CtaBanner } from '@/src/components/CtaBanner';
import { FAQSchema, LocalBusinessSchema } from '@/src/components/SchemaMarkup';
import { SectionWrapper } from '@/src/components/SectionWrapper';
import { SiteImage } from '@/src/components/SiteImage';
import { getSiteBySlug } from '@/src/lib/api';
import { parseJson, type HomeContent } from '@/src/lib/content';
import { getIcon } from '@/src/lib/iconMap';
import { getSiteImages } from '@/src/lib/images';
import { darkenHex, getTextColor, hexToRgb, resolveTheme } from '@/src/lib/theme';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};

  const home = parseJson<HomeContent>(site.homeContent, {});

  return {
    title: home?.seo?.title || `${site.businessName} | ${site.city}, ${site.state}`,
    description:
      home?.seo?.metaDescription ||
      `${site.businessName} serving ${site.city} ${site.state}`,
    alternates: { canonical: `${SITE_BASE_URL}/${site.slug}` },
    robots: { index: false, follow: false },
  };
}

function colorWithOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function hashString(value: string): number {
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function trustedSinceYear(industry: string): number {
  const years = [2005, 2007, 2009, 2011, 2013, 2015, 2017];
  return years[hashString(industry) % years.length]!;
}

function customersServedLabel(slug: string): string {
  return hashString(slug) % 2 === 0 ? '1000+' : '500+';
}

function getNearbyAreas(city: string, state: string): string[] {
  const njAreas = [
    'Newark',
    'Jersey City',
    'Paterson',
    'Elizabeth',
    'Edison',
    'Woodbridge',
    'Lakewood',
    'Toms River',
    'Hamilton',
    'Trenton',
  ];
  const normalizedState = state.trim().toLowerCase();
  if (normalizedState === 'nj' || normalizedState === 'new jersey') {
    return njAreas.filter((area) => area.toLowerCase() !== city.toLowerCase()).slice(0, 6);
  }
  return [
    `Greater ${city}`,
    `North ${city}`,
    `South ${city}`,
    `East ${city}`,
    `West ${city}`,
    `${state} Metro`,
  ];
}

function buildTrustBadges(city: string) {
  return [
    {
      icon: 'shield',
      title: 'Licensed & Insured',
      subtitle: 'Fully certified professionals',
    },
    {
      icon: 'dollar-sign',
      title: 'Free Estimates',
      subtitle: 'No-obligation, upfront quotes',
    },
    {
      icon: 'thumbs-up',
      title: 'Satisfaction Guaranteed',
      subtitle: 'We stand behind our work',
    },
    {
      icon: 'home',
      title: 'Locally Owned',
      subtitle: `Proudly serving ${city}`,
    },
  ];
}

function buildFaqs(
  businessName: string,
  city: string,
  state: string,
  industry: string,
  phone: string | null | undefined,
): { question: string; answer: string }[] {
  const contactSentence = phone
    ? `Call us at ${phone}`
    : 'Reach out through our contact page';

  return [
    {
      question: `What areas does ${businessName} serve?`,
      answer: `${businessName} proudly serves ${city}, ${state} and the surrounding communities. If you're nearby and aren't sure whether we cover your area, just give us a call and we'll be glad to help.`,
    },
    {
      question: 'How do I request a quote or schedule service?',
      answer: `Getting started is simple. ${contactSentence} or fill out the contact form on our website, and we'll respond promptly to discuss your needs and find a time that works for you.`,
    },
    {
      question: `Is ${businessName} licensed and insured?`,
      answer: `Yes. ${businessName} is fully licensed and insured, so you can have complete peace of mind knowing your ${industry} project is handled by qualified, accountable professionals.`,
    },
    {
      question: 'Do you offer free estimates?',
      answer: `Absolutely. We provide free, no-obligation estimates for your ${industry} needs in ${city}. You'll get clear, upfront pricing with no hidden fees before any work begins.`,
    },
    {
      question: `What makes ${businessName} different from other ${industry} providers?`,
      answer: `As a locally owned business in ${city}, we pair professional expertise with genuine, personal customer care. We treat every customer like a neighbor and take real pride in the quality of our work.`,
    },
  ];
}

function buildTestimonials(businessName: string, city: string, industry: string) {
  const names = ['Michael R.', 'Sarah T.', 'David K.'];
  const reviews = [
    `${businessName} exceeded our expectations. Their ${industry} team was professional, on time, and left everything spotless. We will definitely use them again in ${city}.`,
    `We called ${businessName} for help and they responded quickly. Fair pricing, honest advice, and quality work — exactly what you want from a local ${city} business.`,
    `Outstanding service from start to finish. ${businessName} explained every step clearly and delivered great results. Highly recommend to anyone in ${city} and nearby areas.`,
  ];
  return names.map((name, i) => ({ name, review: reviews[i]! }));
}

const processSteps = [
  {
    title: 'Contact Us',
    description: 'Reach out by phone or our contact form. We respond quickly and schedule a convenient time.',
  },
  {
    title: 'We Assess Your Needs',
    description: 'Our team evaluates your situation, answers questions, and provides a clear plan tailored to you.',
  },
  {
    title: 'We Deliver Results',
    description: 'We complete the work on schedule with quality you can count on and follow up to ensure satisfaction.',
  },
];

export default async function HomePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const images = await getSiteImages(slug);
  const content = parseJson<HomeContent>(site.homeContent, {});
  const theme = resolveTheme(site);
  const hero = content.hero ?? {};
  const about = content.about ?? {};
  const services = content.services ?? [];
  const homeServices = services.length > 6 ? services.slice(0, 6) : services;
  const whyChooseUs = content.whyChooseUs ?? [];
  const cta = content.cta ?? {};
  const trustedYear = trustedSinceYear(site.industry);
  const customersLabel = customersServedLabel(site.slug);
  const serviceCount = services.length || 6;
  const nearbyAreas = getNearbyAreas(site.city, site.state);
  const testimonials = buildTestimonials(site.businessName, site.city, site.industry);
  const trustBadges = buildTrustBadges(site.city);
  const faqs = buildFaqs(site.businessName, site.city, site.state, site.industry, site.phone);

  const areaText = getTextColor(theme.primaryColor);
  const areaTextIsLight = areaText === '#FFFFFF';
  const areaMuted = areaTextIsLight ? 'rgba(255,255,255,0.85)' : 'rgba(17,24,39,0.75)';
  const areaPillBase = areaTextIsLight ? '#FFFFFF' : theme.primaryColor;

  const stats = [
    {
      value: String(trustedYear),
      label: `${site.city} Trusted Since`,
    },
    {
      value: customersLabel,
      label: 'Customers Served',
    },
    {
      value: String(serviceCount),
      label: 'Services Offered',
    },
    {
      value: '5.0',
      label: 'Customer Rating',
      showStar: true,
    },
  ];

  const heroDark = theme.heroStyle === 'dark';
  const heroBg = heroDark
    ? `linear-gradient(135deg, ${theme.primaryColor}, ${darkenHex(theme.primaryColor, 0.2)})`
    : theme.secondaryColor;
  const heroText = heroDark ? '#FFFFFF' : getTextColor(theme.secondaryColor);
  const heroOverlay = heroDark
    ? `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05) 0%, transparent 50%)`
    : `radial-gradient(circle at 20% 50%, rgba(0,0,0,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,0,0,0.03) 0%, transparent 50%)`;

  return (
    <>
      <LocalBusinessSchema site={site} />
      <section
        className="relative flex min-h-screen items-center overflow-hidden"
        style={
          images.hero
            ? { color: '#FFFFFF' }
            : { background: heroBg, color: heroText }
        }
      >
        {images.hero ? (
          <>
            <div className="absolute inset-0">
              <SiteImage
                src={images.hero}
                alt={`${site.businessName} hero background`}
                fill
                className="object-cover"
                priority
                sizes="100vw"
                fallback={
                  <div className="h-full w-full" style={{ background: heroBg }} />
                }
              />
            </div>
            <div
              className="absolute inset-0"
              style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.7) }}
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ backgroundImage: heroOverlay }} />
            <div
              className={
                heroDark ? 'hero-pattern absolute inset-0' : 'hero-pattern-light absolute inset-0'
              }
            />
          </>
        )}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-3xl animate-fade-up">
            <h1 className="text-5xl font-black leading-tight tracking-tight md:text-7xl">
              {hero.heading || `Welcome to ${site.businessName}`}
            </h1>
            <p className="mt-6 text-xl opacity-80 md:text-2xl">
              {hero.subheading || `Serving ${site.city}, ${site.state} with pride.`}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={`/${slug}/contact`}
                className="inline-flex items-center justify-center rounded-full px-8 py-4 text-sm font-bold shadow-lg transition hover:scale-105"
                style={{
                  backgroundColor: theme.accentColor,
                  color: getTextColor(theme.accentColor),
                }}
              >
                {hero.ctaButton || 'Get Started'}
              </Link>
              {site.phone ? (
                <a
                  href={`tel:${site.phone}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 px-8 py-4 text-sm font-semibold transition hover:bg-white/10"
                  style={{ borderColor: heroText, color: images.hero ? '#FFFFFF' : heroText }}
                >
                  <Phone className="h-4 w-4" />
                  {site.phone}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <SectionWrapper
        background="#fff"
        className="!py-10"
        style={{ borderBottom: `1px solid ${colorWithOpacity(theme.primaryColor, 0.1)}` }}
      >
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {trustBadges.map((badge) => (
            <div
              key={badge.title}
              className="flex flex-col items-center gap-3 text-center md:flex-row md:gap-4 md:text-left"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: colorWithOpacity(theme.accentColor, 0.12),
                  color: theme.accentColor,
                }}
              >
                {getIcon(badge.icon, 'w-6 h-6')}
              </span>
              <div>
                <p className="font-bold text-gray-900">{badge.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{badge.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper
        background="#fff"
        className="py-24"
        style={{ borderTop: `4px solid ${theme.accentColor}` }}
      >
        <div className="grid items-center gap-12 md:grid-cols-2">
          {images.about ? (
            <div className="relative h-[300px] w-full overflow-hidden rounded-3xl md:h-full md:min-h-[420px]">
              <SiteImage
                src={images.about}
                alt={`About ${site.businessName}`}
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
          ) : (
            <div className="relative h-64 md:h-80">
              <div
                className="absolute inset-4 rounded-3xl"
                style={{ backgroundColor: colorWithOpacity(theme.accentColor, 0.15) }}
              />
              <div
                className="absolute bottom-0 right-0 h-40 w-40 rounded-2xl"
                style={{ backgroundColor: theme.accentColor }}
              />
              <div
                className="absolute left-6 top-6 h-24 w-24 rounded-full border-4 bg-white"
                style={{ borderColor: theme.primaryColor }}
              />
              <div
                className="absolute bottom-12 left-12 h-16 w-16 rotate-45 rounded-lg"
                style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.3) }}
              />
            </div>
          )}
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {about.heading || 'About Us'}
            </h2>
            <div
              className="my-6 h-1 w-16 rounded-full"
              style={{ backgroundColor: theme.accentColor }}
            />
            <p className="text-lg leading-relaxed text-gray-600">
              {about.paragraph1 || site.description}
            </p>
            <div
              className="my-6 h-px w-full"
              style={{ backgroundColor: colorWithOpacity(theme.accentColor, 0.35) }}
            />
            <p className="text-lg leading-relaxed text-gray-600">
              {about.paragraph2 || `Proudly serving ${site.city} and nearby communities.`}
            </p>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper background={theme.secondaryColor} className="py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900">Our Services</h2>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {homeServices.map((service, i) => (
            <article
              key={`${service.title}-${i}`}
              className="overflow-hidden rounded-2xl bg-white shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              style={{ borderTop: `4px solid ${theme.accentColor}` }}
            >
              {images.services[i] ? (
                <div className="relative h-[180px] w-full overflow-hidden rounded-t-xl">
                  <SiteImage
                    src={images.services[i]!}
                    alt={`${service.title} service`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    fallback={
                      <div
                        className="flex h-full items-center justify-center"
                        style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.2) }}
                      >
                        <span style={{ color: theme.accentColor }}>
                          {getIcon(service.icon || 'wrench', 'w-8 h-8')}
                        </span>
                      </div>
                    }
                  />
                </div>
              ) : (
                <div
                  className="flex h-20 items-center justify-center"
                  style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.2) }}
                >
                  <span style={{ color: theme.accentColor }}>
                    {getIcon(service.icon || 'wrench', 'w-8 h-8')}
                  </span>
                </div>
              )}
              <div className="p-8">
                <h3 className="text-lg font-semibold text-gray-900">{service.title}</h3>
                <p className="mt-3 text-gray-600">{service.description}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper background="#fff" className="py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Why Choose Us</h2>
            <p className="mt-4 text-lg text-gray-600">
              {site.businessName} delivers dependable {site.industry} service with a personal touch.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {whyChooseUs.map((item, i) => (
              <div key={`${item.point}-${i}`} className="rounded-xl border border-gray-100 p-6">
                <div className="flex items-start gap-3">
                  <span className="shrink-0" style={{ color: theme.accentColor }}>
                    {getIcon('check-circle', 'w-5 h-5')}
                  </span>
                  <div>
                    <p className="font-bold text-gray-900">{item.point}</p>
                    <p className="mt-2 text-sm text-gray-600">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper background="#fff" className="py-20">
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 md:grid-cols-4 md:divide-y-0">
          {stats.map((stat, i) => (
            <div
              key={`${stat.label}-${i}`}
              className="flex flex-col items-center justify-center px-4 py-10 text-center md:py-12"
            >
              <div className="flex items-center gap-1">
                <span
                  className="text-4xl font-bold md:text-5xl"
                  style={{ color: theme.primaryColor }}
                >
                  {stat.value}
                </span>
                {stat.showStar ? (
                  <Star
                    className="h-7 w-7 fill-current"
                    style={{ color: theme.primaryColor }}
                  />
                ) : null}
              </div>
              <p className="mt-3 text-sm font-medium text-gray-500 md:text-base">{stat.label}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper background={theme.secondaryColor} className="py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
          <p className="mt-3 text-lg text-gray-600">Our simple three-step process</p>
        </div>
        <div className="grid gap-10 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-start md:gap-6">
          {processSteps.map((step, i) => (
            <div key={step.title} className="contents">
              <div className="flex flex-col items-center text-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
                  style={{ backgroundColor: theme.accentColor }}
                >
                  {i + 1}
                </div>
                <h3 className="mt-5 text-xl font-bold text-gray-900">{step.title}</h3>
                <p className="mt-3 max-w-xs text-gray-600">{step.description}</p>
              </div>
              {i < processSteps.length - 1 ? (
                <div className="hidden items-center justify-center md:flex">
                  <ArrowRight className="h-8 w-8 text-gray-400" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper background="#fff" className="py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900">What Our Customers Say</h2>
          <p className="mt-3 text-lg text-gray-600">
            Trusted by homeowners and businesses across {site.city}
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article
              key={testimonial.name}
              className="relative rounded-2xl bg-white p-8 shadow-lg"
            >
              <Quote
                className="mb-4 h-8 w-8"
                style={{ color: theme.accentColor }}
              />
              <div className="mb-4 flex gap-1">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star
                    key={starIndex}
                    className="h-4 w-4 fill-current text-amber-400"
                  />
                ))}
              </div>
              <p className="leading-relaxed text-gray-600">{testimonial.review}</p>
              <p className="mt-6 font-semibold text-gray-900">{testimonial.name}</p>
            </article>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper background={theme.primaryColor} className="py-20">
        <div className="mx-auto max-w-4xl text-center" style={{ color: areaText }}>
          <h2 className="text-3xl font-bold">
            Serving {site.city} and Surrounding Areas
          </h2>
          <div
            className="mx-auto mt-4 h-1 w-16 rounded-full"
            style={{ backgroundColor: theme.accentColor }}
          />
          <p className="mt-6 text-lg leading-relaxed" style={{ color: areaMuted }}>
            {site.businessName} is proud to serve {site.city}, {site.state} and the surrounding
            communities. As a local {site.industry} provider, we understand the needs of our
            neighbors and are committed to reliable, friendly service right in your backyard.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {nearbyAreas.map((area) => (
              <span
                key={area}
                className="rounded-full border px-4 py-2 text-sm font-medium"
                style={{
                  borderColor: colorWithOpacity(areaPillBase, 0.3),
                  backgroundColor: colorWithOpacity(areaPillBase, 0.12),
                  color: areaText,
                }}
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </SectionWrapper>

      <FAQSchema faqs={faqs} />
      <SectionWrapper background="#fff" className="py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
            <p className="mt-3 text-lg text-gray-600">
              Everything you need to know about working with {site.businessName}
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                    style={{ color: theme.accentColor }}
                  />
                </summary>
                <p className="mt-4 leading-relaxed text-gray-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </SectionWrapper>

      <CtaBanner
        site={site}
        heading={cta.heading || `Ready to work with ${site.businessName}?`}
        subtext={cta.subtext}
        buttonText={cta.buttonText}
      />
    </>
  );
}
