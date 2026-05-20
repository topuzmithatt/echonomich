import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const banks = await prisma.bank.findMany({
      orderBy: { name: 'asc' },
      include: {
        cards: {
          orderBy: { name: 'asc' },
        },
      },
    });
    return NextResponse.json({ success: true, banks });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Bankalar yüklenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
