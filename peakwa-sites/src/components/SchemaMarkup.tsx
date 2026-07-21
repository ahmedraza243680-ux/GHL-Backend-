import { SITE_BASE_URL } from '@/src/config';
import type { GeneratedSite } from '@/src/lib/types';

/**
 * Structured data (JSON-LD) MUST be present in the server-rendered HTML so
 * crawlers and validators (which parse the initial response, not the hydrated
 * DOM) can read it. That is why we render a plain <script> here instead of
 * next/script — next/script is a client component that only injects the tag
 * after hydration, leaving the SSR HTML without any schema.
 */
function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  const json = JSON.stringify(schema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export function businessSchemaId(slug: string): string {
  return `${SITE_BASE_URL}/${slug}#business`;
}

function websiteSchemaId(slug: string): string {
  return `${SITE_BASE_URL}/${slug}#website`;
}

function resolveBusinessTypes(industry: string): string | string[] {
  const value = industry.toLowerCase();
  if (value.includes('real estate')) return ['LocalBusiness', 'RealEstateAgent'];
  if (value.includes('dental')) return ['LocalBusiness', 'Dentist'];
  if (value.includes('hvac')) return ['LocalBusiness', 'HVACBusiness'];
  if (value.includes('plumb')) return ['LocalBusiness', 'Plumber'];
  return 'LocalBusiness';
}

export function LocalBusinessSchema({
  site,
  imageUrl,
}: {
  site: GeneratedSite;
  imageUrl?: string | null;
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': resolveBusinessTypes(site.industry),
    '@id': businessSchemaId(site.slug),
    name: site.businessName,
    description: site.description || '',
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.city,
      addressRegion: site.state,
      addressCountry: 'US',
    },
    telephone: site.phone || undefined,
    email: site.email || undefined,
    url: `${SITE_BASE_URL}/${site.slug}`,
  };

  if (imageUrl) {
    schema.image = imageUrl;
  }

  return <JsonLd schema={schema} />;
}

/** Sitewide identity — pair with LocalBusiness on the home page. */
export function WebSiteSchema({ site }: { site: GeneratedSite }) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteSchemaId(site.slug),
    name: site.businessName,
    url: `${SITE_BASE_URL}/${site.slug}`,
    publisher: { '@id': businessSchemaId(site.slug) },
    inLanguage: 'en-US',
  };

  return <JsonLd schema={schema} />;
}

export function BreadcrumbListSchema({
  site,
  items,
}: {
  site: GeneratedSite;
  items: Array<{ label: string; href?: string }>;
}) {
  const baseUrl = `${SITE_BASE_URL}/${site.slug}`;
  const list = [
    { name: 'Home', item: baseUrl },
    ...items.map((entry) => ({
      name: entry.label,
      item: entry.href ? `${SITE_BASE_URL}${entry.href}` : undefined,
    })),
  ];

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.item ? { item: crumb.item } : {}),
    })),
  };

  return <JsonLd schema={schema} />;
}

type SchemaService = {
  title?: string;
  shortDescription?: string;
  description?: string;
};

export function ServiceSchema({
  businessName,
  services,
  businessSlug,
}: {
  businessName: string;
  services: SchemaService[];
  businessSlug?: string;
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    provider: businessSlug
      ? { '@id': businessSchemaId(businessSlug) }
      : { '@type': 'LocalBusiness', name: businessName },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${businessName} Services`,
      itemListElement: services.map((s, i) => ({
        '@type': 'Offer',
        position: i + 1,
        itemOffered: {
          '@type': 'Service',
          name: s.title || '',
          description: s.shortDescription || s.description || '',
        },
      })),
    },
  };

  return <JsonLd schema={schema} />;
}

export function ServiceDetailSchema({
  site,
  serviceTitle,
  description,
  serviceSlug,
}: {
  site: GeneratedSite;
  serviceTitle: string;
  description: string;
  serviceSlug: string;
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: serviceTitle,
    description,
    url: `${SITE_BASE_URL}/${site.slug}/services/${serviceSlug}`,
    provider: { '@id': businessSchemaId(site.slug) },
    areaServed: {
      '@type': 'City',
      name: site.city,
      containedInPlace: {
        '@type': 'State',
        name: site.state,
      },
    },
  };

  return <JsonLd schema={schema} />;
}

/** Location landing pages — ties the business to a specific service area. */
export function LocationAreaSchema({
  site,
  city,
  county,
  state,
  locationSlug,
  imageUrl,
}: {
  site: GeneratedSite;
  city: string;
  county: string;
  state: string;
  locationSlug: string;
  imageUrl?: string | null;
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': resolveBusinessTypes(site.industry),
    '@id': `${SITE_BASE_URL}/${site.slug}/${locationSlug}#location`,
    name: `${site.businessName} — ${city}`,
    url: `${SITE_BASE_URL}/${site.slug}/${locationSlug}`,
    parentOrganization: { '@id': businessSchemaId(site.slug) },
    areaServed: {
      '@type': 'City',
      name: city,
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: `${county} County, ${state}`,
      },
    },
  };

  if (imageUrl) {
    schema.image = imageUrl;
  }

  return <JsonLd schema={schema} />;
}

export function FAQSchema({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  if (!faqs || faqs.length === 0) return null;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return <JsonLd schema={schema} />;
}

export function ArticleSchema({
  title,
  excerpt,
  businessName,
  slug,
  postIndex,
}: {
  title: string;
  excerpt: string;
  businessName: string;
  slug: string;
  postIndex: number;
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: excerpt,
    author: { '@type': 'Organization', name: businessName },
    publisher: { '@type': 'Organization', name: businessName },
    url: `${SITE_BASE_URL}/${slug}/blog/${postIndex}`,
  };

  return <JsonLd schema={schema} />;
}
