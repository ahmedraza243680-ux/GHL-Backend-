import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SITE_BASE_URL } from '@/src/config/config';
import { Breadcrumbs } from '@/src/components/Breadcrumbs';
import { ContactForm } from '@/src/components/ContactForm';
import { HeroBanner } from '@/src/components/HeroBanner';
import { SectionWrapper } from '@/src/components/SectionWrapper';
import { getSiteBySlug } from '@/src/lib/api';
import { parseJson, type ContactContent } from '@/src/lib/content';
import { getSiteImages } from '@/src/lib/images';
import { getTextColor, resolveTheme } from '@/src/lib/theme';
import type { GeneratedSite } from '@/src/lib/types';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};

  const contact = parseJson<ContactContent>(site.contactContent, {});

  return {
    // Title is deterministic and page-distinct so it can never collide with the
    // other pages the way the generic AI-generated seo.title does.
    title: `Contact ${site.businessName} | ${site.city}, ${site.state}`,
    description:
      contact?.seo?.metaDescription ||
      `Contact ${site.businessName} in ${site.city} ${site.state}`,
    alternates: { canonical: `${SITE_BASE_URL}/${site.slug}/contact` },
    robots: { index: false, follow: false },
  };
}

export default async function ContactPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const images = await getSiteImages(slug);
  const content = parseJson<ContactContent>(site.contactContent, {});
  const theme = resolveTheme(site);

  // `address` isn't in the shared GeneratedSite type yet, but the API does return it.
  const siteAddress = (site as GeneratedSite & { address?: string | null }).address ?? '';
  const mapQuery = encodeURIComponent(`${siteAddress} ${site.city} ${site.state}`.trim());
  const mapSrc = `https://maps.google.com/maps?q=${mapQuery}&output=embed`;

  return (
    <>
      <HeroBanner
        site={site}
        heroImage={images.hero}
        title={content.hero?.heading || 'Contact Us'}
        subtitle={content.hero?.subheading || content.intro}
      >
        <Breadcrumbs site={site} items={[{ label: 'Contact' }]} />
      </HeroBanner>

      <SectionWrapper background="#fff" className="py-20">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ContactForm site={site} slug={slug} heading={content.formHeading || 'Get in touch'} />
          </div>
          <aside
            className="rounded-3xl p-8 shadow-xl lg:col-span-2"
            style={{
              backgroundColor: theme.primaryColor,
              color: getTextColor(theme.primaryColor),
            }}
          >
            <h2 className="text-2xl font-bold">{site.businessName}</h2>
            <ul className="mt-8 space-y-5 text-sm">
              {site.phone ? (
                <li className="flex items-center gap-3">
                  <Phone className="h-5 w-5" />
                  <a href={`tel:${site.phone}`}>{site.phone}</a>
                </li>
              ) : null}
              {site.email ? (
                <li className="flex items-center gap-3">
                  <Mail className="h-5 w-5" />
                  <a href={`mailto:${site.email}`}>{site.email}</a>
                </li>
              ) : null}
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5" />
                <span>
                  {site.city}, {site.state}
                </span>
              </li>
            </ul>
            {content.hoursSection ? (
              <div className="mt-8 border-t border-white/20 pt-6">
                <p className="font-semibold">{content.hoursSection.heading}</p>
                <p className="mt-2 text-sm opacity-90">{content.hoursSection.description}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </SectionWrapper>

      <SectionWrapper background={theme.secondaryColor} className="py-20">
        <div className="flex flex-col items-center text-center">
          <MapPin className="h-10 w-10" style={{ color: theme.accentColor }} />
          <p className="mt-3 text-lg font-semibold text-gray-800">
            {site.city}, {site.state}
          </p>
          <p className="mt-2 max-w-md text-sm text-gray-600">
            {content.addressSection?.heading || `Visit ${site.businessName} in ${site.city}`}
          </p>
        </div>

        <div className="mt-8 h-64 w-full overflow-hidden rounded-xl border border-gray-200">
          <iframe
            src={mapSrc}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`${site.businessName} location map`}
          />
        </div>

        <div className="mt-6 text-center">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-md transition hover:opacity-90"
            style={{
              backgroundColor: theme.accentColor,
              color: getTextColor(theme.accentColor),
            }}
          >
            <MapPin className="h-4 w-4" />
            View on Google Maps
          </a>
        </div>
      </SectionWrapper>
    </>
  );
}
