import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const setting = await prisma.app_settings.findUnique({
      where: { key: 'pending_checklists' }
    })

    const pending = setting ? setting.value : []
    return NextResponse.json({ data: pending })
  } catch (err: any) {
    console.error('[GET /api/checklists/pending]', err)
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

    // Get current pending checklists
    const setting = await prisma.app_settings.findUnique({
      where: { key: 'pending_checklists' }
    })

    const currentPending = setting ? (setting.value as any[]) : []
    
    // Check if it's an update of an existing pending checklist
    const existsIdx = currentPending.findIndex(item => item.id === entry.id)
    let updatedPending = [...currentPending]
    if (existsIdx >= 0) {
      updatedPending[existsIdx] = entry
    } else {
      updatedPending = [entry, ...currentPending]
    }

    const updatedSetting = await prisma.app_settings.upsert({
      where: { key: 'pending_checklists' },
      update: { value: updatedPending as any, updated_at: new Date() },
      create: { key: 'pending_checklists', value: updatedPending as any }
    })

    return NextResponse.json({ data: updatedSetting.value })
  } catch (err: any) {
    console.error('[POST /api/checklists/pending]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 })
    }

    // Get current pending checklists
    const setting = await prisma.app_settings.findUnique({
      where: { key: 'pending_checklists' }
    })

    if (!setting) {
      return NextResponse.json({ data: [] })
    }

    const currentPending = setting.value as any[]
    const updatedPending = currentPending.filter(item => item.id !== id)

    const updatedSetting = await prisma.app_settings.update({
      where: { key: 'pending_checklists' },
      data: { value: updatedPending as any, updated_at: new Date() }
    })

    return NextResponse.json({ data: updatedSetting.value })
  } catch (err: any) {
    console.error('[DELETE /api/checklists/pending]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
