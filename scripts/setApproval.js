import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const GHL_LOCATION_ID = '4diJ9Q8sTqY55I5ihUD7';

async function main() {
  const location = await prisma.location.update({
    where: { ghlLocationId: GHL_LOCATION_ID },
    data: { requiresApproval: true },
    include: { business: { select: { name: true } } },
  });

  console.log('Updated location:');
  console.log(JSON.stringify(location, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
