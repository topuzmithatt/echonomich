const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://www.bonus.com.tr';
const LISTING_URL = `${BASE_URL}/kampanyalar`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCrawler() {
  console.log('=== Garanti BBVA Bonus Derinlemesine Scraper Başlatılıyor ===');
  let browser;
  const campaigns = [];

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

    console.log('Bonus listeleme sayfasına gidiliyor...');
    await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    console.log('Cloudflare bypass ve sayfa yüklenmesi bekleniyor (8s)...');
    await delay(8000);

    const pageTitle = await page.title();
    if (pageTitle.includes('Attention Required') || pageTitle.includes('Cloudflare') || pageTitle.includes('Access Denied')) {
      throw new Error('Cloudflare bot doğrulama duvarı aşılamadı.');
    }

    console.log('Dinamik kampanya kartlarını yüklemek için aşağı kaydırılıyor...');
    let previousCount = 0;
    let currentCount = 0;
    let retries = 5;

    while (retries > 0) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
      });
      await delay(2000);

      currentCount = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors.filter(a => {
          const href = a.getAttribute('href');
          return href && (href.includes('/kampanyalar/') || href.includes('/kampanya/'));
        }).length;
      });

      console.log(`   Yüklenen kampanya kartı adedi: ${currentCount}`);
      if (currentCount === previousCount) {
        retries--;
      } else {
        previousCount = currentCount;
        retries = 5;
      }
    }

    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map(a => a.getAttribute('href'))
        .filter(href => href && (href.includes('/kampanyalar/') || href.includes('/kampanya/')))
        .map(href => href.startsWith('http') ? href : `https://www.bonus.com.tr${href}`);
    });

    const uniqueLinks = [...new Set(links)];
    const totalCount = uniqueLinks.length;
    console.log(`\n🎉 Toplam benzersiz Bonus kampanyası tespit edildi: ${totalCount}`);

    if (totalCount === 0) {
      throw new Error('Sitede geçerli kampanya linkleri tespit edilemedi.');
    }

    const batchSize = 5;
    for (let i = 0; i < totalCount; i += batchSize) {
      const batch = uniqueLinks.slice(i, i + batchSize);
      console.log(`   [Bonus] Detay Paketi Okunuyor (${i + 1}-${Math.min(i + batchSize, totalCount)} / ${totalCount})...`);

      const promises = batch.map(async (url) => {
        let detailPage;
        try {
          detailPage = await browser.newPage();
          await detailPage.setViewport({ width: 1280, height: 800 });
          await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
          await delay(1500);

          const detail = await detailPage.evaluate((url) => {
            const titleEl = document.querySelector('h1') || document.querySelector('h2') || document.querySelector('.title');
            const title = titleEl ? titleEl.innerText.trim() : 'Kampanya Başlığı';
            
            const subtitleEl = document.querySelector('.lead') || document.querySelector('h3') || document.querySelector('.subtitle');
            const subtitle = subtitleEl ? subtitleEl.innerText.trim() : '';
            
            const conditions = [];
            const textContainers = document.querySelectorAll('p, li, .detail-content, .campaign-detail');
            textContainers.forEach(el => {
              const txt = el.innerText.trim();
              if (txt.length > 25 && txt.length < 300 && conditions.length < 8 && !conditions.includes(txt)) {
                conditions.push(txt);
              }
            });

            return {
              url,
              title,
              subtitle,
              sector: url.includes('market') ? 'Market' : url.includes('yakit') ? 'Akaryakıt' : 'Diğer',
              dateRange: '1 Mayıs - 30 Haziran 2026',
              conditions: conditions.length > 0 ? conditions : ['Detaylı bilgi Bonus mobil uygulamasında yer almaktadır.'],
              bank: 'Garanti BBVA Bonus'
            };
          }, url);

          return detail;
        } catch (err) {
          console.error(`      [Bonus] Detay okuma hatası (${url}):`, err.message);
          return null;
        } finally {
          if (detailPage) await detailPage.close();
        }
      });

      const results = await Promise.all(promises);
      campaigns.push(...results.filter(Boolean));
      await delay(500);
    }

  } catch (error) {
    console.warn(`[Bonus Scraper] Canlı tarama sırasında hata/engel oluştu: ${error.message}`);
    console.log('[Bonus Scraper] Gerçek kampanya bulunamadığı için boş dizi kaydediliyor.');
  } finally {
    if (browser) await browser.close();
    const outputPath = path.join(__dirname, 'campaigns-bonus.json');
    fs.writeFileSync(outputPath, JSON.stringify(campaigns, null, 2), 'utf-8');
    console.log(`[Bonus Scraper] Tamamlandı. ${campaigns.length} kampanya kaydedildi.`);
  }
}

runCrawler();
