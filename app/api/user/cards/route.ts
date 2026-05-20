import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUser } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Bu işlem için giriş yapmalısınız.' },
        { status: 401 }
      );
    }

    const { cardIds } = await request.json();

    if (!Array.isArray(cardIds)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz kart verisi.' },
        { status: 400 }
      );
    }

    // Seçilen kart ID'lerinin geçerliliğini kontrol et
    const validCards = await prisma.card.findMany({
      where: { id: { in: cardIds } },
      select: { id: true },
    });
    const validCardIds = validCards.map((c) => c.id);

    // Mevcut kartları temizle ve yenilerini ekle (Transaction içinde)
    await prisma.$transaction([
      prisma.userCard.deleteMany({
        where: { userId: user.id },
      }),
      prisma.userCard.createMany({
        data: validCardIds.map((cardId) => ({
          userId: user.id,
          cardId,
        })),
      }),
    ]);

    return NextResponse.json({
      success: true,
      cards: validCardIds,
    });
  } catch (error: any) {
    console.error('Kart güncelleme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Kart bilgileri güncellenirken sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
