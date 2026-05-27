import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/cirugias/usuarios — list all system users for team selection
export async function GET() {
  try {
    const profiles = await prisma.user_profiles.findMany({
      select: { id: true, email: true },
      orderBy: { email: 'asc' },
    })
    return NextResponse.json({ data: profiles })
  } catch (err: any) {
    console.error('[GET /api/cirugias/usuarios]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
