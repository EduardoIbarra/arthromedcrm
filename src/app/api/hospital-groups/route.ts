import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type HospitalGroup = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const { data, error } = await supabase.from('hospital_groups').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data as HospitalGroup[]);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { error } = await supabase.from('hospital_groups').insert({ name: body.name });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { error } = await supabase
    .from('hospital_groups')
    .update({ name: body.name })
    .eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabase.from('hospital_groups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 200 });
}
