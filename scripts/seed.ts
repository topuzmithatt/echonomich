import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

// JSON dosya konumu
const CAMPAIGNS_JSON_PATH = path.join(process.cwd(), 'campaigns.json');

// Sektörleri ana kategorilere eşleyen yardımcı fonksiyon
function mapSectorToCategory(sector: string, title: string): string {
  const combined = `${sector} ${title}`.toLowerCase();
  
  // 1. Yapı market / İklimlendirme / Ev-Dekorasyon -> Diğer (Önce çalışmalı ki market kelimesiyle çakışmasın)
  if (
    combined.includes('yapı market') || 
    combined.includes('iklimlendirme') || 
    combined.includes('inşaat') || 
    combined.includes('dekorasyon') || 
    combined.includes('mobilya') ||
    combined.includes('ısıtma') ||
    combined.includes('soğutma') ||
    combined.includes('yapı dekorasyon')
  ) {
    return 'Diğer';
  }
  
  // 2. Akaryakıt / Otogaz / Yakıt / İstasyon
  if (combined.includes('akaryakıt') || combined.includes('otogaz') || combined.includes('yakıt') || combined.includes('istasyon')) {
    return 'Akaryakıt';
  }
  
  // 3. Market / Gıda / Süpermarket / Restoran / Yemek / Kafe / Cafe / Şarküteri
  if (
    combined.includes('market') || 
    combined.includes('gıda') || 
    combined.includes('süpermarket') || 
    combined.includes('restoran') || 
    combined.includes('yemek') || 
    combined.includes('kafe') || 
    combined.includes('cafe') ||
    combined.includes('şarküteri')
  ) {
    return 'Market';
  }
  
  // 4. Seyahat / Turizm / Otel / Tatil / Uçak / Tur / Konaklama
  if (combined.includes('seyahat') || combined.includes('turizm') || combined.includes('otel') || combined.includes('tatil') || combined.includes('uçak') || combined.includes('tur') || combined.includes('konaklama')) {
    return 'Seyahat';
  }
  
  // 5. Giyim / Moda / Aksesuar / Ayakkabı / Kozmetik
  if (combined.includes('giyim') || combined.includes('moda') || combined.includes('aksesuar') || combined.includes('ayakkabı') || combined.includes('kozmetik')) {
    return 'Giyim';
  }
  
  // 6. Elektronik / Teknoloji / Beyaz Eşya / Telefon / Bilgisayar / Tv / Cihaz
  if (combined.includes('elektronik') || combined.includes('teknoloji') || combined.includes('beyaz eşya') || combined.includes('telefon') || combined.includes('bilgisayar') || combined.includes('cihaz')) {
    return 'Elektronik';
  }
  
  return 'Diğer';
}

// Ham metinden min harcama miktarını ayıklayan regex tabanlı akıllı yardımcı fonksiyon
function extractMinAmount(title: string, subtitle: string, conditions: string[]): number {
  const combinedText = [title, subtitle, ...conditions].join(' ');
  const cleanText = combinedText.replace(/\./g, ''); // Binlik ayraç olan noktaları temizliyoruz

  // USD (Dolar) limiti kontrolü (Örn: "150$ ve üzeri", "150 USD")
  const usdMatch = cleanText.match(/(\d+)\s*(?:\$|usd|dolar)/i);
  if (usdMatch) {
    const usdVal = parseFloat(usdMatch[1]);
    if (usdVal >= 10) {
      return usdVal * 32.5; // Dolar kurunu 32.5 TL olarak varsayıp TL'ye çeviriyoruz
    }
  }

  // 1. Durum: Aralık eşleşmesi var mı kontrol et (Örn: "45.000 TL - 69.999 TL")
  const rangeMatch = cleanText.match(/(\d+)\s*TL\s*-\s*(\d+)\s*TL/i);
  if (rangeMatch) {
    const val = parseFloat(rangeMatch[1]);
    if (val >= 100) return val;
  }

  // 2. Durum: Eşik belirten ifadeler (Örn: "750 TL ve üzeri", "1.400 TL harcama")
  const regex = /(\d+)\s*(?:TL)?\s*(?:ve üzeri|üzeri|limiti|harcama|alışveriş|ve üstü|tutarında|tek seferde)/gi;
  let match;
  const values: number[] = [];

  while ((match = regex.exec(cleanText)) !== null) {
    const val = parseFloat(match[1]);
    // Mantıklı limit değerleri (19 Mayıs veya 4. harcama gibi küçük sayıları filtrelemek için)
    if (val >= 100 && val <= 250000) {
      values.push(val);
    }
  }

  if (values.length > 0) {
    return Math.min(...values);
  }

  // 3. Durum: Fallback - Düz TL ibarelerini arama
  const fallbackRegex = /(\d+)\s*TL/gi;
  const fallbackValues: number[] = [];
  while ((match = fallbackRegex.exec(cleanText)) !== null) {
    const val = parseFloat(match[1]);
    if (val >= 100 && val <= 250000) {
      fallbackValues.push(val);
    }
  }

  return fallbackValues.length > 0 ? Math.min(...fallbackValues) : 0;
}

// Ham metinden kazanılabilecek max ödülü ayıklayan yardımcı fonksiyon (Düz TL ödüller için)
function extractRewardAmount(title: string, subtitle: string, conditions: string[]): number {
  const combinedText = [title, subtitle, ...conditions].join(' ');
  const cleanText = combinedText.replace(/\./g, '');

  // "450 TL Bankkart Lira", "8.500 TL hediye" gibi kalıplar
  const regex = /(\d+)\s*(?:TL)?\s*(?:Bankkart Lira|indirim|iade|kazan|hediye|lira)/gi;
  let match;
  const rewards: number[] = [];

  while ((match = regex.exec(cleanText)) !== null) {
    const val = parseFloat(match[1]);
    if (val > 0 && val < 50000) {
      rewards.push(val);
    }
  }

  if (rewards.length > 0) {
    return Math.max(...rewards); // Kademeli ödüllerde en yüksek ödülü al
  }

  // Fallback: Başlıktaki TL değerine bak
  const titleMatch = title.replace(/\./g, '').match(/(\d+)\s*(?:TL)/i);
  if (titleMatch) {
    return parseFloat(titleMatch[1]);
  }

  return 0;
}

// Oransal (yüzdesel) indirimlerde üst limiti (Cap) belirlemek için yardımcı fonksiyon
function extractMaxAmount(conditions: string[]): number | null {
  const combinedText = conditions.join(' ');
  const cleanText = combinedText.replace(/\./g, '');

  // Dolar bazlı sınır (Örn: "en fazla 23$ nakit")
  const usdMaxMatch = cleanText.match(/en fazla\s*(\d+)\s*(?:\$|usd|dolar)/i);
  if (usdMaxMatch) {
    return parseFloat(usdMaxMatch[1]) * 32.5; // TL'ye çevir
  }

  // TL bazlı sınır (Örn: "en fazla 1.000 TL indirim")
  const tlMaxMatch = cleanText.match(/en fazla\s*(\d+)\s*TL/i);
  if (tlMaxMatch) {
    return parseFloat(tlMaxMatch[1]);
  }

  return null;
}

async function main() {
  console.log('=== Veritabanı Toplu Tohumlama (Offline Parser v2) Başlatılıyor ===');

  if (!fs.existsSync(CAMPAIGNS_JSON_PATH)) {
    console.error('Hata: campaigns.json dosyası bulunamadı!');
    process.exit(1);
  }

  // Kampanyaları oku
  const rawData = fs.readFileSync(CAMPAIGNS_JSON_PATH, 'utf-8');
  const campaignsList = JSON.parse(rawData);
  
  console.log(`Dosyada toplam ${campaignsList.length} adet ham kampanya bulundu.`);

  // Eski verileri temizle
  console.log('Eski veriler temizleniyor...');
  await prisma.campaign.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.bank.deleteMany({});
  console.log('Temizlik tamamlandı. Çevrimdışı kurallarla ayrıştırma ve kaydetme başlıyor...\n');

  let successCount = 0;

  for (let i = 0; i < campaignsList.length; i++) {
    const rawCamp = campaignsList[i];
    
    // Kampanya koşullarını tek metin yap
    const rawTextContent = `
Başlık: ${rawCamp.title}
Özet: ${rawCamp.subtitle || ''}
Sektör: ${rawCamp.sector || ''}
Geçerlilik Tarihi: ${rawCamp.dateRange || ''}

Koşullar:
${rawCamp.conditions.join('\n')}
    `.trim();

    // Akıllı Heuristic Parsing
    const bankName = rawCamp.bank || "Ziraat Bankası";
    const categoryName = mapSectorToCategory(rawCamp.sector || '', rawCamp.title);
    const minAmount = extractMinAmount(rawCamp.title, rawCamp.subtitle || '', rawCamp.conditions);
    
    // Yüzdelik oran kontrolü
    const combinedTextForPercent = [rawCamp.title, rawCamp.subtitle || '', ...rawCamp.conditions].join(' ');
    const percentMatch = combinedTextForPercent.match(/%\s*(\d+)/i);
    
    let isPercentage = false;
    let rewardAmount = 0;
    let maxAmount: number | null = null;

    if (percentMatch) {
      isPercentage = true;
      rewardAmount = parseFloat(percentMatch[1]); // Örn: 15 (%15 için)
      maxAmount = extractMaxAmount(rawCamp.conditions);
    } else {
      isPercentage = false;
      rewardAmount = extractRewardAmount(rawCamp.title, rawCamp.subtitle || '', rawCamp.conditions);
    }
    
    // Koşul kontrolleri
    const isNewCustomerOnly = rawTextContent.toLowerCase().includes('yeni müşteri') || 
                              rawTextContent.toLowerCase().includes('ilk defa bankkart') ||
                              rawTextContent.toLowerCase().includes('ilk defa akbank') ||
                              rawTextContent.toLowerCase().includes('ilk defa garanti');
                              
    const requiresEnrollment = rawTextContent.toLowerCase().includes('katılım') || 
                               rawTextContent.toLowerCase().includes('katılmanız') || 
                               rawTextContent.toLowerCase().includes('sms') ||
                               rawTextContent.toLowerCase().includes('bonus flaş') ||
                               rawTextContent.toLowerCase().includes('juzdan') ||
                               rawTextContent.toLowerCase().includes('world mobil') ||
                               rawTextContent.toLowerCase().includes('işcep');
    
    // Akıllı ödül tipi belirleme (Eğer parasal ödül varsa POINT veya DISCOUNT olmalı, 0 ise taksit)
    let rewardType = 'POINT';
    if (rewardAmount > 0) {
      rewardType = rawTextContent.toLowerCase().includes('indirim') ? 'DISCOUNT' : 'POINT';
    } else {
      rewardType = rawTextContent.toLowerCase().includes('taksit') ? 'INSTALLMENT' : 'POINT';
    }

    try {
      await prisma.$transaction(async (tx) => {
        const bank = await tx.bank.upsert({
          where: { name: bankName },
          update: {},
          create: { name: bankName },
        });

        const category = await tx.category.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        });

        await tx.campaign.create({
          data: {
            title: rawCamp.title,
            rawText: rawTextContent,
            minAmount: minAmount,
            maxAmount: maxAmount,
            rewardAmount: rewardAmount,
            rewardType: rewardType,
            isPercentage: isPercentage,
            isNewCustomerOnly: isNewCustomerOnly,
            requiresEnrollment: requiresEnrollment,
            bankId: bank.id,
            categoryId: category.id,
          }
        });
      });
      successCount++;
    } catch (err: any) {
      console.error(`[HATA] "${rawCamp.title}" kaydedilirken hata oluştu:`, err.message);
    }
  }

  console.log('==================================================');
  console.log('Tüm Kampanyaların Tohumlama İşlemi Tamamlandı!');
  
  const totalBanks = await prisma.bank.count();
  const totalCategories = await prisma.category.count();
  const totalCampaigns = await prisma.campaign.count();

  console.log(`Aktif Banka Sayısı     : ${totalBanks}`);
  console.log(`Aktif Kategori Sayısı   : ${totalCategories}`);
  console.log(`Toplam Kampanya Sayısı  : ${totalCampaigns} (Başarıyla Kaydedilen: ${successCount})`);
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('Seed işleminde kritik hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
