import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/landing-pages — list all landing pages
export async function GET(request: NextRequest) {
  try {
    const landingPages = await prisma.landing_pages.findMany({
      include: {
        congresos: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({ data: landingPages })
  } catch (err: any) {
    console.error('Error fetching landing pages:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/landing-pages — create a landing page
export async function POST(request: NextRequest) {
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
      specialty_ids = [],
      catalogo_ids = [],
      contacts = [],
      congress_id = null
    } = body

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }
    if (!title_es) {
      return NextResponse.json({ error: 'Spanish title is required' }, { status: 400 })
    }

    // Check if slug is unique
    const existing = await prisma.landing_pages.findUnique({
      where: { slug }
    })
    if (existing) {
      return NextResponse.json({ error: 'Slug must be unique' }, { status: 400 })
    }

    const data = await prisma.landing_pages.create({
      data: {
        slug,
        title_es,
        title_en: title_en || title_es,
        title_zh: title_zh || title_es,
        description_es,
        description_en: description_en || description_es,
        description_zh: description_zh || description_es,
        greeting_es: greeting_es || '',
        greeting_en: greeting_en || greeting_es || '',
        greeting_zh: greeting_zh || greeting_es || '',
        specialty_ids,
        catalogo_ids,
        contacts,
        congress_id
      }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating landing page:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
