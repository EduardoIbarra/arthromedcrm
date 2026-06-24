import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import seedData from '@/data/checklists_seed.json'

export async function GET() {
  try {
    let setting = await prisma.app_settings.findUnique({
      where: { key: 'checklist_templates' }
    })

    if (!setting) {
      // Seed the templates in the database if they don't exist yet
      setting = await prisma.app_settings.create({
        data: {
          key: 'checklist_templates',
          value: seedData as any
        }
      })
    }

    return NextResponse.json({ data: setting.value })
  } catch (err: any) {
    console.error('[GET /api/checklists]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { checklists } = body

    if (!Array.isArray(checklists)) {
      return NextResponse.json({ error: 'checklists must be an array' }, { status: 400 })
    }

    const setting = await prisma.app_settings.upsert({
      where: { key: 'checklist_templates' },
      update: { value: checklists as any, updated_at: new Date() },
      create: { key: 'checklist_templates', value: checklists as any }
    })

    return NextResponse.json({ data: setting.value })
  } catch (err: any) {
    console.error('[POST /api/checklists]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
