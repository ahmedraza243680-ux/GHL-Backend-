import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SITE_BASE_URL } from '@/src/config/config';
import { Breadcrumbs } from '@/src/components/Breadcrumbs';
import { HeroBanner } from '@/src/components/HeroBanner';
import { SectionWrapper } from '@/src/components/SectionWrapper';
import { SiteImage } from '@/src/components/SiteImage';
import { getSiteBySlug } from '@/src/lib/api';
import { parseJson, type BlogContent, type BlogPost } from '@/src/lib/content';
import { getSiteImages } from '@/src/lib/images';
import { getTextColor, hexToRgb, resolveTheme } from '@/src/lib/theme';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};

  const blog = parseJson<BlogContent>(site.blogContent, {});

  return {
    // Title is deterministic and page-distinct so it can never collide with the
    // other pages the way the generic AI-generated seo.title does.
    title: `Blog | ${site.businessName} | ${site.city}, ${site.state}`,
    description:
      blog?.seo?.metaDescription ||
      `Latest updates and tips from ${site.businessName} in ${site.city} ${site.state}`,
    alternates: { canonical: `${SITE_BASE_URL}/${site.slug}/blog` },
    robots: { index: false, follow: false },
  };
}

function colorWithOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function PostCard({
  post,
  index,
  slug,
  image,
  accentColor,
  primaryColor,
}: {
  post: BlogPost;
  index: number;
  slug: string;
  image: string | null;
  accentColor: string;
  primaryColor: string;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      {image ? (
        <div className="relative h-[220px] w-full overflow-hidden">
          <SiteImage
            src={image}
            alt={`${post.title} blog post`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            fallback={
              <div
                className="h-full w-full"
                style={{ backgroundColor: colorWithOpacity(primaryColor, 0.15) }}
              />
            }
          />
        </div>
      ) : (
        <div
          className="h-[220px] w-full"
          style={{ backgroundColor: colorWithOpacity(primaryColor, 0.15) }}
        />
      )}
      <div className="flex flex-1 flex-col p-6">
        <span
          className="mb-3 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: accentColor,
            color: getTextColor(accentColor),
          }}
        >
          {post.category || 'News'}
        </span>
        <h3 className="text-xl font-bold text-gray-900">{post.title}</h3>
        <p className="mt-3 flex-1 text-gray-600">{post.excerpt}</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          {post.readTime || '5 min read'}
        </div>
        <Link
          href={`/${slug}/blog/${index}`}
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
          style={{
            backgroundColor: accentColor,
            color: getTextColor(accentColor),
          }}
        >
          Read More <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export default async function BlogPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const images = await getSiteImages(slug);
  const content = parseJson<BlogContent>(site.blogContent, {});
  const theme = resolveTheme(site);
  const posts = content.posts ?? [];
  const featured = posts[0];
  const remaining = posts.slice(1);

  return (
    <>
      <HeroBanner
        site={site}
        heroImage={images.hero}
        title="Blog"
        subtitle={`Insights and updates from ${site.businessName}`}
      >
        <Breadcrumbs site={site} items={[{ label: 'Blog' }]} />
      </HeroBanner>

      {featured ? (
        <SectionWrapper background="#fff" className="py-16">
          <article className="grid items-center gap-10 overflow-hidden rounded-3xl bg-white shadow-md lg:grid-cols-2">
            <div className="relative h-[280px] w-full overflow-hidden lg:h-full lg:min-h-[420px]">
              {images.blog[0] ? (
                <SiteImage
                  src={images.blog[0]!}
                  alt={`${featured.title} featured post`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  fallback={
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.15) }}
                    />
                  }
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.15) }}
                />
              )}
            </div>
            <div className="p-8 lg:pr-12">
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: theme.accentColor,
                  color: getTextColor(theme.accentColor),
                }}
              >
                {featured.category || 'News'}
              </span>
              <h2 className="mt-4 text-3xl font-bold text-gray-900 md:text-4xl">{featured.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-gray-600">{featured.excerpt}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                {featured.readTime || '5 min read'}
              </div>
              <Link
                href={`/${slug}/blog/0`}
                className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition hover:opacity-90"
                style={{
                  backgroundColor: theme.accentColor,
                  color: getTextColor(theme.accentColor),
                }}
              >
                Read More <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </SectionWrapper>
      ) : null}

      {remaining.length > 0 ? (
        <SectionWrapper background={theme.secondaryColor} className="py-16">
          <div className="grid gap-8 md:grid-cols-2">
            {remaining.map((post, i) => {
              const index = i + 1;
              return (
                <PostCard
                  key={`${post.title}-${index}`}
                  post={post}
                  index={index}
                  slug={slug}
                  image={images.blog[index] ?? null}
                  accentColor={theme.accentColor}
                  primaryColor={theme.primaryColor}
                />
              );
            })}
          </div>
        </SectionWrapper>
      ) : null}
    </>
  );
}
