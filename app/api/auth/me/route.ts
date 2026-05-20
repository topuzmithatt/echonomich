import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: true, loggedIn: false, user: null });
    }

    return NextResponse.json({
      success: true,
      loggedIn: true,
      user: {
        id: user.id,
        username: user.username,
        cards: user.userCards.map((uc) => uc.cardId),
      },
    });
  } catch (error: any) {
    console.error('Session fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Oturum alınırken bir hata oluştu.' },
      { status: 500 }
    );
  }
}
