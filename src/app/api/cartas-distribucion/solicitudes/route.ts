import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cartas-distribucion/solicitudes
 * List all solicitudes de carta de distribución
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const clientId = searchParams.get('client_id') || ''
    const search = (searchParams.get('search') || '').trim()

    const where: any = {}

    if (status && status !== 'all') {
      where.status = status
    }

    if (clientId) {
      where.client_id = clientId
    }

    if (search) {
      where.OR = [
        { hospital: { contains: search, mode: 'insensitive' } },
        { clientes: { nombre: { contains: search, mode: 'insensitive' } } },
        { clientes: { rfc: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const [solicitudes, clientsWithOptions] = await Promise.all([
      prisma.solicitudes_carta_distribucion.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          clientes: {
            select: {
              id: true,
              nombre: true,
              rfc: true
            }
          },
          users: {
            select: {
              id: true,
              email: true
            }
          },
          solicitud_carta_acciones: {
            orderBy: { created_at: 'desc' },
            include: {
              users: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          }
        }
      }),
      // Fetch list of clients who have submitted at least one solicitud, for filtering
      prisma.solicitudes_carta_distribucion.findMany({
        select: {
          client_id: true,
          clientes: {
            select: {
              id: true,
              nombre: true
            }
          }
        },
        distinct: ['client_id']
      })
    ])

    const clientOptions = clientsWithOptions
      .map((s: any) => s.clientes)
      .filter(Boolean)

    return NextResponse.json({
      data: solicitudes,
      filters: {
        clients: clientOptions
      }
    })
  } catch (error: any) {
    console.error('[GET /api/cartas-distribucion/solicitudes]', error)
    return NextResponse.json({ error: error.message || 'Error al listar solicitudes' }, { status: 500 })
  }
}

/**
 * POST /api/cartas-distribucion/solicitudes
 * Add a comment or general action log
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { solicitudId, action, comment, metadata } = body

    if (!solicitudId || !action) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const log = await prisma.solicitud_carta_acciones.create({
      data: {
        solicitud_id: solicitudId,
        user_id: user.id,
        action,
        comment,
        metadata: metadata || {}
      },
      include: {
        users: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({ success: true, log })
  } catch (error: any) {
    console.error('[POST /api/cartas-distribucion/solicitudes]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
