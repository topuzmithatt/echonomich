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

  const filterLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => {
      return {
        text: a.innerText.trim(),
        href: a.getAttribute('href'),
        className: a.className,
        parent: a.parentElement ? a.parentElement.tagName : ''
      };
    }).filter(a => a.href && (a.href.includes('kampanya') || a.href.includes('sektor') || a.href.includes('filter') || a.className.includes('filter') || a.className.includes('category') || a.parent === 'LI'));
  });

  console.log('Detected links:', JSON.stringify(filterLinks, null, 2));
  await browser.close();
}
run();
