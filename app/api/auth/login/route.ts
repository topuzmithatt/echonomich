import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { comparePassword, setSessionCookie } from '../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı ve şifre zorunludur.' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { username: trimmedUsername },
      include: {
        userCards: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz kullanıcı adı veya şifre.' },
        { status: 400 }
      );
    }

    // Şifreyi doğrula
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz kullanıcı adı veya şifre.' },
        { status: 400 }
      );
    }

    // Oturum çerezini ata
    setSessionCookie(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        cards: user.userCards.map((uc) => uc.cardId),
      },
    });
  } catch (error: any) {
    console.error('Giriş hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
