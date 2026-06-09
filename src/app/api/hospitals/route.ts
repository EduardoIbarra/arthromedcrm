import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/hospitals - list hospitals
export async function GET() {
  try {
    const data = await prisma.hospitals.findMany({
      include: { group: true },
    });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[GET /api/hospitals]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/hospitals - create new hospital
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, notes, admission_process, billing_process, group_id } = body;
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const data = await prisma.hospitals.create({
      data: { name, notes, admission_process, billing_process, group_id },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/hospitals]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
