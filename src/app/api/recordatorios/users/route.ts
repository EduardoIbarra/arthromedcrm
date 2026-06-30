import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Access denied: Unauthenticated' }, { status: 401 });
    }

    // 2. Fetch user profiles
    const users = await prisma.user_profiles.findMany({
      select: {
        id: true,
        email: true,
        whatsapp: true,
        first_name: true,
        last_name: true,
        position: true,
      },
      orderBy: {
        first_name: 'asc'
      }
    });

    return NextResponse.json({ data: users });
  } catch (error: any) {
    console.error('[GET /api/recordatorios/users] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
