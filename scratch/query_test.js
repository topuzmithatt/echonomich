const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const amount = 750;
  const searchText = "yemek";
  
  const categories = await prisma.category.findMany();
  // Let's find target category for "yemek"
  const marketCategory = categories.find(c => c.name === 'Market');
  const targetCategoryId = marketCategory ? marketCategory.id : null;
  
  console.log(`targetCategoryId (Market): ${targetCategoryId}`);

  const qualifiedCampaigns = await prisma.campaign.findMany({
    where: {
      AND: [
        {
          OR: [
            ...(targetCategoryId ? [{ categoryId: targetCategoryId }] : []),
            {
              category: {
                name: 'Diğer'
              }
            },
            { title: { contains: 'QR' } },
            { title: { contains: 'temassız' } },
            { title: { contains: 'NFC' } },
            { title: { contains: 'karekod' } },
            { title: { contains: 'mobil ödeme' } },
            { rawText: { contains: 'QR' } },
            { rawText: { contains: 'temassız' } },
            { rawText: { contains: 'NFC' } },
            { rawText: { contains: 'karekod' } },
            { rawText: { contains: 'mobil ödeme' } },
          ]
        },
        {
          OR: [
            { minAmount: { lte: amount } },
            { minAmount: 0 }
          ]
        }
      ]
    },
    include: {
      bank: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    }
  });

  console.log(`Qualified campaigns count from DB: ${qualifiedCampaigns.length}`);
  
  const queryWords = ["yemek"];
  const formatted = qualifiedCampaigns.map(campaign => {
    const lowerTitle = campaign.title.toLowerCase();
    const lowerText = campaign.rawText.toLowerCase();
    const combinedText = `${lowerTitle} ${lowerText}`;

    const isPaymentUniversal = /qr\s*kod|qr\s*ile|qr\s*ödeme|karekod|nfc|mobil\s*temassız|mobil\s*temassiz|temassız\s*ödeme/i.test(combinedText);
    const hasGeneralSpendKeywords = /her\s*(?:alışveriş|harcama)|alışverişlerinize|harcamalarınıza|sektör\s*fark\s*etmeksizin|sektör\s*dışı/i.test(combinedText);
    
    // Comprehensive niche terms and brands regex
    const hasNicheKeywords = /kitap|kırtasiye|eğitim|okul|dijital\s*platform|netflix|spotify|youtube|amazon|prime|kültür|sanat|tiyatro|sinema|konser|bilet|biletinial|sigorta|vergi|mtv|motorlu\s*taşıt|fatura|aidat|kira|tapu|bağış|mobilya|dekorasyon|yapı\s*market|beyaz\s*eşya|optik|sağlık|eczane|otomotiv|lastik|servis|araç\s*kiralama|kiralama|otel|tatil|uçak|turizm|seyahat|giyim|ayakkabı|aksesuar|kozmetik|elektronik|teknoloji|akaryakıt|yakıt|benzin|istasyon|oyun|gaming|game|tasarım|yazılım|oto|yıkama|petshop|veteriner|pet|spa|kuaför|güzellik|hizmet|kargo|kurye|finans|kredi|porland|dyson|karaca|samsung|trendyol|hepsiburada|n11|getir|yemeksepeti|watsons|gratis|boyner|lcw|koton|zara|defacto|flo|ipekyol|hm|decathlon|ikea|uber|starbucks|kahve|mado|kahve\s*dünyası/i.test(combinedText);

    // Only allow Diğer category campaigns to qualify as general spend universal campaigns!
    const isUniversalCampaign = isPaymentUniversal || (campaign.category.name === 'Diğer' && hasGeneralSpendKeywords && !hasNicheKeywords);

    // If a target category is specified, and the campaign is NOT in that category, it must be a universal campaign to be eligible!
    if (targetCategoryId && campaign.categoryId !== targetCategoryId && !isUniversalCampaign) {
      return null;
    }

    let matchScore = 0;
    const combinedSearchText = `${campaign.title} ${campaign.rawText} ${campaign.category.name} ${campaign.bank.name}`.toLowerCase();
    const titleLower = campaign.title.toLowerCase();

    if (combinedSearchText.includes(searchText)) {
      matchScore += 150;
    }

    queryWords.forEach(word => {
      if (combinedSearchText.includes(word)) {
        matchScore += 20;
      }
      if (titleLower.includes(word)) {
        matchScore += 500;
      }
    });

    if (matchScore === 0 && isUniversalCampaign) {
      matchScore = 10;
    }
    
    return {
      title: campaign.title,
      category: campaign.category.name,
      matchScore,
      isUniversal: isUniversalCampaign,
      rewardAmount: campaign.rewardAmount
    };
  }).filter(Boolean);
  
  console.log(`Eligible campaigns count: ${formatted.length}`);
  
  formatted.sort((a,b) => b.matchScore - a.matchScore || b.rewardAmount - a.rewardAmount);
  formatted.slice(0, 15).forEach((c, idx) => {
    console.log(`${idx+1}. Title: "${c.title}"`);
    console.log(`   Category: ${c.category}, matchScore: ${c.matchScore}, isUniversal: ${c.isUniversal}, reward: ${c.rewardAmount}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
