/**
 * One-off migration for existing generated sites.
 *
 * Older sites were created when the services page schema seeded generic
 * placeholder titles ("Core Service", "Specialty Service", ...) which the model
 * echoed verbatim, and when the home service list was generated independently
 * from the services page (so their slugs never matched the dedicated service
 * pages).
 *
 * This script regenerates ONLY the services page content with the corrected,
 * business-specific prompt, then derives the home "Our Services" section from
 * that authoritative list so every home card links to a real service page. It
 * intentionally leaves about / blog / contact / theme content untouched.
 *
 * Stale ServicePage cache rows are removed so dedicated pages regenerate from
 * the new service titles on first visit.
 *
 * Usage: node src/scripts/backfillServices.js [siteSlug]
 *   - with no argument: processes every generated site
 *   - with a slug: processes just that site
 */
import prisma from '../database/client.js';
import { getSchemaForIndustry } from '../services/industrySchema.service.js';
import {
  generatePageContent,
  syncHomeServicesWithServices,
} from '../services/siteGenerator.service.js';

function parseJsonSafe(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
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

  const servicesResult = await generatePageContent(
    businessData,
    schema.servicesPageSchema,
    schema.systemPrompt,
    'services',
  );

  const existingHome = parseJsonSafe(site.homeContent);
  const syncedHome = syncHomeServicesWithServices(existingHome, servicesResult);

  await prisma.$transaction([
    prisma.servicePage.deleteMany({ where: { siteId: site.id } }),
    prisma.generatedSite.update({
      where: { id: site.id },
      data: {
        servicesContent: JSON.stringify(servicesResult),
        homeContent: JSON.stringify(syncedHome),
      },
    }),
  ]);

  const titles = (servicesResult.services ?? []).map((s) => s.title);
  console.info(
    JSON.stringify({ event: 'backfill_services_done', slug: site.slug, count: titles.length, titles }),
  );
}

async function main() {
  const targetSlug = process.argv[2]?.trim();

  const sites = await prisma.generatedSite.findMany({
    where: targetSlug ? { slug: targetSlug } : undefined,
    orderBy: { createdAt: 'asc' },
  });

  if (sites.length === 0) {
    console.warn(JSON.stringify({ event: 'backfill_services_no_sites', targetSlug: targetSlug ?? null }));
    return;
  }

  console.info(JSON.stringify({ event: 'backfill_services_start', total: sites.length }));

  let succeeded = 0;
  let failed = 0;

  // Sequential to stay well under OpenAI rate limits.
  for (const site of sites) {
    try {
      await backfillSite(site);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          event: 'backfill_services_failed',
          slug: site.slug,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  console.info(
    JSON.stringify({ event: 'backfill_services_complete', total: sites.length, succeeded, failed }),
  );
}

main()
  .catch((e) => {
    console.error(
      JSON.stringify({ event: 'backfill_services_fatal', error: e?.message ?? String(e) }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
