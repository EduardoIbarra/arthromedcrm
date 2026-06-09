import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/landing-pages/[id] — get a specific landing page
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const landingPage = await prisma.landing_pages.findUnique({
      where: { id },
      include: {
        congresos: {
          select: {
            id: true,
            name: true,
            congress_contacts: true
          }
        }
      }
    })

    if (!landingPage) {
      return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })
    }

    return NextResponse.json({ data: landingPage })
  } catch (err: any) {
    console.error('Error fetching landing page:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH /api/landing-pages/[id] — update a landing page
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const body = await request.json()
    const {
      slug,
      title_es,
      title_en,
      title_zh,
      description_es,
      description_en,
      description_zh,
      greeting_es,
      greeting_en,
      greeting_zh,
      specialty_ids,
      catalogo_ids,
      contacts,
      congress_id
    } = body

    // Validate that the landing page exists
    const existing = await prisma.landing_pages.findUnique({
      where: { id }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })
    }

    // Check slug uniqueness if changed
    if (slug && slug !== existing.slug) {
      const slugConflict = await prisma.landing_pages.findUnique({
        where: { slug }
      })
      if (slugConflict) {
        return NextResponse.json({ error: 'Slug must be unique' }, { status: 400 })
      }
    }

    const data = await prisma.landing_pages.update({
      where: { id },
      data: {
        slug: slug !== undefined ? slug : existing.slug,
        title_es: title_es !== undefined ? title_es : existing.title_es,
        title_en: title_en !== undefined ? title_en : existing.title_en,
        title_zh: title_zh !== undefined ? title_zh : existing.title_zh,
        description_es: description_es !== undefined ? description_es : existing.description_es,
        description_en: description_en !== undefined ? description_en : existing.description_en,
        description_zh: description_zh !== undefined ? description_zh : existing.description_zh,
        greeting_es: greeting_es !== undefined ? greeting_es : existing.greeting_es,
        greeting_en: greeting_en !== undefined ? greeting_en : existing.greeting_en,
        greeting_zh: greeting_zh !== undefined ? greeting_zh : existing.greeting_zh,
        specialty_ids: specialty_ids !== undefined ? specialty_ids : existing.specialty_ids,
        catalogo_ids: catalogo_ids !== undefined ? catalogo_ids : existing.catalogo_ids,
        contacts: contacts !== undefined ? contacts : existing.contacts,
        congress_id: congress_id !== undefined ? congress_id : existing.congress_id,
        updated_at: new Date()
      }
    })

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('Error updating landing page:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/landing-pages/[id] — delete a landing page
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const existing = await prisma.landing_pages.findUnique({
      where: { id }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })
    }

    await prisma.landing_pages.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Landing page deleted successfully' })
  } catch (err: any) {
    console.error('Error deleting landing page:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
