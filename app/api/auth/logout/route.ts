import { NextResponse } from 'next/server';
import { removeSessionCookie } from '../../../../lib/auth';

export async function POST() {
  try {
    removeSessionCookie();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Çıkış hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Çıkış yapılırken bir hata oluştu.' },
      { status: 500 }
    );
  }
}
