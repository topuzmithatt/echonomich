const fs = require('fs');
const path = require('path');

function main() {
  const filePath = path.join(__dirname, '../campaigns.json');
  const campaigns = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const camp = campaigns.find(c => c.title === 'Mobilya ve Dekorasyon Kampanyaları');
  if (camp) {
    console.log(`Title: "${camp.title}"`);
    console.log(`Sector: ${camp.sector}`);
    console.log(`Conditions length: ${camp.conditions.length}`);
    console.log(`Conditions text:`);
    console.log(camp.conditions.join('\n').substring(0, 1000));
  } else {
    console.log("Not found");
  }
}

main();
