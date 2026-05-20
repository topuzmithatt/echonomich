import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const bankCardsData: Record<string, string[]> = {
  'Ziraat Bankası': ['Bankkart', 'Bankkart Genç', 'Bankkart Başak'],
  'Akbank Axess': ['Axess', 'Wings', 'Free'],
  'Garanti BBVA Bonus': ['Bonus', 'Miles & Smiles', 'Shop & Fly', 'Bonus Genç'],
  'Yapı Kredi World': ['Worldcard', 'Play', 'adios', 'Crystal'],
  'İş Bankası Maximum': ['Maximum', 'Maximiles', 'Maximum Genç'],
};

async function main() {
  console.log('--- KART TOHUMLAMA VE TASNİF SÜRECİ BAŞLADI ---');

  // 1. Banka kartlarını oluştur
  const dbBanks = await prisma.bank.findMany();
  if (dbBanks.length === 0) {
    console.log('Hata: Sistemde kayıtlı banka bulunamadı. Önce veri kazıyıcıyı veya seed dosyasını çalıştırın.');
    return;
  }

  const cardMap: Record<string, Record<string, string>> = {}; // bankId -> { cardName -> cardId }

  for (const bank of dbBanks) {
    const cardsToCreate = bankCardsData[bank.name];
    if (!cardsToCreate) {
      console.log(`Uyarı: ${bank.name} için kart tanımlaması bulunamadı.`);
      continue;
    }

    cardMap[bank.id] = {};
    console.log(`\n🏦 ${bank.name} için kartlar oluşturuluyor...`);

    for (const cardName of cardsToCreate) {
      const card = await prisma.card.upsert({
        where: {
          bankId_name: {
            bankId: bank.id,
            name: cardName,
          },
        },
        update: {},
        create: {
          name: cardName,
          bankId: bank.id,
        },
      });
      cardMap[bank.id][cardName] = card.id;
      console.log(`  - ${cardName} (ID: ${card.id})`);
    }
  }

  // 2. Kampanyaları tara ve spesifik kartlarla ilişkilendir
  console.log('\n🔍 Kampanyalar analiz ediliyor ve kartlara bağlanıyor...');
  const campaigns = await prisma.campaign.findMany({
    include: {
      bank: true,
      campaignCards: true,
    },
  });

  // Önceki tüm campaignCards eşleşmelerini temizle (temiz bir başlangıç için)
  await prisma.campaignCard.deleteMany({});

  let matchedCount = 0;
  let generalCount = 0;

  for (const campaign of campaigns) {
    const bankId = campaign.bankId;
    const bankName = campaign.bank.name;
    const combinedText = `${campaign.title} ${campaign.rawText}`.toLowerCase();
    const bankCards = cardMap[bankId];

    if (!bankCards) continue;

    let targetCardNames: string[] = [];

    // Bankaya özel kart filtreleme kuralları (Regex)
    if (bankName === 'Ziraat Bankası') {
      if (/\bgenç\b|\bgenc\b/i.test(combinedText)) {
        targetCardNames.push('Bankkart Genç');
      }
      if (/\bbaşak\b|\bbasak\b/i.test(combinedText)) {
        targetCardNames.push('Bankkart Başak');
      }
    } else if (bankName === 'Akbank Axess') {
      if (/\bwings\b/i.test(combinedText)) {
        targetCardNames.push('Wings');
      }
      if (/\bfree\b/i.test(combinedText)) {
        targetCardNames.push('Free');
      }
    } else if (bankName === 'Garanti BBVA Bonus') {
      if (/miles\s*&\s*smiles|miles&smiles/i.test(combinedText)) {
        targetCardNames.push('Miles & Smiles');
      }
      if (/shop\s*&\s*fly|shop&fly/i.test(combinedText)) {
        targetCardNames.push('Shop & Fly');
      }
      if (/\bgenç\b|\bgenc\b/i.test(combinedText)) {
        targetCardNames.push('Bonus Genç');
      }
    } else if (bankName === 'Yapı Kredi World') {
      if (/\bplay\b/i.test(combinedText)) {
        targetCardNames.push('Play');
      }
      if (/\badios\b/i.test(combinedText)) {
        targetCardNames.push('adios');
      }
      if (/\bcrystal\b/i.test(combinedText)) {
        targetCardNames.push('Crystal');
      }
    } else if (bankName === 'İş Bankası Maximum') {
      if (/\bmaximiles\b/i.test(combinedText)) {
        targetCardNames.push('Maximiles');
      }
      if (/\bgenç\b|\bgenc\b/i.test(combinedText)) {
        targetCardNames.push('Maximum Genç');
      }
    }

    if (targetCardNames.length > 0) {
      // Eşleşen kartları veritabanında bu kampanyaya bağla
      for (const cardName of targetCardNames) {
        const cardId = bankCards[cardName];
        if (cardId) {
          await prisma.campaignCard.create({
            data: {
              campaignId: campaign.id,
              cardId: cardId,
            },
          });
        }
      }
      matchedCount++;
      console.log(`[ÖZEL] "${campaign.title}" -> Eşleşen: ${targetCardNames.join(', ')}`);
    } else {
      // Eğer spesifik kart eşleşmediyse genel kampanyadır, boş bırakıyoruz (tüm kartlarda geçerli)
      generalCount++;
    }
  }

  console.log(`\n📊 Eşleştirme Raporu:`);
  console.log(`  - Toplam Taranan Kampanya: ${campaigns.length}`);
  console.log(`  - Kart Özel Kampanya Sayısı (Spesifik): ${matchedCount}`);
  console.log(`  - Genel Banka Kampanyası Sayısı (Tüm Kartlar): ${generalCount}`);
  console.log('\n✅ Kart tohumlama ve tasnif başarıyla tamamlandı!');
}

main()
  .catch((e) => {
    console.error('Tohumlama hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
