import { SITE_BASE_URL } from '@/src/config/config';
import type { GeneratedSite } from '@/src/lib/types';

/**
 * Structured data (JSON-LD) MUST be present in the server-rendered HTML so
 * crawlers and validators (which parse the initial response, not the hydrated
 * DOM) can read it. That is why we render a plain <script> here instead of
 * next/script — next/script is a client component that only injects the tag
 * after hydration, leaving the SSR HTML without any schema.
 *
 * The payload is serialized with the characters that could terminate the
 * <script> element (or break JSON parsing) escaped, which is the standard,
 * safe way to embed JSON-LD.
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

export function LocalBusinessSchema({ site }: { site: GeneratedSite }) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.businessName,
    description: site.description || '',
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.city,
      addressRegion: site.state,
      addressCountry: 'US',
    },
    telephone: site.phone || '',
    email: site.email || '',
    url: `${SITE_BASE_URL}/${site.slug}`,
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
}: {
  businessName: string;
  services: SchemaService[];
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    provider: { '@type': 'LocalBusiness', name: businessName },
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
