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
  await new Promise(r => setTimeout(r, 5000));

  const pageData = await page.evaluate(() => {
    // Sekmeleri veya butonları bul
    const tabs = Array.from(document.querySelectorAll('a, button, li')).map(el => {
      return {
        tag: el.tagName,
        text: el.innerText.trim(),
        className: el.className,
        id: el.id,
        href: el.getAttribute('href')
      };
    }).filter(t => t.text.length > 2 && t.text.length < 50);

    const counts = document.querySelectorAll('.campaigns-list a.campaign-box').length;

    return { tabs, counts };
  });

  console.log('Campaign count loaded by default:', pageData.counts);
  console.log('Tabs detected:', JSON.stringify(pageData.tabs, null, 2));

  await browser.close();
}
run();
