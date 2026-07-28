import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_PRESETS = [
  {
    tarea: 'Inspección visual',
    descripcion_ot: 'Observación y conteo del dispositivo y accesorios. Revisión visual de la condición general.',
    descripcion_reporte: 'Se realizó una revisión visual del equipo, encontrándose en buen estado físico y sin signos evidentes de daño o desgaste.',
    orden: 1,
  },
  {
    tarea: 'Limpieza superficial',
    descripcion_ot: 'Limpieza y desinfección del dispositivo y los componentes con un paño húmedo en solución de etanol.',
    descripcion_reporte: 'Como medida preventiva, se efectuó una limpieza general utilizando desinfectante a base de etanol y herramientas adecuadas para equipos médicos, asegurando la correcta higiene sin comprometer los componentes.',
    orden: 2,
  },
  {
    tarea: 'Pruebas de funcionamiento',
    descripcion_ot: '1. Prueba de encendido del dispositivo.\n2. Prueba de detección de los accesorios.\n3. Prueba de funcionamiento de los accesorios.',
    descripcion_reporte: 'Se llevaron a cabo pruebas operativas, verificando exitosamente las funciones principales, así como el correcto desempeño de los accesorios conectados.',
    orden: 3,
  },
  {
    tarea: 'Inspección y limpieza de ventiladores',
    descripcion_ot: 'Revisión del estado de los ventiladores y sus conectores. Limpieza de polvo.',
    descripcion_reporte: 'Se realizó la limpieza del ventilador y una inspección de los componentes eléctricos internos, sin hallazgos de anomalías.',
    orden: 4,
  },
  {
    tarea: 'Inspección interna del cableado',
    descripcion_ot: 'Revisión de los conectores. Reemplazo y ajuste de conectores dañados.',
    descripcion_reporte: 'Se realizó una inspección interna del cableado, verificando la integridad de todos los conectores internos.',
    orden: 5,
  },
  {
    tarea: 'Mantenimiento de la estructura',
    descripcion_ot: 'Revisión y ajuste de sujetadores, tornillos y herrajes.',
    descripcion_reporte: 'Se revisaron y ajustaron todos los sujetadores, tornillos y herrajes del dispositivo.',
    orden: 6,
  },
  {
    tarea: 'Inspección de disipadores de calor',
    descripcion_ot: 'Revisión de los disipadores, y reemplazo de pasta térmica.',
    descripcion_reporte: 'Se inspeccionaron los disipadores de calor y se realizó el reemplazo de pasta térmica según corresponde.',
    orden: 7,
  },
]

export async function GET() {
  try {
    let tareas = await prisma.mantenimiento_tareas_preset.findMany({
      orderBy: { orden: 'asc' },
    })

    // Seed defaults if table is empty
    if (tareas.length === 0) {
      await prisma.mantenimiento_tareas_preset.createMany({
        data: DEFAULT_PRESETS,
      })
      tareas = await prisma.mantenimiento_tareas_preset.findMany({
        orderBy: { orden: 'asc' },
      })
    }

    return NextResponse.json(tareas)
  } catch (error: any) {
    console.error('Error fetching tareas preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tarea, descripcion_ot, descripcion_reporte, orden } = body

    if (!tarea || !descripcion_ot || !descripcion_reporte) {
      return NextResponse.json(
        { error: 'Campos obligatorios: tarea, descripcion_ot, descripcion_reporte' },
        { status: 400 }
      )
    }

    const count = await prisma.mantenimiento_tareas_preset.count()

    const newTarea = await prisma.mantenimiento_tareas_preset.create({
      data: {
        tarea: tarea.trim(),
        descripcion_ot: descripcion_ot.trim(),
        descripcion_reporte: descripcion_reporte.trim(),
        orden: orden !== undefined ? Number(orden) : count + 1,
      },
    })

    return NextResponse.json(newTarea, { status: 201 })
  } catch (error: any) {
    console.error('Error creating tarea preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
