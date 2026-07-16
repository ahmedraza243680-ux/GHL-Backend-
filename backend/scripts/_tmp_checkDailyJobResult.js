import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

const POST_IDS = [
  'cmrn3wq9u0001p0e0t2o6bg7j',
  'cmrn3wxl90007p0e0ypo55466',
  'cmrn3x4rh000dp0e0zzkgkou8',
];

async function main() {
  const posts = await prisma.post.findMany({
    where: { id: { in: POST_IDS } },
    include: { location: { include: { business: true } } },
  });

  for (const p of posts) {
    const towns = p.location.serviceAreaTowns ?? [];
    const usedTown = towns.find((t) => p.content.toLowerCase().includes(t.toLowerCase())) ?? null;
    console.log(JSON.stringify({
      businessName: p.location.business.name,
      postId: p.id,
      status: p.status,
      type: p.type,
      postedAt: p.postedAt,
      content: p.content,
      serviceAreaTowns: towns,
      townUsedInPost: usedTown,
    }, null, 2));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
