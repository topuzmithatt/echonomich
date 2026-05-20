const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cards = await p.card.findMany({ include: { bank: true }, orderBy: { name: 'asc' } });
  console.log('Total cards in DB:', cards.length);
  cards.forEach(c => console.log(`  ${c.bank.name} -> "${c.name}" (id: ${c.id})`));

  const userCards = await p.userCard.findMany({ include: { card: { include: { bank: true } }, user: true } });
  console.log('\nTotal user-card links:', userCards.length);
  userCards.forEach(uc => console.log(`  User: ${uc.user.username} -> Card: ${uc.card.name} (${uc.card.bank.name})`));
}

main().catch(console.error).finally(() => p.$disconnect());
