import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const API_KEY_BY_GHL_LOCATION_ID = [
  {
    ghlLocationId: '4diJ9Q8sTqY55I5ihUD7',
    label: '551 HVAC',
    ghlApiKey: 'pit-4445c3fc-2952-43c3-b930-2a03e7d6448c',
  },
  {
    ghlLocationId: 'NDYfMNSuMjNJz3N2CjPd',
    label: 'Bergen Car',
    ghlApiKey: 'pit-f752c522-6eac-4fb2-b107-fcc3ec3ca61e',
  },
  {
    ghlLocationId: 'cFaTJXAmUqSLpoaxQ2fn',
    label: 'Biz Solutions INC',
    ghlApiKey: 'pit-ab3fc3a4-8a98-4175-aa08-f9b692872a14',
  },
];

async function main() {
  for (const { ghlLocationId, label, ghlApiKey } of API_KEY_BY_GHL_LOCATION_ID) {
    try {
      const location = await prisma.location.update({
        where: { ghlLocationId },
        data: { ghlApiKey },
        include: { business: { select: { name: true } } },
      });
      console.log(
        `OK ${label} (${ghlLocationId}) → business="${location.business.name}" id=${location.id} ghlApiKey set`,
      );
    } catch (e) {
      if (e.code === 'P2025') {
        console.error(`SKIP ${label} (${ghlLocationId}) — location not found in database`);
      } else {
        console.error(`FAIL ${label} (${ghlLocationId}):`, e.message);
      }
    }
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
