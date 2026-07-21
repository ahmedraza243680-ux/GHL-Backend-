/**
 * Purges the Next.js ISR cache for one or all sites after backend content changes.
 *
 * Usage:
 *   node src/scripts/revalidateSiteCache.js [siteSlug]
 *
 * Requires REVALIDATE_SECRET and SITE_FRONTEND_URL in backend .env
 * (same REVALIDATE_SECRET must be set on the peakwa-sites Vercel project).
 */
import prisma from '../database/client.js';
import { revalidateSiteFrontendCache } from '../services/siteRevalidation.service.js';

async function main() {
  const targetSlug = process.argv[2]?.trim();

  if (targetSlug) {
    await revalidateSiteFrontendCache(targetSlug);
    return;
  }

  const sites = await prisma.generatedSite.findMany({
    select: { slug: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const site of sites) {
    await revalidateSiteFrontendCache(site.slug);
  }

  console.info(JSON.stringify({ event: 'revalidate_all_complete', count: sites.length }));
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: 'revalidate_all_error',
        error: error?.message ?? String(error),
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
