import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const qrCampaigns = await prisma.campaign.findMany({
    where: {
      OR: [
        { title: { contains: 'QR' } },
        { rawText: { contains: 'QR' } },
        { title: { contains: 'mobil' } },
        { rawText: { contains: 'mobil' } },
        { title: { contains: 'temassız' } },
        { rawText: { contains: 'temassız' } },
        { title: { contains: 'NFC' } },
        { rawText: { contains: 'NFC' } },
      ],
    },
    include: {
      bank: true,
    },
  });

  console.log(`Toplam QR/Mobil/Temassız Kampanya Sayısı: ${qrCampaigns.length}`);
  console.log('\nİlk 15 kampanya örneği:');
  qrCampaigns.slice(0, 15).forEach((c, idx) => {
    console.log(`\n${idx + 1}. [${c.bank.name}] ${c.title}`);
    console.log(`   Min Tutar: ${c.minAmount} TL | Ödül: ${c.rewardAmount} TL (${c.rewardType})`);
    console.log(`   Özet: ${c.rawText.split('\n')[0]}`);
  });
}

main().finally(() => prisma.$disconnect());
