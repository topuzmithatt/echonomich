const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Simulate what the API does for the existing user
  const user = await p.user.findFirst({ where: { username: 'topuzmithatt@gmail.com' } });
  if (!user) { console.log('User not found'); return; }

  console.log('User ID:', user.id);

  // Fetch existing userCards to see if they're consistent with current card IDs
  const userCards = await p.userCard.findMany({
    where: { userId: user.id },
    include: { card: true },
  });

  console.log('Existing userCards:', userCards.length);
  userCards.forEach(uc => {
    console.log(`  cardId: ${uc.cardId}, card exists: ${!!uc.card}, name: ${uc.card?.name}`);
  });

  // Check all cards in DB
  const allCards = await p.card.findMany({ include: { bank: true } });
  console.log('\nAll cards in DB:');
  allCards.forEach(c => console.log(`  ${c.id} - ${c.bank.name}: ${c.name}`));

  // Attempt the same transaction the API does
  try {
    const testCardIds = allCards.slice(0, 2).map(c => c.id);
    console.log('\nAttempting transaction with cardIds:', testCardIds);
    await p.$transaction(async (tx) => {
      await tx.userCard.deleteMany({ where: { userId: user.id } });
      if (testCardIds.length > 0) {
        await tx.userCard.createMany({
          data: testCardIds.map(cardId => ({ userId: user.id, cardId })),
        });
      }
    });
    console.log('Transaction succeeded!');

    // Restore
    const originalIds = userCards.map(uc => uc.cardId);
    await p.$transaction(async (tx) => {
      await tx.userCard.deleteMany({ where: { userId: user.id } });
      if (originalIds.length > 0) {
        await tx.userCard.createMany({
          data: originalIds.map(cardId => ({ userId: user.id, cardId })),
        });
      }
    });
    console.log('Restored original cards.');
  } catch (err) {
    console.error('Transaction ERROR:', err);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
