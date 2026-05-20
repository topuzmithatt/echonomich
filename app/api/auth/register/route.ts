import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { hashPassword, setSessionCookie } from '../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı en az 3 karakter olmalıdır.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Şifre en az 6 karakter olmalıdır.' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Kullanıcı adı benzersiz mi kontrol et
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Bu kullanıcı adı zaten alınmış.' },
        { status: 400 }
      );
    }

    // Şifreyi hash'le ve kaydet
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        password: hashedPassword,
      },
    });

    // Oturum çerezini ata
    setSessionCookie(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        cards: [],
      },
    });
  } catch (error: any) {
    console.error('Kayıt hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
