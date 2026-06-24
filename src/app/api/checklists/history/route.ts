import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const setting = await prisma.app_settings.findUnique({
      where: { key: 'checklist_history' }
    })

    const history = setting ? setting.value : []
    return NextResponse.json({ data: history })
  } catch (err: any) {
    console.error('[GET /api/checklists/history]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { entry } = body

    if (!entry) {
      return NextResponse.json({ error: 'entry is required' }, { status: 400 })
    }

    // Get current history
    const setting = await prisma.app_settings.findUnique({
      where: { key: 'checklist_history' }
    })

    const currentHistory = setting ? (setting.value as any[]) : []
    const updatedHistory = [entry, ...currentHistory]

    const updatedSetting = await prisma.app_settings.upsert({
      where: { key: 'checklist_history' },
      update: { value: updatedHistory as any, updated_at: new Date() },
      create: { key: 'checklist_history', value: updatedHistory as any }
    })

    return NextResponse.json({ data: updatedSetting.value })
  } catch (err: any) {
    console.error('[POST /api/checklists/history]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
