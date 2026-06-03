import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updates = await prisma.ticket_updates.findMany({
      where: { ticket_id: id },
      include: {
        users: {
          select: {
            email: true,
            user_profiles: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'asc' }
    })
    return NextResponse.json(updates)
  } catch (error: any) {
    console.error('Error fetching ticket updates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, user_id, status } = body

    if (!content || !user_id) {
      return NextResponse.json({ error: 'Content and user_id are required' }, { status: 400 })
    }

    // Wrap in a transaction if we are also updating status
    let updateData;
    if (status) {
      const [update, ticket] = await prisma.$transaction([
        prisma.ticket_updates.create({
          data: {
            ticket_id: id,
            user_id,
            content
          },
          include: {
            users: {
              select: { email: true, user_profiles: { select: { first_name: true, last_name: true } } }
            }
          }
        }),
        prisma.tickets.update({
          where: { id },
          data: { status, updated_at: new Date() }
        })
      ])
      updateData = update;
    } else {
      updateData = await prisma.ticket_updates.create({
        data: {
          ticket_id: id,
          user_id,
          content
        },
        include: {
          users: {
            select: { email: true, user_profiles: { select: { first_name: true, last_name: true } } }
          }
        }
      })
    }

    return NextResponse.json(updateData)
  } catch (error: any) {
    console.error('Error creating ticket update:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
