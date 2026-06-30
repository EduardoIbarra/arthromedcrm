import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

// PATCH: Update a reminder
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    
    // Build update object
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.message !== undefined) updateData.message = body.message;
    if (body.target_type !== undefined) updateData.target_type = body.target_type;
    if (body.target_type === 'general' || body.target_type === 'none') {
      updateData.target_id = null;
    } else if (body.target_id !== undefined) {
      updateData.target_id = body.target_id || null;
    }
    if (body.time !== undefined) updateData.time = body.time;
    if (body.notify_all_participants !== undefined) updateData.notify_all_participants = Boolean(body.notify_all_participants);
    if (body.extra_contacts !== undefined) updateData.extra_contacts = Array.isArray(body.extra_contacts) ? body.extra_contacts : [];
    if (body.active !== undefined) updateData.active = Boolean(body.active);
    
    updateData.updated_at = new Date();

    const reminder = await prisma.whatsapp_reminders.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ data: reminder });
  } catch (error: any) {
    console.error('[PATCH /api/recordatorios/:id] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Delete a reminder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.whatsapp_reminders.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Reminder deleted successfully' });
  } catch (error: any) {
    console.error('[DELETE /api/recordatorios/:id] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
