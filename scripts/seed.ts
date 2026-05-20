import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

// JSON dosya konumu
const CAMPAIGNS_JSON_PATH = path.join(process.cwd(), 'campaigns.json');

// Boş başlıkları URL veya alt başlıktan geri kazanan yardımcı fonksiyon
function reconstructTitle(rawCamp: any): string {
  let title = rawCamp.title ? rawCamp.title.trim() : '';
  if (title) return title;

  const subtitle = rawCamp.subtitle ? rawCamp.subtitle.trim() : '';
  if (subtitle && !/kampanya|kampanyalar/i.test(subtitle)) {
    return subtitle;
  }

  if (rawCamp.url) {
    const parts = rawCamp.url.split('/');
    let slug = parts[parts.length - 1] || parts[parts.length - 2];
    if (slug) {
      slug = slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
      
      slug = slug
        .replace(/kampus/gi, 'Kampüs')
        .replace(/modu/gi, 'Modu')
        .replace(/ozel/gi, 'Özel')
        .replace(/indirim/gi, 'İndirim')
        .replace(/firsat/gi, 'Fırsat')
        .replace(/kampanyasi/gi, 'Kampanyası')
        .replace(/kampanyalari/gi, 'Kampanyaları')
        .replace(/egitim/gi, 'Eğitim')
        .replace(/saglik/gi, 'Sağlık')
        .replace(/ulasim/gi, 'Ulaşım')
        .replace(/odemeleri/gi, 'Ödemeleri');
      return slug;
    }
  }

  if (rawCamp.conditions && rawCamp.conditions.length > 0) {
    const firstCond = rawCamp.conditions[0].trim();
    if (firstCond.length > 5 && firstCond.length < 80) {
      return firstCond;
    }
  }

  return 'Özel Banka Kampanyası';
}

// Sektörleri ana kategorilere eşleyen yardımcı fonksiyon
function mapSectorToCategory(sector: string, title: string): string {
  const combined = `${sector} ${title}`.toLowerCase();
  
  if (/akaryakıt|otogaz|yakıt|istasyon|petrol|opet|shell|total|bp|m oil/i.test(combined)) {
    return 'Akaryakıt';
  }

  // Yemek & Restoran
  if (/restoran|yemek|kafe|cafe|fast\s*food|lokanta|pastane|mado|starbucks|kahve|döner|burger|pizza/i.test(combined)) {
    return 'Yemek & Restoran';
  }

  // Market
  if (/market|süpermarket|gıda|şarküteri|manav|kasap|migros|carrefour|şok|bim|a101|tekel|getir|istegelsin/i.test(combined)) {
    return 'Market';
  }

  // Seyahat & Turizm
  if (/seyahat|turizm|otel|tatil|uçak|tur|konaklama|kiralama|rent\s*a\s*car|havayolu|havayolları|pegasus|thy|ets\s*tur|jolly|turna|uçuş|biletinial\s*travel/i.test(combined)) {
    return 'Seyahat & Turizm';
  }

  // Giyim & Aksesuar
  if (/giyim|moda|aksesuar|ayakkabı|saat|kuyum|mücevher|elbise|pantolon|mont|derimod|tergan|ltb|zara|boyner|koton|defacto|flo|ipekyol|h&m/i.test(combined)) {
    return 'Giyim & Aksesuar';
  }

  // E-Ticaret
  if (/e-ticaret|eticaret|trendyol|hepsiburada|n11|amazon|pazarama|ciceksepeti|çiçeksepeti|sanal\s*market|sanal\s*mağaza|online\s*alışveriş|pazarama/i.test(combined)) {
    return 'E-Ticaret';
  }

  // Elektronik & Beyaz Eşya
  if (/elektronik|teknoloji|beyaz\s*eşya|telefon|bilgisayar|tv|cihaz|mediamarkt|teknosa|vatan\s*bilgisayar|samsung|dyson|klima|kombi|viessmann|arçelik|beko|bosch/i.test(combined)) {
    return 'Elektronik & Beyaz Eşya';
  }

  // Eğitim & Kırtasiye
  if (/eğitim|okul|kitap|kırtasiye|kurs|üniversite|kolej|akademik|ebscohost|rosetta|novakid|ders/i.test(combined)) {
    return 'Eğitim & Kırtasiye';
  }

  // Ev, Dekorasyon & Yapı Market
  if (/mobilya|dekorasyon|yapı\s*market|inşaat|ısıtma|soğutma|ev\s*tekstili|züccaciye|porland|karaca|koçtaş|bauhaus|ikea|istikbal|bellona|kelebek/i.test(combined)) {
    return 'Ev, Dekorasyon & Yapı Market';
  }

  // Sağlık & Kozmetik
  if (/sağlık|eczane|optik|kozmetik|petshop|veteriner|pet|güzellik|kuaför|berber|diş|hastane|muayene|gratis|watsons|sephora|rossmann/i.test(combined)) {
    return 'Sağlık & Kozmetik';
  }

  // Kültür, Sanat & Eğlence
  if (/kültür|sanat|sinema|tiyatro|konser|bilet|biletinial|oyun|gaming|game|playstation|xbox|nintendo|steam|pubg|etkinlik|müze|dijital\s*platform|netflix|spotify|youtube/i.test(combined)) {
    return 'Kültür, Sanat & Eğlence';
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
    
    // Akıllı başlık kurtarma/temizleme
    const cleanTitle = reconstructTitle(rawCamp);

    // Kampanya koşullarını tek metin yap
    const rawTextContent = `
Başlık: ${cleanTitle}
Özet: ${rawCamp.subtitle || ''}
Sektör: ${rawCamp.sector || ''}
Geçerlilik Tarihi: ${rawCamp.dateRange || ''}

Koşullar:
${rawCamp.conditions.join('\n')}
    `.trim();

    // Akıllı Heuristic Parsing
    const bankName = rawCamp.bank || "Ziraat Bankası";
    const categoryName = mapSectorToCategory(rawCamp.sector || '', cleanTitle);
    const minAmount = extractMinAmount(cleanTitle, rawCamp.subtitle || '', rawCamp.conditions);
    
    // Yüzdelik oran kontrolü
    const combinedTextForPercent = [cleanTitle, rawCamp.subtitle || '', ...rawCamp.conditions].join(' ');
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
      rewardAmount = extractRewardAmount(cleanTitle, rawCamp.subtitle || '', rawCamp.conditions);
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
            title: cleanTitle,
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
      console.error(`[HATA] "${cleanTitle}" kaydedilirken hata oluştu:`, err.message);
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
