import React from 'react';
import { prisma } from '../lib/prisma';
import { getAuthUser } from '../lib/auth';
import Calculator from '../components/Calculator';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Veritabanındaki kategorileri çekiyoruz.
  let categories = await prisma.category.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  // Self-healing / Auto-seed: Eğer veritabanı tamamen boşsa testlerin kolaylaşması için varsayılan kategorileri oluşturuyoruz.
  if (categories.length === 0) {
    try {
      await prisma.category.createMany({
        data: [
          { name: 'Akaryakıt' },
          { name: 'Market' },
          { name: 'Yemek & Restoran' },
          { name: 'Seyahat & Turizm' },
          { name: 'Giyim & Aksesuar' },
          { name: 'Elektronik & Beyaz Eşya' },
          { name: 'E-Ticaret' },
          { name: 'Eğitim & Kırtasiye' },
          { name: 'Ev, Dekorasyon & Yapı Market' },
          { name: 'Sağlık & Kozmetik' },
          { name: 'Kültür, Sanat & Eğlence' },
          { name: 'Diğer' },
        ],
      });
      categories = await prisma.category.findMany({
        orderBy: {
          name: 'asc',
        },
      });
    } catch (e) {
      console.error('Kategori otomatik tohumlama hatası:', e);
    }
  }

  // Dinamik istatistikleri çekelim
  const campaignCount = await prisma.campaign.count();
  const bankCount = await prisma.bank.count();

  // Oturum bilgisini çekelim
  const user = await getAuthUser();
  const initialUser = user ? {
    username: user.username,
    cards: user.userCards.map((uc) => uc.cardId),
  } : null;

  return (
    <main className="container">
      <Calculator 
        categories={categories} 
        initialUser={initialUser}
        campaignCount={campaignCount}
        bankCount={bankCount}
      />
    </main>
  );
}

