import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user_profiles.findMany({
      select: {
        id: true,
        email: true,
        whatsapp: true,
      },
      orderBy: {
        email: 'asc'
      }
    });
    return NextResponse.json({ data: users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
