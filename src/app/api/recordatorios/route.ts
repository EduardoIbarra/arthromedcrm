import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET: List all reminders with a summary of their recent logs
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 });
    }

    const reminders = await prisma.whatsapp_reminders.findMany({
      include: {
        _count: {
          select: { whatsapp_reminder_logs: true }
        },
        whatsapp_reminder_logs: {
          orderBy: { sent_at: 'desc' },
          take: 5
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json({ data: reminders });
  } catch (error: any) {
    console.error('[GET /api/recordatorios] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Create a new reminder
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      message,
      target_type,
      target_id,
      time = '17:00',
      notify_all_participants = true,
      extra_contacts = [],
      active = true,
      dates = []
    } = body;

    if (!title || !message || !target_type) {
      return NextResponse.json({ error: 'Missing required fields: title, message, target_type' }, { status: 400 });
    }

    const isEventRequired = target_type !== 'general' && target_type !== 'none';
    if (isEventRequired && !target_id) {
      return NextResponse.json({ error: 'Missing target_id for the selected event type' }, { status: 400 });
    }

    const reminder = await prisma.whatsapp_reminders.create({
      data: {
        title,
        message,
        target_type,
        target_id: isEventRequired ? target_id : null,
        time,
        notify_all_participants: Boolean(notify_all_participants),
        extra_contacts: Array.isArray(extra_contacts) ? extra_contacts : [],
        active: Boolean(active),
        dates: target_type === 'general' && Array.isArray(dates) ? dates : []
      }
    });

    return NextResponse.json({ data: reminder });
  } catch (error: any) {
    console.error('[POST /api/recordatorios] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
