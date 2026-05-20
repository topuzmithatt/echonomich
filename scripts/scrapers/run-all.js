const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runAllScrapers() {
  console.log('==================================================');
  console.log('🚀 TÜM BANKA KAMPANYA TARAYICILARI BAŞLATILIYOR 🚀');
  console.log('==================================================\n');

  const scrapers = [
    { name: 'Ziraat Bankkart', file: 'scrape-ziraat.js', output: 'campaigns-ziraat.json' },
    { name: 'Akbank Axess', file: 'scrape-axess.js', output: 'campaigns-axess.json' },
    { name: 'Garanti BBVA Bonus', file: 'scrape-bonus.js', output: 'campaigns-bonus.json' },
    { name: 'Yapı Kredi World', file: 'scrape-world.js', output: 'campaigns-world.json' },
    { name: 'İş Bankası Maximum', file: 'scrape-maximum.js', output: 'campaigns-maximum.json' },
  ];

  const allCampaigns = [];

  for (const scraper of scrapers) {
    console.log(`\n⏳ ${scraper.name} tarayıcısı çalıştırılıyor...`);
    const filePath = path.join(__dirname, scraper.file);
    const outputPath = path.join(__dirname, scraper.output);

    try {
      // Her scraper'ı kendi dosyasında çalıştırıp konsol çıktılarını anlık olarak aktarıyoruz
      execSync(`node "${filePath}"`, { stdio: 'inherit' });

      // Çıktı dosyasını oku ve listeye ekle
      if (fs.existsSync(outputPath)) {
        const fileContent = fs.readFileSync(outputPath, 'utf-8');
        const campaigns = JSON.parse(fileContent);
        allCampaigns.push(...campaigns);
        console.log(`✅ ${scraper.name} tamamlandı. Eklenen: ${campaigns.length}`);
      } else {
        console.warn(`⚠️ Uyarı: ${scraper.name} için çıktı dosyası bulunamadı.`);
      }
    } catch (err) {
      console.error(`❌ Hata: ${scraper.name} çalıştırılırken bir problem oluştu:`, err.message);
    }
  }

  // Birleştirilmiş veriyi ana campaigns.json dosyasına yaz
  try {
    const rootCampaignsJsonPath = path.join(__dirname, '../../campaigns.json');
    fs.writeFileSync(rootCampaignsJsonPath, JSON.stringify(allCampaigns, null, 2), 'utf-8');
    
    console.log('\n==================================================');
    console.log('🎉 TÜM TARAMA VE BİRLEŞTİRME İŞLEMLERİ TAMAMLANDI! 🎉');
    console.log(`Toplam Kampanya Sayısı : ${allCampaigns.length}`);
    console.log(`Dosya Konumu           : ${rootCampaignsJsonPath}`);
    console.log('==================================================\n');
  } catch (err) {
    console.error('❌ Hata: Birleştirilmiş veri campaigns.json dosyasına yazılamadı:', err.message);
  }
}

runAllScrapers();
