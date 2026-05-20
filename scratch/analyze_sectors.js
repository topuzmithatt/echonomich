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
  console.log(`Total campaigns in campaigns.json: ${campaigns.length}`);

  const sectors = {};
  campaigns.forEach(c => {
    const sec = c.sector || 'NO_SECTOR';
    sectors[sec] = (sectors[sec] || 0) + 1;
  });

  console.log('Unique Sectors and counts:');
  const sortedSectors = Object.entries(sectors).sort((a,b) => b[1] - a[1]);
  sortedSectors.forEach(([sec, count]) => {
    console.log(`- "${sec}": ${count}`);
  });
}

main();
