import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateClientLetter } from '@/lib/services/letter'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cartas-distribucion/solicitudes/[id]
 * Approve (convert) or reject a solicitud
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: solicitudId } = await params

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
    const { action, comment, editedDetails } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Acción no válida o no especificada' }, { status: 400 })
    }

    // Fetch the original solicitud
    const solicitud = await prisma.solicitudes_carta_distribucion.findUnique({
      where: { id: solicitudId },
      include: {
        clientes: true
      }
    })

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (solicitud.status !== 'pending') {
      return NextResponse.json({ error: `La solicitud ya está ${solicitud.status}` }, { status: 400 })
    }

    if (action === 'reject') {
      if (!comment) {
        return NextResponse.json({ error: 'Se requiere un comentario para rechazar la solicitud' }, { status: 400 })
      }

      // Update status to rejected
      await prisma.$transaction([
        prisma.solicitudes_carta_distribucion.update({
          where: { id: solicitudId },
          data: { status: 'rejected', updated_at: new Date() }
        }),
        prisma.solicitud_carta_acciones.create({
          data: {
            solicitud_id: solicitudId,
            user_id: user.id,
            action: 'reject',
            comment
          }
        })
      ])

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    // Action is approve
    // Extract details to use, from body (if edited) or fallback to solicitud
    const finalHospital = editedDetails?.hospital || solicitud.hospital
    const finalLineas = editedDetails?.lineas_producto || solicitud.lineas_producto // array of strings (names or IDs)
    const finalEstados = editedDetails?.estados || solicitud.estados
    const nextYear = new Date().getFullYear() + 1
    const defaultExpiration = new Date(nextYear, 0, 31, 12, 0, 0) // Jan 31 of next year
    const finalExpirationDate = editedDetails?.expirationDate || defaultExpiration
    const finalDistributorName = editedDetails?.distributorName || solicitud.clientes?.nombre
    const finalRfc = editedDetails?.rfc || solicitud.clientes?.rfc || ''
    const finalCoverage = editedDetails?.coverage || finalEstados.join(', ')

    // Find the matching CRM client record from clients table by RFC or Name
    let targetClientId: string | null = null;
    if (solicitud.clientes?.rfc) {
      const match = await prisma.clients.findFirst({
        where: { rfc: { equals: solicitud.clientes.rfc, mode: 'insensitive' } }
      })
      if (match) targetClientId = match.id;
    }
    if (!targetClientId && solicitud.clientes?.nombre) {
      const match = await prisma.clients.findFirst({
        where: { name: { equals: solicitud.clientes.nombre, mode: 'insensitive' } }
      })
      if (match) targetClientId = match.id;
    }

    if (!targetClientId) {
      return NextResponse.json({
        error: 'No se encontró un registro de distribuidor correspondiente en el CRM (tabla clients) con el mismo RFC o Nombre. Asegúrese de que el distribuidor esté registrado.'
      }, { status: 400 })
    }

    // We need line IDs for generateClientLetter. Let's find IDs from catalog_lines by matching either ID or Name
    const linesDb = await prisma.catalog_lines.findMany({
      where: {
        OR: [
          { id: { in: finalLineas } },
          { name: { in: finalLineas } }
        ]
      }
    })

    const selectedLinesIds = linesDb.map((l: any) => l.id)

    if (selectedLinesIds.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron las líneas de producto correspondientes en el catálogo. Confirme que los nombres de las líneas coinciden.'
      }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost:3000'

    // Generate distributor letter using the official helper
    const result = await generateClientLetter({
      clientId: targetClientId,
      institutionName: finalHospital,
      distributorName: finalDistributorName,
      rfc: finalRfc,
      selectedLines: selectedLinesIds,
      expirationDate: finalExpirationDate,
      createdBy: user.id,
      host,
      coverage: finalCoverage
    })

    // Update status to approved and log the action
    await prisma.$transaction([
      prisma.solicitudes_carta_distribucion.update({
        where: { id: solicitudId },
        data: { status: 'approved', updated_at: new Date() }
      }),
      prisma.solicitud_carta_acciones.create({
        data: {
          solicitud_id: solicitudId,
          user_id: user.id,
          action: 'approve',
          comment: comment || 'Solicitud aprobada y convertida a Carta de Distribución',
          metadata: {
            carta_id: result.letterRecord?.id,
            letter_url: result.letterRecord?.letter_url,
            codigo: result.letterRecord?.codigo
          }
        }
      })
    ])

    return NextResponse.json({ success: true, status: 'approved', letter: result })
  } catch (error: any) {
    console.error('[POST /api/cartas-distribucion/solicitudes/[id]]', error)
    return NextResponse.json({ error: error.message || 'Error al procesar la solicitud' }, { status: 500 })
  }
}
