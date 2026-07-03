import Link from 'next/link';
import { Globe, Mail, MapPin, MessageCircle, Phone, Share2 } from 'lucide-react';
import type { GeneratedSite, SiteTheme } from '@/src/lib/types';
import { getTextColor } from '@/src/lib/theme';

type FooterProps = {
  site: GeneratedSite;
  theme: SiteTheme;
};

const SOCIAL_ICONS = [
  { Icon: Globe, label: 'Website', href: '#' },
  { Icon: Share2, label: 'Share', href: '#' },
  { Icon: MessageCircle, label: 'Message', href: '#' },
] as const;

export function Footer({ site, theme }: FooterProps) {
  const textColor = getTextColor(theme.primaryColor);
  const base = `/${site.slug}`;

  return (
    <footer
      style={{
        backgroundColor: theme.primaryColor,
        color: textColor,
        borderTop: `4px solid ${theme.accentColor}`,
      }}
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="text-xl font-bold">{site.businessName}</p>
          <p className="mt-3 max-w-sm text-sm opacity-80">
            Trusted {site.industry} professionals serving {site.city}, {site.state} and
            surrounding communities.
          </p>
          <div className="mt-5 flex gap-3">
            {SOCIAL_ICONS.map(({ Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-105"
                style={{
                  backgroundColor: theme.accentColor,
                  color: getTextColor(theme.accentColor),
                }}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide opacity-70">
            Quick Links
          </p>
          <ul className="space-y-2 text-sm">
            {[
              ['Home', base],
              ['About', `${base}/about`],
              ['Services', `${base}/services`],
              ['Blog', `${base}/blog`],
              ['Contact', `${base}/contact`],
            ].map(([label, href]) => (
              <li key={label}>
                <Link href={href} className="opacity-90 transition hover:opacity-100">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide opacity-70">
            Contact
          </p>
          <ul className="space-y-3 text-sm">
            {site.phone ? (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={`tel:${site.phone}`}>{site.phone}</a>
              </li>
            ) : null}
            {site.email ? (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </li>
            ) : null}
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {site.city}, {site.state}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div
        className="border-t border-white/10 py-5 text-center text-xs opacity-70"
        style={{ color: textColor }}
      >
        © {new Date().getFullYear()} {site.businessName}. All rights reserved.
      </div>

      <p className="pb-5 text-center text-gray-400" style={{ fontSize: '12px' }}>
        Powered by{' '}
        <a
          href="https://peakwa.com"
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:opacity-80"
          style={{ color: theme.accentColor }}
        >
          Peakwa
        </a>
      </p>
    </footer>
  );
}
