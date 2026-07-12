import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SITE_BASE_URL } from '@/src/config/config';
import { Breadcrumbs } from '@/src/components/Breadcrumbs';
import { ArticleSchema, FAQSchema } from '@/src/components/SchemaMarkup';
import { SectionWrapper } from '@/src/components/SectionWrapper';
import { SiteImage } from '@/src/components/SiteImage';
import { getSiteBySlug } from '@/src/lib/api';
import { parseJson, type BlogContent } from '@/src/lib/content';
import { getSiteImages } from '@/src/lib/images';
import { getTextColor, hexToRgb, resolveTheme } from '@/src/lib/theme';

type PageProps = { params: Promise<{ slug: string; postIndex: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, postIndex } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};

  const blog = parseJson<BlogContent>(site.blogContent, {});
  const post = blog?.posts?.[Number.parseInt(postIndex, 10)];
  if (!post) return {};

  return {
    title: `${post.title} | ${site.businessName}`,
    description: post.excerpt,
    alternates: { canonical: `${SITE_BASE_URL}/${site.slug}/blog/${postIndex}` },
    robots: { index: false, follow: false },
  };
}

function colorWithOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\n+|\.\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.endsWith('.') ? p : `${p}.`));
}

function headingFromParagraph(paragraph: string): string {
  const words = paragraph.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length === 0) return 'More Details';
  const heading = words.join(' ');
  return heading.charAt(0).toUpperCase() + heading.slice(1);
}

function topicFromTitle(title: string): string {
  const cleaned = title
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/[.!?]+$/, '')
    .trim();
  return cleaned || 'this topic';
}

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string };

function buildContentBlocks(paragraphs: string[]): ContentBlock[] {
  if (paragraphs.length === 0) return [];

  const blocks: ContentBlock[] = [];
  let i = 0;

  // First 2 paragraphs
  const firstCount = Math.min(2, paragraphs.length);
  for (; i < firstCount; i++) {
    blocks.push({ type: 'paragraph', text: paragraphs[i]! });
  }

  // H2 + next 2 paragraphs
  if (i < paragraphs.length) {
    blocks.push({ type: 'heading', text: headingFromParagraph(paragraphs[i]!) });
    const midEnd = Math.min(i + 2, paragraphs.length);
    for (; i < midEnd; i++) {
      blocks.push({ type: 'paragraph', text: paragraphs[i]! });
    }
  }

  // H2 + remaining paragraphs
  if (i < paragraphs.length) {
    blocks.push({ type: 'heading', text: headingFromParagraph(paragraphs[i]!) });
    for (; i < paragraphs.length; i++) {
      blocks.push({ type: 'paragraph', text: paragraphs[i]! });
    }
  }

  return blocks;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug, postIndex } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const images = await getSiteImages(slug);
  const content = parseJson<BlogContent>(site.blogContent, {});
  const index = Number.parseInt(postIndex, 10);
  const post = content.posts?.[index];
  if (!post) notFound();

  const theme = resolveTheme(site);
  const blogImage = images.blog[index] ?? null;
  const paragraphs = splitParagraphs(post.content || '');
  const contentBlocks = buildContentBlocks(paragraphs);
  const topic = topicFromTitle(post.title || 'this topic');

  const faqs = [
    {
      question: `What is ${topic}?`,
      answer: paragraphs[0] || post.excerpt || '',
    },
    {
      question: `How does ${site.businessName} help with ${topic}?`,
      answer: paragraphs[Math.floor(paragraphs.length / 2)] || post.excerpt || '',
    },
    {
      question: `Why choose ${site.businessName} for ${topic}?`,
      answer: paragraphs[paragraphs.length - 1] || post.excerpt || '',
    },
  ].filter((faq) => faq.answer);

  return (
    <>
      <ArticleSchema
        title={post.title || ''}
        excerpt={post.excerpt || ''}
        businessName={site.businessName}
        slug={slug}
        postIndex={index}
      />
      <FAQSchema faqs={faqs} />
      <SectionWrapper background="#fff">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs
            site={site}
            items={[
              { label: 'Blog', href: `/${slug}/blog` },
              { label: post.title || 'Article' },
            ]}
          />

          <Link
            href={`/${slug}/blog`}
            className="mb-6 inline-flex text-sm font-semibold"
            style={{ color: theme.accentColor }}
          >
            ← Back to blog
          </Link>

          {blogImage ? (
            <div className="relative mb-8 h-[400px] w-full overflow-hidden rounded-2xl">
              <SiteImage
                src={blogImage}
                alt={post.title || 'Blog post'}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
                fallback={
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: colorWithOpacity(theme.primaryColor, 0.15) }}
                  />
                }
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: theme.accentColor,
                color: getTextColor(theme.accentColor),
              }}
            >
              {post.category || 'News'}
            </span>
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              {post.readTime || '5 min read'}
            </p>
          </div>

          <h1 className="mt-6 text-3xl font-bold text-gray-900">{post.title}</h1>
          <p className="mt-3 text-sm text-gray-500">Author: {site.businessName}</p>

          <div className="my-8 h-px w-full bg-gray-200" />

          <article className="max-w-none text-gray-700">
            {contentBlocks.map((block, i) =>
              block.type === 'heading' ? (
                <h2 key={`h-${i}`} className="mb-4 mt-10 text-2xl font-bold text-gray-900">
                  {block.text}
                </h2>
              ) : (
                <p key={`p-${i}`} className="mb-6 text-lg leading-relaxed">
                  {block.text}
                </p>
              ),
            )}
          </article>

          <div className="my-10 h-px w-full bg-gray-200" />

          {faqs.length > 0 ? (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
              <div className="mt-6 space-y-6">
                {faqs.map((faq) => (
                  <div key={faq.question}>
                    <p className="font-bold text-gray-900">{faq.question}</p>
                    <p className="mt-2 leading-relaxed text-gray-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </SectionWrapper>
    </>
  );
}
