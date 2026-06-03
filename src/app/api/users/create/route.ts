import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { email, password, first_name, last_name, client_id, position } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son obligatorios' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
       return NextResponse.json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en .env.local' }, { status: 500 });
    }

    // Initialize Supabase admin client inside the request handler
    // to prevent crashes at server startup if the key is missing.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm email so they can log in
      user_metadata: {
        first_name,
        last_name,
      }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // Supabase Auth hook might automatically create a row in user_profiles.
    // So we use upsert to ensure we update it with our specific fields.
    const userProfile = await prisma.user_profiles.upsert({
      where: { id: userId },
      update: {
        email,
        first_name,
        last_name,
        client_id: client_id || null,
        position: position || null,
        // Optional: assign a default role or keep existing
      },
      create: {
        id: userId,
        email,
        first_name,
        last_name,
        client_id: client_id || null,
        position: position || null,
      }
    });

    return NextResponse.json({ data: userProfile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
