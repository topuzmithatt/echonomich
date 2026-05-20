const fs = require('fs');
const path = require('path');

function main() {
  const filePath = path.join(__dirname, '../campaigns.json');
  const campaigns = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const empty = campaigns.filter(c => !c.title || c.title.trim() === '');
  console.log(`Total campaigns with empty title: ${empty.length}`);
  if (empty.length > 0) {
    console.log("First empty campaign example:");
    console.log(JSON.stringify(empty[0], null, 2));
  }
}

main();
