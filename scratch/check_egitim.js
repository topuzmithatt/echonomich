const fs = require('fs');
const path = require('path');

function mapSectorToCategory(sector, title, rawText) {
  const combined = `${sector} ${title} ${rawText}`.toLowerCase();
  
  if (/akaryakıt|otogaz|yakıt|istasyon|petrol|opet|shell|total|bp|m oil/i.test(combined)) {
    return 'Akaryakıt';
  }

  if (/restoran|yemek|kafe|cafe|fast\s*food|lokanta|pastane|mado|starbucks|kahve|döner|burger|pizza/i.test(combined)) {
    return 'Yemek & Restoran';
  }

  if (/market|süpermarket|gıda|şarküteri|manav|kasap|migros|carrefour|şok|bim|a101|tekel|getir|istegelsin/i.test(combined)) {
    return 'Market';
  }

  if (/seyahat|turizm|otel|tatil|uçak|tur|konaklama|kiralama|rent\s*a\s*car|havayolu|pegasus|thy|ets\s*tur|jolly|turna|biletinial\s*travel/i.test(combined)) {
    return 'Seyahat & Turizm';
  }

  if (/giyim|moda|aksesuar|ayakkabı|saat|kuyum|mücevher|elbise|pantolon|mont|derimod|tergan|ltb|zara|boyner|koton|defacto|flo|ipekyol|h&m/i.test(combined)) {
    return 'Giyim & Aksesuar';
  }

  if (/e-ticaret|eticaret|trendyol|hepsiburada|n11|amazon|pazarama|ciceksepeti|çiçeksepeti|sanal\s*market|sanal\s*mağaza|online\s*alışveriş|internet\s*üzerinden\s*yapacağınız/i.test(combined)) {
    return 'E-Ticaret';
  }

  if (/elektronik|teknoloji|beyaz\s*eşya|telefon|bilgisayar|tv|cihaz|mediamarkt|teknosa|vatan\s*bilgisayar|samsung|dyson|klima|kombi|viessmann|arçelik|beko|bosch/i.test(combined)) {
    return 'Elektronik & Beyaz Eşya';
  }

  if (/eğitim|okul|kitap|kırtasiye|kurs|üniversite|kolej|akademik|ebscohost|rosetta|novakid|ders/i.test(combined)) {
    return 'Eğitim & Kırtasiye';
  }

  if (/mobilya|dekorasyon|yapı\s*market|inşaat|ısıtma|soğutma|ev\s*tekstili|züccaciye|porland|karaca|koçtaş|bauhaus|ikea|istikbal|bellona|kelebek/i.test(combined)) {
    return 'Ev, Dekorasyon & Yapı Market';
  }

  if (/sağlık|eczane|optik|kozmetik|petshop|veteriner|pet|güzellik|kuaför|berber|diş|hastane|muayene|gratis|watsons|sephora|rossmann/i.test(combined)) {
    return 'Sağlık & Kozmetik';
  }

  if (/kültür|sanat|sinema|tiyatro|konser|bilet|biletinial|oyun|gaming|game|playstation|xbox|nintendo|steam|pubg|etkinlik|müze/i.test(combined)) {
    return 'Kültür, Sanat & Eğlence';
  }

  return 'Diğer';
}

function main() {
  const filePath = path.join(__dirname, '../campaigns.json');
  if (!fs.existsSync(filePath)) {
    console.error('campaigns.json not found!');
    return;
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const campaigns = JSON.parse(rawData);

  const matched = [];
  campaigns.forEach(c => {
    const rawText = c.conditions.join(' ');
    const cat = mapSectorToCategory(c.sector || '', c.title, rawText);
    if (cat === 'Eğitim & Kırtasiye') {
      matched.push(c);
    }
  });

  console.log(`Total matched: ${matched.length}`);
  matched.slice(0, 30).forEach((c, idx) => {
    console.log(`${idx+1}. Title: "${c.title}"`);
    console.log(`   Sector: ${c.sector}`);
  });
}

main();
