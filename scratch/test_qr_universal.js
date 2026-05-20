// Yeni mantığı test et: QR kampanyası evrensel mi değil mi?
// Kural: QR içermesi tek başına evrensel YAPMAZ.
// Evrensel olması için: hasGeneralSpendKeywords=true && hasNicheKeywords=false

function testQRCampaign(title, rawText) {
  const combined = `${title} ${rawText}`.toLowerCase();

  const isQRorNFC = /qr\s*kod|qr\s*ile|qr\s*ödeme|karekod|nfc|mobil\s*temassız/i.test(combined);

  const hasGeneralSpendKeywords = /her\s*(?:alışveriş|harcama)|alışverişlerinize|harcamalarınıza|sektör\s*fark\s*etmeksizin|tüm\s*(?:alışveriş|harcama|pos|üye\s*iş)/i.test(combined);

  const hasNicheKeywords = /\b(akaryakıt|yakıt|benzin|shell|opet|total|bp|mobilya|dekorasyon|yapı\s*market|koçtaş|bauhaus|ikea|istikbal|kitap|kırtasiye|okul|kurs|netflix|spotify|sinema|tiyatro|bilet|oyun|gaming|sigorta|vergi|fatura|sağlık|eczane|kozmetik|petshop|kuaför|hastane|giyim|ayakkabı|aksesuar|otomotiv|lastik|araç|rent\s*a\s*car|otel|tatil|uçak|turizm|elektronik|beyaz\s*eşya|teknosa|mediamarkt|migros|carrefour|şok|bim\b|a101|trendyol|hepsiburada)\b/i.test(combined);

  const isQRUniversal = isQRorNFC && hasGeneralSpendKeywords && !hasNicheKeywords;

  return {
    title,
    isQRorNFC,
    hasGeneralSpendKeywords,
    hasNicheKeywords,
    isQRUniversal,
    verdict: isQRUniversal ? '✅ EVRENSELEVERENSELr: her kategoride çıkar' : '❌ SEKTÖRE ÖZEL: sadece kendi kategorisinde çıkar'
  };
}

const testCases = [
  {
    title: "SHELL'DE MOBİL VEYA QR İLE ÖDEMEYE EKSTRA 50 TL BONUS!",
    rawText: "Shell istasyonlarında QR ödeme yaparak 50 TL Bankkart Lira kazanın. Min. harcama: 200 TL"
  },
  {
    title: "TÜM HARCAMALARINIZIA QR İLE EKSTRA PUAN",
    rawText: "Tüm üye işyerlerinde QR kod ile ödeme yaparak harcamalarınıza ekstra bankkart lira kazanın. Sektör fark etmeksizin geçerlidir."
  },
  {
    title: "BANKKART GENÇ İLE QR ÖDEMELERİNİZE 200 TL BANKKART LİRA",
    rawText: "Tüm harcamalarınızda QR ödeme yaparak 200 TL bankkart lira kazanın. Min. harcama: 350 TL"
  },
  {
    title: "İSTİKBAL'DE QR İLE 500 TL İNDİRİM",
    rawText: "İstikbal mobilya mağazalarında QR kod ile ödeme yaparak 500 TL indirim kazanın."
  },
  {
    title: "OPET İSTASYONLARINDA QR ÖDEMEYE 100 TL BONUS",
    rawText: "Opet akaryakıt istasyonlarında QR ödeme yaparak yakıt alışverişinde 100 TL bonus kazanın."
  },
];

console.log("=== QR Evrensellik Testi ===\n");
testCases.forEach(tc => {
  const r = testQRCampaign(tc.title, tc.rawText);
  console.log(`Kampanya: "${r.title}"`);
  console.log(`  QR/NFC: ${r.isQRorNFC} | Genel Kelime: ${r.hasGeneralSpendKeywords} | Niche: ${r.hasNicheKeywords}`);
  console.log(`  Sonuç: ${r.verdict}`);
  console.log();
});
