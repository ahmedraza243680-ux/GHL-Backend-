import prisma from '../database/client.js';
import { generateLocationPageImage } from '../services/locationPage.service.js';

async function main() {
  const pages = await prisma.locationPage.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: '' }],
    },
    include: { site: true },
    orderBy: { createdAt: 'asc' },
  });

  if (pages.length === 0) {
    console.info(JSON.stringify({ event: 'location_images_backfill_skipped', reason: 'none_missing' }));
    return;
  }

  console.info(JSON.stringify({ event: 'location_images_backfill_start', count: pages.length }));

  let updated = 0;
  let failed = 0;

  for (const page of pages) {
    const location = { city: page.city, county: page.county, state: page.state };
    const imageUrl = await generateLocationPageImage(location, page.site);

    if (!imageUrl) {
      failed += 1;
      console.warn(
        JSON.stringify({
          event: 'location_images_backfill_failed',
          siteSlug: page.site.slug,
          locationSlug: page.slug,
          city: page.city,
        }),
      );
      continue;
    }

    await prisma.locationPage.update({
      where: { id: page.id },
      data: { imageUrl },
    });

    updated += 1;
    console.info(
      JSON.stringify({
        event: 'location_images_backfill_updated',
        siteSlug: page.site.slug,
        locationSlug: page.slug,
        city: page.city,
      }),
    );
  }

  console.info(
    JSON.stringify({
      event: 'location_images_backfill_complete',
      updated,
      failed,
      total: pages.length,
    }),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: 'location_images_backfill_error',
        error: error?.message ?? String(error),
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
