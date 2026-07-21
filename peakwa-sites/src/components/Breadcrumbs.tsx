import Link from 'next/link';
import { BreadcrumbListSchema } from '@/src/components/SchemaMarkup';
import type { GeneratedSite } from '@/src/lib/types';
import { resolveTheme } from '@/src/lib/theme';

type BreadcrumbsProps = {
  site: GeneratedSite;
  items: Array<{ label: string; href?: string }>;
};

export function Breadcrumbs({ site, items }: BreadcrumbsProps) {
  const theme = resolveTheme(site);
  const base = `/${site.slug}`;

  return (
    <>
      <BreadcrumbListSchema site={site} items={items} />
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href={base} style={{ color: theme.accentColor }} className="hover:underline">
            Home
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            <span aria-hidden>&gt;</span>
            {item.href ? (
              <Link href={item.href} style={{ color: theme.accentColor }} className="hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-700">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
    </>
  );
}
