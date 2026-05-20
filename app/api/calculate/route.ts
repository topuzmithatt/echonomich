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
      } else if (/(restoran|yemek|kafe|cafe|pizza|burger|yemeksepeti|lokanta|döner|pastane|mado|starbucks|kahve|fast\s*food)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Yemek & Restoran');
        if (found) targetCategoryId = found.id;
      } else if (/(market|gida|gıda|süpermarket|supermarket|migros|sok|şok|bim|a101|carrefour|getir|şarküteri|manav|kasap|istegelsin)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Market');
        if (found) targetCategoryId = found.id;
      } else if (/(seyahat|turizm|otel|tatil|ucak|uçak|tur|konaklama|touristica|coral|jolly|ets|fly|uçuş|kiralama|rent\s*a\s*car|havayolu|thy|pegasus|turna)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Seyahat & Turizm');
        if (found) targetCategoryId = found.id;
      } else if (/(giyim|moda|aksesuar|ayakkabi|ayakkabı|koton|lcw|zara|derimod|flo|boyner|kuyum|mücevher|elbise|pantolon|mont|lc\s*waikiki|defacto)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Giyim & Aksesuar');
        if (found) targetCategoryId = found.id;
      } else if (/(trendyol|hepsiburada|n11|amazon|pazarama|ciceksepeti|çiçeksepeti|e-ticaret|eticaret|online\s*alisveris|online\s*alışveriş)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'E-Ticaret');
        if (found) targetCategoryId = found.id;
      } else if (/(elektronik|teknoloji|beyaz esya|beyaz eşya|telefon|bilgisayar|tv|televizyon|mediamarkt|teknosa|vatan|samsung|dyson|klima|kombi|viessmann|arçelik|beko|bosch)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Elektronik & Beyaz Eşya');
        if (found) targetCategoryId = found.id;
      } else if (/(eğitim|egitim|okul|kitap|kırtasiye|kirtasiye|kurs|üniversite|universite|kolej|akademik|ders)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Eğitim & Kırtasiye');
        if (found) targetCategoryId = found.id;
      } else if (/(mobilya|dekorasyon|yapi\s*market|yapı\s*market|inşaat|ısıtma|soğutma|ev\s*tekstili|züccaciye|porland|karaca|koçtaş|koctas|bauhaus|ikea|istikbal|bellona|kelebek)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Ev, Dekorasyon & Yapı Market');
        if (found) targetCategoryId = found.id;
      } else if (/(sağlık|saglik|eczane|optik|kozmetik|petshop|veteriner|pet|güzellik|kuaför|berber|diş|hastane|muayene|gratis|watsons|sephora|rossmann)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Sağlık & Kozmetik');
        if (found) targetCategoryId = found.id;
      } else if (/(kültür|sanat|sinema|tiyatro|konser|bilet|biletinial|oyun|gaming|game|playstation|xbox|nintendo|steam|pubg|etkinlik|müze|eğlence|eglence)/i.test(searchText)) {
        const found = categories.find(c => c.name === 'Kültür, Sanat & Eğlence');
        if (found) targetCategoryId = found.id;
      }
    }

    // E-Ticaret / Online alışveriş araması tespiti (QR fiziksel POS gerektirir, online'da geçersiz)
    const isOnlineSearch = /(e-ticaret|eticaret|internet|online|web|hepsiburada|trendyol|n11|amazon|pazarama|ciceksepeti|çiçeksepeti|getir|yemeksepeti|migros\s*sanal|sanal\s*market)/i.test(searchText);

    // ─────────────────────────────────────────────────────────────────
    // TEMEL KURAL: Kampanyaları sadece harcama tutarına ve (varsa) ödül
    // türüne göre çek. Kategori/QR filtrelerini JS katmanında uygula.
    // Bu sayede "QR içerdiği için her yerde göster" saçmalığından kurtuluruz.
    // ─────────────────────────────────────────────────────────────────
    const qualifiedCampaigns = await prisma.campaign.findMany({
      where: {
        AND: [
          // Harcama limit koşulu
          {
            OR: [
              { minAmount: { lte: amount } },
              { minAmount: 0 }
            ]
          },
          // İstenen ödül türleri
          ...(rewardTypes && rewardTypes.length > 0 ? [{ rewardType: { in: rewardTypes } }] : [])
        ]
      },
      include: {
        bank: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        campaignCards: true,
      },
    });

    const queryWords = searchText ? searchText.split(/\s+/).filter(w => w.length > 1) : [];

    const formattedCampaigns = qualifiedCampaigns
      .map((campaign) => {
        const combinedTextForTip = `${campaign.title} ${campaign.rawText}`.toLowerCase();

        // ─── QR/Temassız ödeme yöntemi tespiti ───
        const isQRorNFC = /qr\s*kod|qr\s*ile|qr\s*ödeme|karekod|nfc|mobil\s*temassız|mobil\s*temassiz/i.test(combinedTextForTip);
        const isOnlineOnlyCampaign = /internette|internet\s*üzerinden|online\s*alışveriş|web\s*sitesi/i.test(combinedTextForTip);
        const isPhysicalOnlyQR = isQRorNFC && !isOnlineOnlyCampaign;

        // E-ticaret aramalarında fiziki POS gerektiren QR kampanyaları gösterilmez
        if (isOnlineSearch && isPhysicalOnlyQR) {
          return null;
        }

        // ─── Kampanyanın "Genel / Evrensel" mi yoksa "Sektöre Özel" mi olduğunu belirle ───
        //
        // Bir kampanya ANCAK aşağıdaki durumların birinde evrensel sayılır:
        //   1. "her alışveriş / her harcama / sektör fark etmeksizin" gibi ifade içeriyorsa
        //   2. "Diğer" kategorisinde ve spesifik sektör/marka adı YOKSA
        //
        // QR içermesi tek başına evrensellik ANLAMINA GELMEZ.
        // "Shell'de QR ile ödeme" → Akaryakıt kategorisine özel, yemek aramasında çıkmamalı.
        // "Tüm harcamalarınıza QR ile ekstra puan" → Genel, her kategoride çıkabilir.

        const hasGeneralSpendKeywords = /her\s*(?:alışveriş|harcama)|alışverişlerinize|harcamalarınıza|sektör\s*fark\s*etmeksizin|sektör\s*dışı|tüm\s*(?:alışveriş|harcama|pos|üye\s*iş)/i.test(combinedTextForTip);

        // Belirli bir sektöre/markaya bağlı kelimeler — bunlar varsa kampanya evrensel değildir
        const nicheKeywordsRegex = /\b(akaryakıt|yakıt|benzin|mazot|motorin|otogaz|lpg|opet|shell|total|bp|petrol\s*ofisi|mobilya|dekorasyon|yapı\s*market|koçtaş|bauhaus|ikea|istikbal|bellona|kelebek|kitap|kırtasiye|eğitim|okul|kurs|üniversite|netflix|spotify|youtube|amazon|prime|sinema|tiyatro|konser|bilet|biletinial|oyun\s*platformu|gaming\s*platform|playstation|xbox|nintendo|steam|sigorta|vergi\s*ödeme|fatura|aidat|kira|tapu|bağış|sağlık|eczane|optik|kozmetik|petshop|veteriner|pet\s*shop|kuaför|berber|güzellik\s*merkezi|hastane|muayene|giyim|moda\s*marka|ayakkabı\s*(?:mağaza|markası)|aksesuar|otomotiv|lastik\s*(?:değişim|alım)|araç\s*bakım|araç\s*servis|araç\s*kiralama|rent\s*a\s*car|otel\s*(?:konakla|rezervasyon)|tatil\s*(?:paket|konaklama)|uçak\s*bileti|turizm\s*acent|seyahat\s*(?:acent|şirket)|elektronik\s*(?:mağaza|ürün)|beyaz\s*eşya|teknosa|mediamarkt|vatan\s*bilgisayar|migros|carrefour|şok\s*market|bim\b|a101|trendyol|hepsiburada|n11\.com|pazarama|çiçeksepeti)\b/i;

        const hasNicheKeywords = nicheKeywordsRegex.test(combinedTextForTip);

        // Kampanya kategorisi hedef kategoriye ait mi?
        const isInTargetCategory = !targetCategoryId || campaign.categoryId === targetCategoryId;

        // "Diğer" kategorisindeki genel kampanya: spesifik marka/sektör yoksa evrensel
        const isDiğerUniversal = campaign.category.name === 'Diğer' && hasGeneralSpendKeywords && !hasNicheKeywords;

        // QR içeren ama genel ifade taşıyan kampanya: evrensel
        // Örn: "Tüm harcamalarınıza QR ile 50 TL bonus" → evrensel
        // Örn: "Shell'de QR ile 50 TL bonus" → evrensel DEĞİL (niche kelime var)
        const isQRUniversal = isQRorNFC && hasGeneralSpendKeywords && !hasNicheKeywords;

        const isUniversalCampaign = isDiğerUniversal || isQRUniversal;

        // ─── Kategori Filtresi ───
        // Hedef kategori seçildiyse: kampanya ya o kategoriye ait olmalı ya da gerçekten evrensel olmalı
        if (targetCategoryId && !isInTargetCategory && !isUniversalCampaign) {
          return null;
        }

        // ─── Ödül Hesaplama ───
        let calculatedReward = campaign.rewardAmount;
        if (campaign.isPercentage) {
          calculatedReward = amount * (campaign.rewardAmount / 100);
          if (campaign.maxAmount && campaign.maxAmount > 0) {
            calculatedReward = Math.min(calculatedReward, campaign.maxAmount);
          }
        }

        // ─── Ödeme yöntemi ipucu ───
        let paymentMethodTip: string | null = null;
        if (isQRorNFC) {
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

        // ─── Alaka Skoru (Match Score) ───
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
            // 3. Başlıkta eşleşme → büyük bonus
            if (titleLower.includes(word)) {
              matchScore += 500;
            }
          });

          // 4. Hedef kategoriye ait kampanya → alaka bonusu
          if (isInTargetCategory && targetCategoryId) {
            matchScore += 30;
          }

          // 5. Evrensel kampanya taban puanı (arama varsa bile göster)
          if (matchScore === 0 && isUniversalCampaign) {
            matchScore = 10;
          }
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
      })
      .filter((c): c is any => c !== null);

    // Sıralama: önce alaka skoru, sonra ödül miktarı
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
