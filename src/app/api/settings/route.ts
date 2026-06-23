import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (key) {
      let setting = await prisma.app_settings.findUnique({
        where: { key }
      })
      if (!setting && key === 'delivery_time_days') {
        setting = await prisma.app_settings.create({
          data: {
            key: 'delivery_time_days',
            value: '25'
          }
        })
      }
      return NextResponse.json({ value: setting?.value ?? null })
    }
    
    const settings = await prisma.app_settings.findMany()
    return NextResponse.json({ data: settings })
  } catch (error: any) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: 'Missing setting key' }, { status: 400 })
    }

    const updated = await prisma.app_settings.upsert({
      where: { key },
      update: { value, updated_at: new Date() },
      create: { key, value }
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error('POST /api/settings error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
