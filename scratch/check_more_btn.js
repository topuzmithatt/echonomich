const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://www.bankkart.com.tr/kampanyalar', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));

  const data = await page.evaluate(() => {
    // Tüm butonları tara ve metinlerinde 'daha' geçenleri bul
    const loadMoreButtons = Array.from(document.querySelectorAll('button, a, div')).map(el => {
      return {
        tag: el.tagName,
        text: el.innerText.trim(),
        className: el.className,
        id: el.id
      };
    }).filter(el => el.text.toLowerCase().includes('daha') || el.text.toLowerCase().includes('yükle') || el.text.toLowerCase().includes('fazla'));

    return {
      totalCampaignBoxes: document.querySelectorAll('.campaigns-list a.campaign-box').length,
      loadMoreButtons
    };
  });

  console.log('Campaign boxes:', data.totalCampaignBoxes);
  console.log('Load more buttons found:', data.loadMoreButtons);

  await browser.close();
}
run();
