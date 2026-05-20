import OpenAI from 'openai';
import { prisma } from '../lib/prisma';

export type RewardType = 'POINT' | 'CASHBACK' | 'DISCOUNT' | 'INSTALLMENT';

// LLM'den dönecek şemanın TypeScript arayüzü
export interface ParsedCampaignJSON {
  title: string;
  bankName: string;
  categoryName: string;
  minAmount: number;
  maxAmount: number | null;
  rewardAmount: number;
  rewardType: RewardType;
  isNewCustomerOnly: boolean;
  requiresEnrollment: boolean;
}

// OpenAI API istemcisini başlatıyoruz
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Ham metni yapılandırılmış JSON'a dönüştürme kurallarını içeren System Prompt
export const SYSTEM_PROMPT = `
Sen banka kredi kartı kampanyalarını analiz eden uzman bir Veri Mühendisi asistanısın.
Görevin, sana verilen ham kampanya koşullarını ve metnini analiz edip, aşağıdaki kurallara ve JSON şemasına tamamen uyan tek bir geçerli JSON objesi döndürmektir. 

JSON Şeması:
{
  "title": "Kampanyanın kısa, net ve anlaşılır başlığı",
  "bankName": "Kampanyayı sunan bankanın adı (Örn: 'Ziraat Bankası')",
  "categoryName": "Kampanyanın geçerli olduğu ana harcama sektörü/kategorisi. Yalnızca şu sektörlerden birini seçmelisin: 'Akaryakıt', 'Market', 'Seyahat', 'Giyim', 'Elektronik', 'Diğer'",
  "minAmount": 1500.00, // Kampanyadan yararlanmak için yapılması gereken minimum harcama tutarı. Eğer metinde net bir tutar yoksa veya her harcamaya puan veriliyorsa 0 yaz.
  "maxAmount": 5000.00, // Kampanyanın geçerli olduğu maksimum harcama limiti. Eğer metinde belirtilmemişse null yaz.
  "rewardAmount": 400.00, // Kullanıcının kazanacağı maksimum ödül miktarı (puan, indirim veya nakit iade cinsinden net tutar). Eğer metinde yazmıyorsa veya yüzdelik indirim ise hesaplanabilir bir taban miktar veya 0 yaz.
  "rewardType": "POINT", // Ödülün türü. Puan/Mil/Bankkart Lira için POINT, Nakit İade için CASHBACK, İndirim için DISCOUNT, Taksit/Sonradan Taksitlendirme fırsatları için INSTALLMENT yazmalısın.
  "isNewCustomerOnly": false, // Kampanya sadece yeni banka müşterilerine özel ise true, mevcut müşterileri de kapsıyorsa false.
  "requiresEnrollment": true // Kampanyaya katılım/başvuru gerekiyorsa (Örn: Mobil uygulama üzerinden katılım, SMS atma gibi şartlar varsa) true, otomatik geçerliyse false.
}

Kurallar:
1. Para birimlerini ve tutarları sadece sayısal (float/number) değerler olarak ayıkla (Örn: "1.400 TL" -> 1400.00).
2. Metin içinde birden fazla harcama kademesi varsa (örneğin 45.000 TL'ye 2.500 TL, 70.000 TL'ye 5.500 TL, 120.000 TL'ye 8.500 TL), minAmount olarak EN DÜŞÜK harcama limitini (45000.00), rewardAmount olarak ise EN YÜKSEK kazanılabilecek ödülü (8500.00) yaz.
3. Kategori adı (categoryName) mutlaka şu değerlerden biri olmalıdır: 'Akaryakıt', 'Market', 'Seyahat', 'Giyim', 'Elektronik', 'Diğer'. Eşleşmeyen tüm sektörler için 'Diğer' değerini seç.
4. Yanıt olarak sadece JSON objesini döndür. Markdown etiketleri (\`\`\`json) veya başka herhangi bir açıklayıcı metin ekleme.
`;

/**
 * Ham kampanya metnini LLM kullanarak analiz eder ve Prisma ile veritabanına kaydeder.
 * @param rawTitle Kampanyanın orijinal başlığı
 * @param rawText Kampanyanın kazınan ham koşul metni
 */
export async function parseAndSaveCampaign(rawTitle: string, rawText: string): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('HATA: OpenAI API Key bulunamadı. Lütfen .env dosyasını kontrol edin.');
  }

  try {
    console.log(`LLM Analizi Başlatılıyor: "${rawTitle}"`);

    // OpenAI Chat Completion API'sini çağırıyoruz
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // veya gpt-4-turbo / gpt-3.5-turbo
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Başlık: ${rawTitle}\n\nİçerik:\n${rawText}` },
      ],
      response_format: { type: 'json_object' }, // Kesin JSON dönüşü için
      temperature: 0.1, // Daha kararlı ve tutarlı çıktılar için düşük sıcaklık
    });

    const resultText = response.choices[0]?.message?.content;
    if (!resultText) {
      throw new Error('LLM boş bir yanıt döndürdü.');
    }

    // JSON ayrıştırması
    const parsedData: ParsedCampaignJSON = JSON.parse(resultText);

    // Veritabanı işlemleri - One-to-Many ilişkilerini kurarak veriyi işliyoruz
    const savedCampaign = await prisma.$transaction(async (tx) => {
      // 1. Banka kaydı var mı kontrol et yoksa oluştur (BankName)
      const bank = await tx.bank.upsert({
        where: { name: parsedData.bankName },
        update: {},
        create: { name: parsedData.bankName },
      });

      // 2. Kategori kaydı var mı kontrol et yoksa oluştur (CategoryName)
      const category = await tx.category.upsert({
        where: { name: parsedData.categoryName },
        update: {},
        create: { name: parsedData.categoryName },
      });

      // 3. Kampanya kaydını oluştur
      return await tx.campaign.create({
        data: {
          title: parsedData.title,
          rawText: rawText,
          minAmount: parsedData.minAmount,
          maxAmount: parsedData.maxAmount,
          rewardAmount: parsedData.rewardAmount,
          rewardType: parsedData.rewardType,
          isNewCustomerOnly: parsedData.isNewCustomerOnly,
          requiresEnrollment: parsedData.requiresEnrollment,
          bankId: bank.id,
          categoryId: category.id,
        },
        include: {
          bank: true,
          category: true,
        },
      });
    });

    console.log(`Kampanya başarıyla kaydedildi: ID: ${savedCampaign.id} | "${savedCampaign.title}"`);
    return savedCampaign;

  } catch (error: any) {
    console.error('Kampanya işlenirken/kaydedilirken hata oluştu:', error.message);
    throw error;
  }
}
