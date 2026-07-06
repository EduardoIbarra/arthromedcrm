import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface PackedItem {
  id: string
  productName: string
  folio: string
  customerName: string
  qty: number
  weight: number
  dimensions: { largo: number; ancho: number; alto: number }
  missingDimensions: boolean
}

interface BoxType {
  id: string
  name: string
  largo: number
  ancho: number
  alto: number
  color: string
  peso_max: number
  volume: number
}

interface PackedBox {
  boxId: string
  boxType: string
  boxColor: string
  dimensions: { largo: number; ancho: number; alto: number }
  maxWeight: number
  currentWeight: number
  volume: number
  volumeUsed: number
  volumeUtilization: number
  items: PackedItem[]
}

// Normalize sizes to cm
function normalizeToCm(val: number | null | undefined, unit: string | null | undefined, defaultVal = 5): number {
  if (val === null || val === undefined || val <= 0) return defaultVal
  const u = (unit || 'cm').toLowerCase().trim()
  if (u === 'in' || u === 'inch') return val * 2.54
  if (u === 'mm') return val * 0.1
  return val
}

// Helper to check if item of dims (w, h, d) fits in space of dims (sw, sh, sd) under some rotation
function getFittingRotation(
  w: number, h: number, d: number,
  sw: number, sh: number, sd: number
): { ow: number; oh: number; od: number } | null {
  const rotations = [
    { ow: w, oh: h, od: d },
    { ow: w, oh: d, od: h },
    { ow: h, oh: w, od: d },
    { ow: h, oh: d, od: w },
    { ow: d, oh: w, od: h },
    { ow: d, oh: h, od: w }
  ]

  for (const rot of rotations) {
    if (rot.ow <= sw && rot.oh <= sh && rot.od <= sd) {
      return rot
    }
  }
  return null
}

export async function POST(req: Request) {
  try {
    const { allocations, mixFacturas } = await req.json()

    if (!allocations || !Array.isArray(allocations)) {
      return NextResponse.json({ error: 'Faltan datos de asignación' }, { status: 400 })
    }

    // 1. Fetch all boxes
    const dbBoxes = await prisma.cajas.findMany({
      orderBy: { name: 'asc' }
    })

    const boxTypes: BoxType[] = dbBoxes.map((b: any) => {
      const largo = normalizeToCm(b.largo, b.unidad, 10)
      const ancho = normalizeToCm(b.ancho, b.unidad, 10)
      const alto = normalizeToCm(b.alto, b.unidad, 10)
      return {
        id: b.id,
        name: b.name,
        largo,
        ancho,
        alto,
        color: b.color || '#0763a9',
        peso_max: b.peso_max || 9999, // default large weight limit
        volume: largo * ancho * alto
      }
    }).sort((a: BoxType, b: BoxType) => a.volume - b.volume) // smallest volume first

    if (boxTypes.length === 0) {
      return NextResponse.json({ error: 'No hay tipos de cajas definidos en /cajas' }, { status: 400 })
    }

    // 2. Fetch products to get dimensions/weights
    const productNames = Array.from(new Set(allocations.map(a => a.product).filter(Boolean)))
    const dbProducts = await prisma.productos.findMany({
      where: {
        OR: [
          { nombre: { in: productNames } },
          { nombre_lista: { in: productNames } }
        ]
      }
    })

    const productMap = new Map<string, any>()
    for (const p of dbProducts) {
      if (p.nombre_lista) productMap.set(p.nombre_lista.toLowerCase().trim(), p)
      if (p.nombre) productMap.set(p.nombre.toLowerCase().trim(), p)
    }

    // 3. Prepare items to pack
    const activeAllocations = allocations.filter(a => a.allocatedQty > 0)
    const itemsToPack: PackedItem[] = []

    for (const alloc of activeAllocations) {
      const key = (alloc.product || '').toLowerCase().trim()
      const prod = productMap.get(key)

      const largo = prod ? normalizeToCm(prod.depth, prod.measurement_unit, 0) : 0
      const ancho = prod ? normalizeToCm(prod.width, prod.measurement_unit, 0) : 0
      const alto = prod ? normalizeToCm(prod.height, prod.measurement_unit, 0) : 0
      const weight = prod?.weight || 0

      const missingDimensions = largo <= 0 || ancho <= 0 || alto <= 0

      // Use default small dims if missing
      const finalLargo = missingDimensions ? 5 : largo
      const finalAncho = missingDimensions ? 5 : ancho
      const finalAlto = missingDimensions ? 5 : alto
      const finalWeight = weight <= 0 ? 0.1 : weight

      for (let i = 0; i < alloc.allocatedQty; i++) {
        itemsToPack.push({
          id: `${alloc.id}-${i}`,
          productName: alloc.product,
          folio: alloc.folio,
          customerName: alloc.customerName,
          qty: 1,
          weight: finalWeight,
          dimensions: { largo: finalLargo, ancho: finalAncho, alto: finalAlto },
          missingDimensions
        })
      }
    }

    // 4. Group items to pack: Cannot mix customers. Optionally mix facturas of same customer.
    const groups: Record<string, PackedItem[]> = {}
    for (const item of itemsToPack) {
      const key = mixFacturas ? item.customerName : `${item.customerName}||${item.folio}`
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }

    const packedBoxes: PackedBox[] = []
    const unpackedItems: PackedItem[] = []

    // 5. Pack each group
    for (const [groupKey, groupItems] of Object.entries(groups)) {
      // Sort group items by volume descending (standard FFD heuristic)
      groupItems.sort((a, b) => {
        const volA = a.dimensions.largo * a.dimensions.ancho * a.dimensions.alto
        const volB = b.dimensions.largo * b.dimensions.ancho * b.dimensions.alto
        return volB - volA
      })

      let itemsLeft = [...groupItems]

      while (itemsLeft.length > 0) {
        // Try to pack as many items as possible.
        const firstItem = itemsLeft[0]
        const candidateBoxes = boxTypes.filter(b => {
          return getFittingRotation(
            firstItem.dimensions.largo, firstItem.dimensions.ancho, firstItem.dimensions.alto,
            b.largo, b.ancho, b.alto
          ) !== null && b.peso_max >= firstItem.weight
        })

        if (candidateBoxes.length === 0) {
          // This item literally doesn't fit in any box type
          unpackedItems.push(firstItem)
          itemsLeft.shift()
          continue
        }

        // Open a new box of the largest candidate box type to maximize capacity.
        const chosenBoxType = candidateBoxes[candidateBoxes.length - 1]

        // Open the box
        const newBox: PackedBox = {
          boxId: `box-${crypto.randomUUID()}`,
          boxType: chosenBoxType.name,
          boxColor: chosenBoxType.color,
          dimensions: { largo: chosenBoxType.largo, ancho: chosenBoxType.ancho, alto: chosenBoxType.alto },
          maxWeight: chosenBoxType.peso_max,
          currentWeight: 0,
          volume: chosenBoxType.volume,
          volumeUsed: 0,
          volumeUtilization: 0,
          items: []
        }

        interface EmptySpace {
          x: number; y: number; z: number
          w: number; h: number; d: number
        }
        let emptySpaces: EmptySpace[] = [
          { x: 0, y: 0, z: 0, w: chosenBoxType.largo, h: chosenBoxType.ancho, d: chosenBoxType.alto }
        ]

        const skippedItems: PackedItem[] = []

        for (const item of itemsLeft) {
          if (newBox.currentWeight + item.weight > newBox.maxWeight) {
            skippedItems.push(item)
            continue
          }

          // Try to fit in any of the empty spaces
          let fitIdx = -1
          let bestRotation: { ow: number; oh: number; od: number } | null = null

          for (let sIdx = 0; sIdx < emptySpaces.length; sIdx++) {
            const space = emptySpaces[sIdx]
            const rot = getFittingRotation(
              item.dimensions.largo, item.dimensions.ancho, item.dimensions.alto,
              space.w, space.h, space.d
            )
            if (rot) {
              fitIdx = sIdx
              bestRotation = rot
              break
            }
          }

          if (fitIdx !== -1 && bestRotation) {
            // Pack item
            const space = emptySpaces[fitIdx]
            newBox.items.push(item)
            newBox.currentWeight += item.weight
            const itemVol = item.dimensions.largo * item.dimensions.ancho * item.dimensions.alto
            newBox.volumeUsed += itemVol

            // Split the empty space
            const { ow, oh, od } = bestRotation
            emptySpaces.splice(fitIdx, 1)

            // Create 3 new spaces
            const spaceRight = { x: space.x + ow, y: space.y, z: space.z, w: space.w - ow, h: oh, d: od }
            const spaceFront = { x: space.x, y: space.y + oh, z: space.z, w: space.w, h: space.h - oh, d: od }
            const spaceAbove = { x: space.x, y: space.y, z: space.z + od, w: space.w, h: space.h, d: space.d - od }

            if (spaceRight.w > 0 && spaceRight.h > 0 && spaceRight.d > 0) emptySpaces.push(spaceRight)
            if (spaceFront.w > 0 && spaceFront.h > 0 && spaceFront.d > 0) emptySpaces.push(spaceFront)
            if (spaceAbove.w > 0 && spaceAbove.h > 0 && spaceAbove.d > 0) emptySpaces.push(spaceAbove)

            emptySpaces.sort((a, b) => (a.w * a.h * a.d) - (b.w * b.h * b.d))
          } else {
            skippedItems.push(item)
          }
        }

        newBox.volumeUtilization = parseFloat(((newBox.volumeUsed / newBox.volume) * 100).toFixed(1))
        
        // Group identical products inside the packed box list for cleaner view
        const aggregatedItemsMap = new Map<string, PackedItem>()
        for (const item of newBox.items) {
          const key = `${item.productName}||${item.folio}`
          if (!aggregatedItemsMap.has(key)) {
            aggregatedItemsMap.set(key, { ...item })
          } else {
            const existing = aggregatedItemsMap.get(key)!
            existing.qty += 1
            existing.weight += item.weight
          }
        }
        newBox.items = Array.from(aggregatedItemsMap.values())

        packedBoxes.push(newBox)
        itemsLeft = skippedItems
      }
    }

    return NextResponse.json({ packedBoxes, unpackedItems })
  } catch (error: any) {
    console.error('Error in pack-boxes API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
