import prisma from '../database/client.js';
import { sendCustomerWelcomeEmail } from './email.service.js';
import { generateDefaultLocationPagesForSite } from './locationPage.service.js';
import { revalidateSiteFrontendCache } from './siteRevalidation.service.js';

/**
 * Runs after the webhook responds — location pages, cache purge, welcome email.
 * Never blocks the HTTP response for site creation.
 */
export async function finalizeNewSite(siteId) {
  const site = await prisma.generatedSite.findUnique({
    where: { id: siteId },
    include: { template: true },
  });

  if (!site) {
    console.warn(JSON.stringify({ event: 'site_finalize_skipped', siteId, reason: 'not_found' }));
    return;
  }

  console.info(JSON.stringify({ event: 'site_finalize_start', siteId, slug: site.slug }));

  try {
    const locationPages = await generateDefaultLocationPagesForSite(site.id);
    if (locationPages.length > 0) {
      console.info(
        JSON.stringify({
          event: 'site_default_location_pages_created',
          siteId: site.id,
          slug: site.slug,
          count: locationPages.length,
        }),
      );
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: 'site_default_location_pages_failed',
        siteId: site.id,
        slug: site.slug,
        error: error?.message ?? String(error),
      }),
    );
  }

  await revalidateSiteFrontendCache(site.slug);
  await sendCustomerWelcomeEmail(site);

  console.info(JSON.stringify({ event: 'site_finalize_complete', siteId, slug: site.slug }));
}

export function scheduleSiteFinalization(siteId) {
  void finalizeNewSite(siteId).catch((error) => {
    console.error(
      JSON.stringify({
        event: 'site_finalize_unhandled',
        siteId,
        error: error?.message ?? String(error),
      }),
    );
  });
}
