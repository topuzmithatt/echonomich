const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Stealth eklentisini aktif ediyoruz.
puppeteer.use(StealthPlugin());

const BASE_URL = 'https://www.bankkart.com.tr';
const LISTING_URL = `${BASE_URL}/kampanyalar`;

// Sayfayı aşağı kaydırarak dinamik elementlerin yüklenmesini tetikleyen yardımcı fonksiyon.
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 200; // Her adımda kaydırılacak piksel miktarı
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        // Sayfa sonuna ulaşıldığında döngüyü sonlandır.
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 80);
    });
  });
}

// Belirli bir süre beklemek için senkronize timeout fonksiyonu
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCrawler() {
  console.log('=== Kredi Kartı Kampanya Crawler PoC Başlatılıyor ===');
  console.log(`Ana Kampanya Listesi URL: ${LISTING_URL}\n`);

  // Puppeteer tarayıcısını başlatıyoruz.
  const browser = await puppeteer.launch({
    headless: false, // Tarayıcıyı görünür modda açıyoruz (Anti-bot koruması için önerilir).
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1280,800'
    ],
    defaultViewport: {
      width: 1280,
      height: 800
    }
  });

  const campaigns = [];

  try {
    const page = await browser.newPage();

    // Dil ve User-Agent ayarlarını yapıyoruz.
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    // Otomasyon algılama testlerini geçmek için webdriver değerini gizliyoruz.
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    console.log('Listeleme sayfasına gidiliyor...');
    await page.goto(LISTING_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Dinamik kampanya kartlarının yüklenmesi için sayfa aşağı kaydırılıyor...');
    
    let previousCount = 0;
    let currentCount = 0;
    let retries = 3; // Değişiklik olmazsa kaç kez denenecek

    while (retries > 0) {
      await autoScroll(page);
      await delay(1500); // Yeni kartların yüklenmesi için bekliyoruz.

      currentCount = await page.evaluate(() => {
        return document.querySelectorAll('.campaigns-list a.campaign-box').length;
      });

      console.log(`Yüklenen kampanya sayısı: ${currentCount}`);

      if (currentCount === previousCount) {
        retries--;
      } else {
        previousCount = currentCount;
        retries = 3; // Değişiklik oldukça hakkı sıfırla
      }
    }

    // Kampanyaların href linklerini topluyoruz.
    const campaignHrefs = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.campaigns-list a.campaign-box'));
      return links.map(link => link.getAttribute('href'))
                  .filter(href => href && href.startsWith('/kampanyalar/'));
    });

    // Tekil ve mutlak URL'leri elde ediyoruz.
    const absoluteUrls = [...new Set(campaignHrefs.map(href => `${BASE_URL}${href}`))];
    const MAX_CAMPAIGNS = 15; // PoC hızlandırmak ve WAF engellerini önlemek için limit
    const targetUrls = absoluteUrls.slice(0, MAX_CAMPAIGNS);

    console.log(`\nToplam ${absoluteUrls.length} adet tekil kampanya linki tespit edildi.`);
    console.log(`PoC doğrulaması için ilk ${MAX_CAMPAIGNS} kampanya ziyaret edilerek detayları çekiliyor...\n`);

    // Her bir kampanya linkini sırayla ziyaret ediyoruz.
    for (let i = 0; i < targetUrls.length; i++) {
      const url = targetUrls[i];
      const indexStr = `[${i + 1}/${targetUrls.length}]`;
      console.log(`${indexStr} Ziyaret ediliyor: ${url}`);

      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 45000
        });

        // Detay içeriğinin yüklenmesini bekliyoruz.
        await page.waitForSelector('.subpage-detail', { timeout: 10000 });

        // Kampanya verilerini ayıklıyoruz.
        const detail = await page.evaluate((url) => {
          const titleEl = document.querySelector('.subpage-detail h1');
          const title = titleEl ? titleEl.innerText.trim() : 'Başlık Bulunamadı';

          const subtitleEl = document.querySelector('.subpage-detail h2');
          const subtitle = subtitleEl ? subtitleEl.innerText.trim() : '';

          const dateEl = document.querySelector('.subpage-detail .date-box h4');
          const dateText = dateEl ? dateEl.innerText.trim() : '';

          // Sektör bilgisini bulmak için detail-content içindeki paragrafları arayalım
          let sectorText = '';
          const pElements = document.querySelectorAll('.subpage-detail .detail-content p');
          for (const p of pElements) {
            if (p.innerText.includes('Sektör:')) {
              sectorText = p.innerText.replace('Sektör:', '').trim();
              break;
            }
          }

          const contentEl = document.querySelector('.subpage-detail .detail-content');
          let conditions = [];
          let rawText = '';

          if (contentEl) {
            // Gereksiz formları kaldır
            const captchaForm = contentEl.querySelector('.tabs-form');
            if (captchaForm) captchaForm.remove();

            const listItems = contentEl.querySelectorAll('ul li');
            if (listItems.length > 0) {
              listItems.forEach(li => {
                conditions.push(li.innerText.trim());
              });
            } else {
              conditions.push(contentEl.innerText.trim());
            }

            rawText = contentEl.innerText.trim();
          }

          return {
            url,
            title,
            subtitle,
            sector: sectorText,
            dateRange: dateText,
            conditions
          };
        }, url);

        campaigns.push(detail);
        console.log(`   Başarıyla çekildi: "${detail.title}" (Sektör: ${detail.sector || 'Belirtilmemiş'})\n`);

      } catch (err) {
        console.error(`   ${indexStr} Kampanya çekilirken hata oluştu:`, err.message);
      }

      // Banka sunucularına aşırı yük bindirmemek ve WAF'a yakalanmamak için rastgele 1 - 2.5 saniye arası bekliyoruz.
      const waitTime = Math.floor(Math.random() * 1500) + 1000;
      await delay(waitTime);
    }

    // Toplanan verileri JSON olarak kaydediyoruz.
    const jsonPath = 'campaigns.json';
    fs.writeFileSync(jsonPath, JSON.stringify(campaigns, null, 2), 'utf-8');
    console.log(`\n=== Tüm Kampanyalar Başarıyla Tarandı ve Kaydedildi ===`);
    console.log(`Toplam Kaydedilen Kampanya: ${campaigns.length}`);
    console.log(`Dosya Konumu: ${jsonPath}\n`);

  } catch (error) {
    console.error('Crawler çalışırken kritik bir hata oluştu:', error.message);
  } finally {
    console.log('Tarayıcı kapatılıyor...');
    await browser.close();
    console.log('Crawler sonlandırıldı.');
  }
}

runCrawler();
