const fs = require('fs');
const path = require('path');

function main() {
  const filePath = path.join(__dirname, '../campaigns.json');
  if (!fs.existsSync(filePath)) {
    console.error('campaigns.json not found!');
    return;
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const campaigns = JSON.parse(rawData);

  const diger = campaigns.filter(c => c.sector === 'Diğer');
  console.log(`Total campaigns in campaigns.json with sector 'Diğer': ${diger.length}`);

  // Print first 50 titles and rawText snippets
  diger.slice(0, 50).forEach((c, idx) => {
    console.log(`${idx+1}. Title: "${c.title}"`);
    console.log(`   Summary: "${c.summary}"`);
  });
}

main();
