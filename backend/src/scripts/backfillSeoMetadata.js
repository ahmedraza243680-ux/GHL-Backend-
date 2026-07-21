/**
 * Normalizes stored page JSON seo blocks to valid title/description lengths
 * without regenerating full page body content.
 *
 * Usage:
 *   node src/scripts/backfillSeoMetadata.js [siteSlug]
 */
import prisma from '../database/client.js';
import { getSchemaForIndustry } from '../services/industrySchema.service.js';
import {
  ensureSeoMetadata,
  isValidSeoMetaDescription,
  isValidSeoTitle,
  validateSeoBlock,
} from '../services/seoMetadata.service.js';

const PAGE_FIELDS = [
  { key: 'homeContent', kind: 'home' },
  { key: 'aboutContent', kind: 'about' },
  { key: 'servicesContent', kind: 'services' },
  { key: 'contactContent', kind: 'contact' },
  { key: 'blogContent', kind: 'blog' },
];

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function needsSeoFix(content) {
  return validateSeoBlock(content?.seo).length > 0;
}

async function backfillSite(site) {
  const businessData = {
    businessName: site.businessName,
    industry: site.industry,
    city: site.city,
    state: site.state,
    phone: site.phone,
    email: site.email,
    description: site.description,
  };

  const schema = await getSchemaForIndustry(site.industry);
  const updates = {};

  for (const { key, kind } of PAGE_FIELDS) {
    let content = parseJson(site[key]);
    let changed = false;

    if (kind === 'blog' && Array.isArray(content.posts)) {
      const posts = [];
      for (const post of content.posts) {
        if (!needsSeoFix({ seo: post?.seo })) {
          posts.push(post);
          continue;
        }

        const fixed = await ensureSeoMetadata(
          { seo: post?.seo ?? {} },
          businessData,
          'blogPost',
          schema.systemPrompt,
          { subjectTitle: post?.title },
        );
        posts.push({ ...post, seo: fixed.seo });
        changed = true;

        console.info(
          JSON.stringify({
            event: 'backfill_seo_blog_post_updated',
            slug: site.slug,
            postTitle: post?.title,
            titleLength: fixed.seo?.title?.length ?? 0,
            titleValid: isValidSeoTitle(fixed.seo?.title),
          }),
        );
      }

      if (changed) {
        content = { ...content, posts };
      }
    }

    if (needsSeoFix(content)) {
      content = await ensureSeoMetadata(content, businessData, kind, schema.systemPrompt);
      changed = true;

      console.info(
        JSON.stringify({
          event: 'backfill_seo_page_updated',
          slug: site.slug,
          page: kind,
          titleLength: content.seo?.title?.length ?? 0,
          titleValid: isValidSeoTitle(content.seo?.title),
          descriptionLength: content.seo?.metaDescription?.length ?? 0,
          descriptionValid: isValidSeoMetaDescription(content.seo?.metaDescription),
        }),
      );
    }

    if (changed) {
      updates[key] = JSON.stringify(content);
    }
  }

  const locationPages = await prisma.locationPage.findMany({ where: { siteId: site.id } });
  let locationUpdates = 0;

  for (const page of locationPages) {
    const content = parseJson(page.content);
    if (!needsSeoFix(content)) continue;

    const fixed = await ensureSeoMetadata(content, businessData, 'location', schema.systemPrompt, {
      locationCity: page.city,
    });

    await prisma.locationPage.update({
      where: { id: page.id },
      data: { content: JSON.stringify(fixed) },
    });
    locationUpdates += 1;

    console.info(
      JSON.stringify({
        event: 'backfill_seo_location_updated',
        slug: site.slug,
        locationSlug: page.slug,
        titleLength: fixed.seo?.title?.length ?? 0,
        titleValid: isValidSeoTitle(fixed.seo?.title),
      }),
    );
  }

  const servicePages = await prisma.servicePage.findMany({ where: { siteId: site.id } });
  let serviceUpdates = 0;

  for (const page of servicePages) {
    const content = parseJson(page.content);
    if (!needsSeoFix(content)) continue;

    const fixed = await ensureSeoMetadata(content, businessData, 'service', schema.systemPrompt, {
      subjectTitle: page.serviceTitle,
    });

    await prisma.servicePage.update({
      where: { id: page.id },
      data: { content: JSON.stringify(fixed) },
    });
    serviceUpdates += 1;

    console.info(
      JSON.stringify({
        event: 'backfill_seo_service_updated',
        slug: site.slug,
        serviceSlug: page.serviceSlug,
        titleLength: fixed.seo?.title?.length ?? 0,
        titleValid: isValidSeoTitle(fixed.seo?.title),
      }),
    );
  }

  if (Object.keys(updates).length > 0) {
    await prisma.generatedSite.update({
      where: { id: site.id },
      data: updates,
    });
  }

  if (Object.keys(updates).length === 0 && locationUpdates === 0 && serviceUpdates === 0) {
    console.info(JSON.stringify({ event: 'backfill_seo_skipped', slug: site.slug }));
  }
}

async function main() {
  const targetSlug = process.argv[2]?.trim();

  const sites = await prisma.generatedSite.findMany({
    where: targetSlug ? { slug: targetSlug } : undefined,
    orderBy: { createdAt: 'asc' },
  });

  if (sites.length === 0) {
    console.warn(JSON.stringify({ event: 'backfill_seo_no_sites', targetSlug: targetSlug ?? null }));
    return;
  }

  console.info(JSON.stringify({ event: 'backfill_seo_start', count: sites.length }));

  for (const site of sites) {
    await backfillSite(site);
  }

  console.info(JSON.stringify({ event: 'backfill_seo_complete', count: sites.length }));
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: 'backfill_seo_error',
        error: error?.message ?? String(error),
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
