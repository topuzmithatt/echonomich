import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: {
      OR: [
        { title: { contains: 'QR' } },
        { rawText: { contains: 'QR' } },
        { title: { contains: 'Genç' } },
        { rawText: { contains: 'Genç' } },
      ],
      bank: { name: 'Ziraat Bankası' }
    },
    include: {
      bank: true,
    },
  });

  console.log(`Ziraat QR/Genç Kampanya Sayısı: ${campaigns.length}`);
  campaigns.slice(0, 10).forEach((c, idx) => {
    console.log(`\n--- ${idx + 1}. ${c.title} ---`);
    console.log(c.rawText);
  });
}

main().finally(() => prisma.$disconnect());
