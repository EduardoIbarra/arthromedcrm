import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

// List of allowed admin emails
const ADMIN_EMAILS = [
  'eduardo.delacruz@arthromed.com.mx',
  'admin@arthromed.com.mx'
];

export async function GET() {
  // Initialize Supabase client on server side (includes cookies)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If no user or email not in admin list, deny access
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const users = await prisma.user_profiles.findMany({
      select: {
        id: true,
        email: true,
        whatsapp: true,
        first_name: true,
        last_name: true,
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
