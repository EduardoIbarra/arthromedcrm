import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const tickets = await prisma.tickets.findMany({
      include: {
        users: {
          select: {
            email: true,
            raw_user_meta_data: true,
            user_profiles: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json(tickets)
  } catch (error: any) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, reporter_id, assignee } = body

    if (!title || !reporter_id) {
      return NextResponse.json({ error: 'Title and Reporter are required' }, { status: 400 })
    }

    const ticket = await prisma.tickets.create({
      data: {
        title,
        description,
        reporter_id,
        assignee,
        status: 'open'
      },
      include: {
        users: {
          select: {
            email: true,
            raw_user_meta_data: true,
            user_profiles: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(ticket)
  } catch (error: any) {
    console.error('Error creating ticket:', error)
    return NextResponse.json({ error: 'Failed to create ticket: ' + (error.message || String(error)) }, { status: 500 })
  }
}
