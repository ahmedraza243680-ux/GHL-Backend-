import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SEED_BUSINESSES = [
  { name: 'Bergen Car Company', ghlAccountId: 'bergen-car' },
  { name: '551 HVAC', ghlAccountId: '551-hvac' },
  { name: 'Biz Solutions INC', ghlAccountId: 'biz-solutions' },
];

const SEED_LOCATIONS = [
  {
    ghlLocationId: '4diJ9Q8sTqY55I5ihUD7',
    businessIndex: 0,
    timezone: 'America/New_York',
  },
  {
    ghlLocationId: 'NDYfMNSuMjNJz3N2CjPd',
    businessIndex: 1,
    timezone: 'America/New_York',
  },
  {
    ghlLocationId: 'cFaTJXAmUqSLpoaxQ2fn',
    businessIndex: 2,
    timezone: 'America/New_York',
  },
];

/** All ghl account + location ids we ever used in seeds (cleanup) */
const CLEANUP_GHL_ACCOUNT_IDS = [
  'bergen-car',
  '551-hvac',
  'biz-solutions',
  'seed-bergen-car-company',
];
const CLEANUP_GHL_LOCATION_IDS = [
  '4diJ9Q8sTqY55I5ihUD7',
  'NDYfMNSuMjNJz3N2CjPd',
  'cFaTJXAmUqSLpoaxQ2fn',
  'seed-bergen-main-location',
];

async function main() {
  await prisma.location.deleteMany({
    where: { ghlLocationId: { in: CLEANUP_GHL_LOCATION_IDS } },
  });
  await prisma.business.deleteMany({
    where: { ghlAccountId: { in: CLEANUP_GHL_ACCOUNT_IDS } },
  });

  const businesses = [];
  for (const b of SEED_BUSINESSES) {
    businesses.push(
      await prisma.business.create({
        data: {
          name: b.name,
          status: 'ACTIVE',
          ghlAccountId: b.ghlAccountId,
        },
      }),
    );
  }

  const locations = [];
  for (const loc of SEED_LOCATIONS) {
    const business = businesses[loc.businessIndex];
    locations.push(
      await prisma.location.create({
        data: {
          businessId: business.id,
          ghlLocationId: loc.ghlLocationId,
          status: 'ACTIVE',
          requiresApproval: false,
          timezone: loc.timezone,
        },
      }),
    );
  }

  console.log('Seeded businesses (name / ghlAccountId / id):');
  for (const b of businesses) {
    console.log(`  ${b.name} | ${b.ghlAccountId} | ${b.id}`);
  }
  console.log('Seeded locations (ghlLocationId / id / businessId):');
  for (const loc of locations) {
    console.log(`  ${loc.ghlLocationId} | ${loc.id} | ${loc.businessId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
