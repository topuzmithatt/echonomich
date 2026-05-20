const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://www.bankkart.com.tr';
const LISTING_URL = `${BASE_URL}/kampanyalar`;

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCrawler() {
  console.log('=== Ziraat Bankkart Derinlemesine Scraper Başlatılıyor ===');
  let browser;
  const allCampaignUrls = [];

  try {
    const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      headless: false,
      executablePath: CHROME_PATH,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    console.log('Ziraat ana sayfasına gidiliyor...');
    await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    // Kategori sayfalarını ayıklayalım (Örn: /kampanyalar/akaryakit)
    const categoryUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map(a => a.getAttribute('href'))
        .filter(href => href && href.startsWith('/kampanyalar/') && href.split('/').length === 3)
        .map(href => `https://www.bankkart.com.tr${href}`);
    });

    const uniqueCategories = [...new Set(categoryUrls)];
    console.log(`Tespit edilen kategori sayfası sayısı: ${uniqueCategories.length}`);

    // Her kategoriyi ziyaret edip içindeki kampanyaları toplayalım
    for (const catUrl of uniqueCategories) {
      try {
        console.log(`   Kategori taranıyor: ${catUrl}`);
        await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(1500);
        await autoScroll(page);
        await delay(1000);

        const hrefs = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('.campaigns-list a.campaign-box'));
          return links.map(l => l.getAttribute('href')).filter(href => href && href.startsWith('/kampanyalar/'));
        });

        hrefs.forEach(href => {
          const absUrl = `https://www.bankkart.com.tr${href}`;
          if (!allCampaignUrls.includes(absUrl)) {
            allCampaignUrls.push(absUrl);
          }
        });
      } catch (err) {
        console.error(`   Kategori okuma hatası (${catUrl}):`, err.message);
      }
    }

    const totalCampaignsCount = allCampaignUrls.length;
    console.log(`\n🎉 Toplam benzersiz Ziraat kampanyası bulundu: ${totalCampaignsCount}`);
    
    if (totalCampaignsCount === 0) {
      throw new Error('Sitede kampanya linki tespit edilemedi.');
    }

    // Kampanyaları 5'li paralel paketler (batch) halinde okuyalım
    const campaigns = [];
    const batchSize = 5;

    for (let i = 0; i < totalCampaignsCount; i += batchSize) {
      const batch = allCampaignUrls.slice(i, i + batchSize);
      console.log(`   [Ziraat] Detay Paketi Okunuyor (${i + 1}-${Math.min(i + batchSize, totalCampaignsCount)} / ${totalCampaignsCount})...`);

      const promises = batch.map(async (url) => {
        let detailPage;
        try {
          detailPage = await browser.newPage();
          await detailPage.setViewport({ width: 1280, height: 800 });
          await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
          await delay(1000);

          const detail = await detailPage.evaluate((url) => {
            const titleEl = document.querySelector('.subpage-detail h1');
            const title = titleEl ? titleEl.innerText.trim() : 'Başlık Bulunamadı';

            const subtitleEl = document.querySelector('.subpage-detail h2');
            const subtitle = subtitleEl ? subtitleEl.innerText.trim() : '';

            const dateEl = document.querySelector('.subpage-detail .date-box h4');
            const dateText = dateEl ? dateEl.innerText.trim() : '';

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
            if (contentEl) {
              const listItems = contentEl.querySelectorAll('ul li');
              if (listItems.length > 0) {
                listItems.forEach(li => conditions.push(li.innerText.trim()));
              } else {
                conditions.push(contentEl.innerText.trim());
              }
            }

            return {
              url,
              title,
              subtitle,
              sector: sectorText,
              dateRange: dateText,
              conditions,
              bank: 'Ziraat Bankası'
            };
          }, url);

          return detail;
        } catch (err) {
          console.error(`      [Ziraat] Hata (${url}):`, err.message);
          return null;
        } finally {
          if (detailPage) await detailPage.close();
        }
      });

      const results = await Promise.all(promises);
      campaigns.push(...results.filter(Boolean));
      await delay(500);
    }

    const outputPath = path.join(__dirname, 'campaigns-ziraat.json');
    fs.writeFileSync(outputPath, JSON.stringify(campaigns, null, 2), 'utf-8');
    console.log(`[Ziraat Scraper] Başarıyla tamamlandı. ${campaigns.length} adet kampanya kaydedildi.`);

  } catch (error) {
    console.error('[Ziraat Scraper] Kritik Hata:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

runCrawler();
