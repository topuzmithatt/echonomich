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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'İstek gövdesi okunamadı.' },
        { status: 400 }
      );
    }

    const { cardIds } = body;

    if (!Array.isArray(cardIds)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz kart verisi.' },
        { status: 400 }
      );
    }

    // Seçilen kart ID'lerinin geçerliliğini kontrol et
    let validCardIds: string[] = [];
    if (cardIds.length > 0) {
      const validCards = await prisma.card.findMany({
        where: { id: { in: cardIds } },
        select: { id: true },
      });
      validCardIds = validCards.map((c) => c.id);
    }

    // Sequential operations (SQLite uyumlu — transaction yok)
    // 1. Mevcut kartları sil
    await prisma.userCard.deleteMany({
      where: { userId: user.id },
    });

    // 2. Yeni kartları ekle
    if (validCardIds.length > 0) {
      await prisma.userCard.createMany({
        data: validCardIds.map((cardId) => ({
          userId: user.id,
          cardId,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      cards: validCardIds,
    });
  } catch (error: any) {
    console.error('Kart güncelleme hatası detay:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack?.substring(0, 300),
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Kart bilgileri güncellenirken sunucu hatası oluştu.',
        details: error?.message || 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}
