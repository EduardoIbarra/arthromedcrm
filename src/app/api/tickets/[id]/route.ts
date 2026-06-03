import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, assignee } = body

    if (!id) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
    }

    const data: any = {}
    if (status !== undefined) data.status = status
    if (assignee !== undefined) data.assignee = assignee
    data.updated_at = new Date()

    const ticket = await prisma.tickets.update({
      where: { id },
      data
    })

    return NextResponse.json(ticket)
  } catch (error: any) {
    console.error('Error updating ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
