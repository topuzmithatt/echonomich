import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUser } from '../../../lib/auth';

// API İstek gövdesinin (body) arayüzü
interface CalculationRequest {
  amount: number;
  queryText?: string;
  categoryId?: string;
  rewardTypes?: string[];
}

/**
 * Harcama tutarı ve arama sorgusuna/kategorisine göre en uygun kampanyaları hesaplayıp sıralayan API.
 * Route: POST /api/calculate
 */
export async function POST(req: NextRequest) {
  try {
    const body: CalculationRequest = await req.json();
    const { amount, queryText, categoryId, rewardTypes } = body;

    const user = await getAuthUser();
    const isLoggedIn = !!user;
    const ownedCardIds = user ? user.userCards.map(uc => uc.cardId) : [];
    const ownedBankIds = user ? Array.from(new Set(user.userCards.map(uc => uc.card.bankId))) : [];

    // Temel validasyonlar
    if (amount === undefined || typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz harcama tutarı. Lütfen pozitif bir sayısal değer girin.' },
        { status: 400 }
      );
    }

    // Sistemdeki tüm kategorileri çekiyoruz
    const categories = await prisma.category.findMany();

    let targetCategoryId = categoryId || undefined;
    const searchText = queryText ? queryText.toLowerCase().trim() : '';

    // Akıllı arama terimi - Kategori eşleştirmesi
    if (searchText && !targetCategoryId) {
      if (/(akaryakit|akaryakıt|yakit|yakıt|benzin|mazot|motorin|otogaz|istasyon|lpg|opet|shell|total|bp|petrol)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Akaryakıt');
        if (found) targetCategoryId = found.id;
      } else if (/(market|gida|gıda|süpermarket|supermarket|migros|sok|şok|bim|a101|carrefour|restoran|yemek|kafe|cafe|pizza|burger|yemeksepeti|getir)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Market');
        if (found) targetCategoryId = found.id;
      } else if (/(seyahat|turizm|otel|tatil|ucak|uçak|bilet|tur|konaklama|touristica|coral|jolly|ets)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Seyahat');
        if (found) targetCategoryId = found.id;
      } else if (/(giyim|moda|aksesuar|ayakkabi|ayakkabı|koton|lcw|zara|derimod|flo|boyner)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Giyim');
        if (found) targetCategoryId = found.id;
      } else if (/(elektronik|teknoloji|beyaz esya|beyaz eşya|telefon|bilgisayar|tv|televizyon|klima|vatan|teknosa|mediamarkt|daikin)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Elektronik');
        if (found) targetCategoryId = found.id;
      }
    }

    // Kampanyaları getiriyoruz (Harcama tutarına uyanlar VEYA minimum limit gerektirmeyen ücretsiz ayrıcalıklar)
    const qualifiedCampaigns = await prisma.campaign.findMany({
      where: {
        ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
        OR: [
          {
            minAmount: {
              lte: amount,
            },
          },
          {
            minAmount: 0,
          },
        ],
        ...(rewardTypes && rewardTypes.length > 0 ? { rewardType: { in: rewardTypes } } : {}),
      },
      include: {
        bank: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        campaignCards: true,
      },
    });

    const queryWords = searchText ? searchText.split(/\s+/).filter(w => w.length > 1) : [];

    // Sonuçları dinamik ödül ve alaka düzeyine göre puanlıyoruz
    const formattedCampaigns = qualifiedCampaigns.map((campaign) => {
      let calculatedReward = campaign.rewardAmount;
      if (campaign.isPercentage) {
        calculatedReward = amount * (campaign.rewardAmount / 100);
        if (campaign.maxAmount && campaign.maxAmount > 0) {
          calculatedReward = Math.min(calculatedReward, campaign.maxAmount);
        }
      }

      // Ödeme yöntemi ve ek puan ipucu tespiti
      let paymentMethodTip: string | null = null;
      const combinedTextForTip = `${campaign.title} ${campaign.rawText}`.toLowerCase();
      if (/qr\s*kod|qr\s*ile|qr\s*ödeme/i.test(combinedTextForTip)) {
        paymentMethodTip = '📱 QR Kod ile Ödeme Avantajı';
      } else if (/mobil\s*temassız|nfc|mobil\s*ödeme/i.test(combinedTextForTip)) {
        paymentMethodTip = '📲 Mobil Temassız / NFC Ödeme Avantajı';
      } else if (/temassız\s*ödeme/i.test(combinedTextForTip)) {
        paymentMethodTip = '💳 Temassız Ödeme Avantajı';
      } else if (/garantipay/i.test(combinedTextForTip)) {
        paymentMethodTip = '🟢 GarantiPay ile Ödeme Avantajı';
      }

      const isFreePrivilege = campaign.minAmount === 0 || 
        /\bücretsiz\b|\bbedava\b|hediye\s*ders|hediye\s*üyelik|hediye\s*prime/i.test(campaign.title.toLowerCase());

      // Alaka düzeyi puanı hesaplama (Match Score)
      let matchScore = 0;
      if (searchText) {
        const combinedSearchText = `${campaign.title} ${campaign.rawText} ${campaign.category.name} ${campaign.bank.name}`.toLowerCase();
        const titleLower = campaign.title.toLowerCase();

        // 1. Birebir kelime grubu eşleşmesi
        if (combinedSearchText.includes(searchText)) {
          matchScore += 150;
        }

        // 2. Kelime bazlı eşleşmeler
        queryWords.forEach(word => {
          if (combinedSearchText.includes(word)) {
            matchScore += 20;
          }
          // 3. Marka/Başlık eşleşmesi (Arama terimindeki kelime başlıktaysa büyük bonus)
          if (titleLower.includes(word)) {
            matchScore += 500;
          }
        });
      }

      return {
        id: campaign.id,
        title: campaign.title,
        rawText: campaign.rawText,
        rewardAmount: campaign.rewardAmount,
        calculatedReward: Number(calculatedReward.toFixed(2)),
        rewardType: campaign.rewardType,
        isPercentage: campaign.isPercentage,
        minAmount: campaign.minAmount,
        maxAmount: campaign.maxAmount,
        isNewCustomerOnly: campaign.isNewCustomerOnly,
        requiresEnrollment: campaign.requiresEnrollment,
        matchScore: matchScore,
        isFreePrivilege,
        paymentMethodTip,
        isOwnedByUser: (() => {
          if (!isLoggedIn) return true;
          const campaignCardIds = campaign.campaignCards.map((cc) => cc.cardId);
          if (campaignCardIds.length > 0) {
            return campaignCardIds.some((id) => ownedCardIds.includes(id));
          }
          return ownedBankIds.includes(campaign.bank.id);
        })(),
        bank: {
          id: campaign.bank.id,
          name: campaign.bank.name,
        },
        category: {
          id: campaign.category.id,
          name: campaign.category.name,
        },
        warningTags: {
          newCustomerWarning: campaign.isNewCustomerOnly ? 'Yalnızca yeni müşterilere özel' : null,
          enrollmentWarning: campaign.requiresEnrollment ? 'Katılım / Başvuru gerektirir' : null,
        },
      };
    });

    // Sıralama kriteri: Önce en yüksek arama eşleşmesi (alaka), sonra en yüksek ödül
    formattedCampaigns.sort((a, b) => b.matchScore - a.matchScore || b.calculatedReward - a.calculatedReward);

    let finalCampaigns = formattedCampaigns;
    if (searchText) {
      finalCampaigns = formattedCampaigns.filter(c => c.matchScore > 0);
    }

    return NextResponse.json({
      success: true,
      amount,
      categoryId: targetCategoryId || null,
      resultCount: finalCampaigns.length,
      bestOffer: finalCampaigns[0] || null,
      campaigns: finalCampaigns,
      isLoggedIn,
      ownedBankIds,
    });

  } catch (error: any) {
    console.error('Hesaplama motoru API hatası:', error.message);
    return NextResponse.json(
      { success: false, error: 'Hesaplama motoru çalışırken bir hata oluştu.', details: error.message },
      { status: 500 }
    );
  }
}
