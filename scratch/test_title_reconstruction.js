const fs = require('fs');
const path = require('path');

function reconstructTitle(rawCamp) {
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
        .replace(/\b\w/g, (l) => l.toUpperCase());
      
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

function main() {
  const filePath = path.join(__dirname, '../campaigns.json');
  const campaigns = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const empty = campaigns.filter(c => !c.title || c.title.trim() === '');

  console.log(`Total campaigns with empty title: ${empty.length}`);
  empty.slice(0, 40).forEach((c, idx) => {
    console.log(`${idx+1}. URL: ${c.url}`);
    console.log(`   Reconstructed Title: "${reconstructTitle(c)}"`);
  });
}

main();
