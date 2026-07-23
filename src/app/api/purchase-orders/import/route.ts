import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import * as xlsx from 'xlsx'

const extractModelIdentifiers = (text: string): string[] => {
  if (!text) return []
  const clean = text.replace(/[\(\)\[\]\{\}]/g, ' ')
  const rawTokens = clean.split(/[\s,\/\·]+/).filter(Boolean)

  const result = new Set<string>()

  for (const token of rawTokens) {
    const norm = token.trim()
    if (norm.length < 3) continue

    const hasLetters = /[A-Za-z]/.test(norm)
    const hasDigits = /[0-9]/.test(norm)

    if (hasLetters && hasDigits) {
      result.add(norm.toLowerCase())
      const noHyphen = norm.replace(/-/g, '').toLowerCase()
      if (noHyphen.length >= 3) result.add(noHyphen)
    } else if (hasLetters && norm.length >= 4 && norm === norm.toUpperCase()) {
      result.add(norm.toLowerCase())
    }
  }

  return Array.from(result)
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 })

    let purchaseNumber = ''
    let dateStr = ''
    let startIndex = -1
    let formatType: 'bonss' | 'shipping' | 'generic' = 'generic'

    let modelCol = -1
    let codeCol = -1
    let refCol = -1
    let qtyCol = -1

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (!row || !Array.isArray(row)) continue
      
      const rowText = row.join(' ').trim()
      
      // Look for INVOICE NO.
      if (rowText.includes('INVOICE NO.')) {
        const match = rowText.match(/INVOICE NO\.\s*:\s*(\S+)/i)
        if (match && match[1]) {
          purchaseNumber = match[1]
        }
      }

      // Look for Date
      if (rowText.includes('Date ')) {
        const match = rowText.match(/Date\s+([\d\/]+)/i)
        if (match && match[1]) {
          dateStr = match[1]
        }
      }

      // Format 1: BONSS Medical (Item Nº, Model, Ordering Code, Reference, Qty)
      const rowLower = row.map(cell => String(cell || '').toLowerCase())
      if (rowLower.includes('model') && (rowLower.includes('ordering code') || rowLower.includes('qty'))) {
        formatType = 'bonss'
        startIndex = i + 1
        modelCol = rowLower.findIndex(c => c.includes('model'))
        codeCol = rowLower.findIndex(c => c.includes('ordering code') || c.includes('code'))
        refCol = rowLower.findIndex(c => c.includes('reference') || c.includes('description'))
        qtyCol = rowLower.findIndex(c => c.includes('qty') || c.includes('cantidad'))
        break
      }

      // Format 2: SHIPPING MARKS / DESCRIPTION
      if (rowText.includes('SHIPPING MARKS') && rowText.includes('DESCRIPTION')) {
        formatType = 'shipping'
        startIndex = i + 1
        break
      }
    }

    if (!purchaseNumber) {
      const filenameMatch = file.name.match(/(PO[\s_A-Z0-9-]*)/i)
      if (filenameMatch) {
        purchaseNumber = filenameMatch[1].replace(/\.xlsx?$/i, '').trim()
      } else {
        purchaseNumber = file.name.replace(/\.xlsx?$/i, '').trim()
      }
    }

    if (startIndex === -1) {
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (Array.isArray(row) && row.length >= 3 && typeof row[0] === 'number') {
          startIndex = i
          formatType = 'bonss'
          modelCol = 1
          codeCol = 2
          refCol = 3
          qtyCol = 4
          break
        }
      }
    }

    if (startIndex === -1) {
      return NextResponse.json({ error: 'No se pudo identificar la estructura de productos en el archivo Excel.' }, { status: 400 })
    }

    const rawItems: { model: string; code: string; reference: string; originalDescription: string; quantity: number }[] = []

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i]
      if (!row || !Array.isArray(row) || row.length === 0) continue

      const firstCell = String(row[0] || '').trim().toUpperCase()
      if (firstCell === 'TOTAL') break

      if (formatType === 'bonss') {
        const model = modelCol >= 0 ? String(row[modelCol] || '').trim() : ''
        const code = codeCol >= 0 ? String(row[codeCol] || '').trim() : ''
        const reference = refCol >= 0 ? String(row[refCol] || '').trim() : ''
        const qtyRaw = qtyCol >= 0 ? row[qtyCol] : row[row.length - 1]
        
        const qtyMatch = String(qtyRaw || '').match(/(\d+)/)
        const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 0

        if (model || code || reference) {
          const descParts = [model, code, reference].filter(Boolean)
          rawItems.push({
            model,
            code,
            reference,
            originalDescription: descParts.join(' · '),
            quantity
          })
        }
      } else {
        const description = row[1] ? String(row[1]).trim() : ''
        const quantityStr = row[2]
        if (description && quantityStr) {
          const qtyMatch = String(quantityStr).match(/(\d+)/)
          const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1
          rawItems.push({
            model: '',
            code: '',
            reference: description,
            originalDescription: description,
            quantity
          })
        }
      }
    }

    // Fetch all products and catalog lines from primary DB for matching
    const [products, catalogLines] = await Promise.all([
      prisma.productos.findMany({
        select: {
          id: true,
          model: true,
          nombre: true,
          nombre_lista: true,
          order_code: true,
          alegra_id: true,
          generic_description: true,
          alg_description: true,
          descripcion_angeles: true,
          descripcion_hospitales: true,
          line: true
        }
      }),
      prisma.catalog_lines.findMany({
        select: { name: true, color: true }
      })
    ])

    const lineColors = new Map<string, string>()
    for (const line of catalogLines) {
      lineColors.set(line.name.toLowerCase(), line.color)
    }

    const productsWithColor = products.map((p: any) => ({
      ...p,
      line_color: p.line ? (lineColors.get(p.line.toLowerCase()) || null) : null
    }))

    const processedItems = rawItems.map(item => {
      const { model, code, reference, originalDescription, quantity } = item
      const fullItemText = `${model} ${code} ${reference} ${originalDescription}`
      const excelIdentifiers = extractModelIdentifiers(fullItemText)

      const matchedList = productsWithColor.filter((p: any) => {
        const dbFields = [
          p.model,
          p.order_code,
          p.nombre,
          p.nombre_lista,
          p.generic_description,
          p.alg_description,
          p.descripcion_angeles,
          p.descripcion_hospitales
        ].filter(Boolean).join(' ')

        const dbIdentifiers = extractModelIdentifiers(dbFields)
        const dbLower = dbFields.toLowerCase()

        // 1. Check exact or identifier token match
        const identifierMatch = excelIdentifiers.some(id => {
          if (dbIdentifiers.includes(id)) return true
          if (id.length >= 4 && dbLower.includes(id)) return true
          return false
        })

        if (identifierMatch) return true

        // 2. Substring matching for model / code / reference text
        const descLower = originalDescription.toLowerCase()
        const pModel = (p.model || '').toLowerCase().trim()
        const pCode = (p.order_code || '').toLowerCase().trim()

        if (pModel && pModel.length >= 3 && descLower.includes(pModel)) return true
        if (pCode && pCode.length >= 3 && descLower.includes(pCode)) return true

        return false
      })

      // Special override: if the Excel item references AC405 but doesn't mention Neo Blator/NeoBla/Neo,
      // exclude Neo Blator in favor of EZ Blator.
      let filteredMatched = matchedList
      const hasAC405 = excelIdentifiers.includes('ac405') || fullItemText.toLowerCase().includes('ac405')
      const mentionsNeo = fullItemText.toLowerCase().includes('neo') || fullItemText.toLowerCase().includes('neoblator') || fullItemText.toLowerCase().includes('neobla')
      if (hasAC405 && !mentionsNeo) {
        filteredMatched = matchedList.filter((p: any) => {
          const nameLower = `${p.nombre || ''} ${p.nombre_lista || ''} ${p.generic_description || ''}`.toLowerCase()
          return !nameLower.includes('neo blator') && !nameLower.includes('neoblator') && !nameLower.includes('neobla')
        })
        if (filteredMatched.length === 0) {
          filteredMatched = matchedList
        }
      }

      // Calculate matching score based on exact matches vs substring matches
      const getMatchScoreInfo = (p: any) => {
        const dbFields = [
          p.model,
          p.order_code,
          p.nombre,
          p.nombre_lista,
          p.generic_description,
          p.alg_description,
          p.descripcion_angeles,
          p.descripcion_hospitales
        ].filter(Boolean).join(' ')

        const dbIdentifiers = extractModelIdentifiers(dbFields)
        const dbLower = dbFields.toLowerCase()

        let maxExactLength = 0
        let sumExactLength = 0
        let maxSubstrLength = 0
        let sumSubstrLength = 0

        for (const id of excelIdentifiers) {
          const isExact = dbIdentifiers.includes(id)
          const isSubstr = id.length >= 4 && dbLower.includes(id)

          if (isExact) {
            if (id.length > maxExactLength) maxExactLength = id.length
            sumExactLength += id.length
          } else if (isSubstr) {
            if (id.length > maxSubstrLength) maxSubstrLength = id.length
            sumSubstrLength += id.length
          }
        }

        return {
          maxExactLength,
          sumExactLength,
          maxSubstrLength,
          sumSubstrLength
        }
      }

      // Sort matched products: longest exact matched code first, then exact sum, then substring max, then substring sum, then fallback to alegra_id
      const uniqueMap = new Map<string, any>()
      for (const p of filteredMatched) {
        if (!uniqueMap.has(p.id)) {
          uniqueMap.set(p.id, p)
        }
      }
      const matchedProducts = Array.from(uniqueMap.values()).sort((a, b) => {
        const scoreA = getMatchScoreInfo(a)
        const scoreB = getMatchScoreInfo(b)

        if (scoreB.maxExactLength !== scoreA.maxExactLength) return scoreB.maxExactLength - scoreA.maxExactLength
        if (scoreB.sumExactLength !== scoreA.sumExactLength) return scoreB.sumExactLength - scoreA.sumExactLength
        if (scoreB.maxSubstrLength !== scoreA.maxSubstrLength) return scoreB.maxSubstrLength - scoreA.maxSubstrLength
        if (scoreB.sumSubstrLength !== scoreA.sumSubstrLength) return scoreB.sumSubstrLength - scoreA.sumSubstrLength

        const aHasAlg = a.alegra_id && String(a.alegra_id).trim() !== '' ? 1 : 0
        const bHasAlg = b.alegra_id && String(b.alegra_id).trim() !== '' ? 1 : 0
        if (bHasAlg !== aHasAlg) return bHasAlg - aHasAlg

        const aHasLista = a.nombre_lista && String(a.nombre_lista).trim() !== '' ? 1 : 0
        const bHasLista = b.nombre_lista && String(b.nombre_lista).trim() !== '' ? 1 : 0
        return bHasLista - aHasLista
      })

      return {
        originalDescription,
        quantity,
        matchedProducts,
        status: matchedProducts.length === 1 ? 'matched' : (matchedProducts.length > 1 ? 'ambiguous' : 'unmatched')
      }
    })

    return NextResponse.json({
      data: {
        purchaseNumber,
        dateStr,
        items: processedItems
      }
    })

  } catch (error: any) {
    console.error('Error importing PO:', error)
    return NextResponse.json({ error: error.message || 'Error processing file' }, { status: 500 })
  }
}
