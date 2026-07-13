import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import * as xlsx from 'xlsx'

// Simple helper to clean and extract alphanumeric model-like strings
const extractPossibleModels = (desc: string): string[] => {
  if (!desc) return []
  // Matches consecutive alphanumeric characters, useful for extracting models like ARS600, AC407A
  const matches = desc.match(/[A-Za-z0-9]+/g)
  return matches ? matches.filter(m => m.length > 2) : [] // Filter out very short strings
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
    
    // Convert to JSON with header: 1 to get raw array of arrays
    const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 })

    let purchaseNumber = ''
    let startIndex = -1

    // Scan the file for INVOICE NO and the start of items
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

      // Look for headers (e.g., SHIPPING MARKS, DESCRIPTION)
      if (rowText.includes('SHIPPING MARKS') && rowText.includes('DESCRIPTION')) {
        startIndex = i + 1
      }
    }

    // If INVOICE NO wasn't found in text, try to extract from filename
    if (!purchaseNumber) {
      const filenameMatch = file.name.match(/([A-Z0-9]+-[0-9]+)/i)
      if (filenameMatch) {
        purchaseNumber = filenameMatch[1]
      }
    }

    if (startIndex === -1) {
      return NextResponse.json({ error: 'No se pudo identificar la tabla de productos (falta SHIPPING MARKS / DESCRIPTION)' }, { status: 400 })
    }

    const rawItems = []
    for (let i = startIndex; i < data.length; i++) {
      const row = data[i]
      if (!row || !Array.isArray(row) || row.length === 0) continue

      const description = row[1] // Usually at index 1 based on the format
      const quantityStr = row[2] // Usually at index 2

      if (description && typeof description === 'string' && quantityStr) {
        const qtyMatch = String(quantityStr).match(/(\d+)/)
        const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1
        rawItems.push({
          description: description.trim(),
          quantity
        })
      }
    }

    // Fetch all products to do fuzzy matching
    const products = await prisma.productos.findMany({
      select: {
        id: true,
        model: true,
        nombre: true,
        order_code: true
      }
    })

    const processedItems = rawItems.map(item => {
      const { description, quantity } = item
      const possibleModels = extractPossibleModels(description)
      
      const matchedProducts = products.filter((p: any) => {
        if (!p.model) return false
        // Precise substring matching against the description
        if (description.toLowerCase().includes(p.model.toLowerCase())) return true
        
        // Also check if extracted models match
        return possibleModels.some(modelStr => 
          p.model?.toLowerCase() === modelStr.toLowerCase() ||
          p.order_code?.toLowerCase() === modelStr.toLowerCase()
        )
      })

      return {
        originalDescription: description,
        quantity,
        matchedProducts,
        status: matchedProducts.length === 1 ? 'matched' : (matchedProducts.length > 1 ? 'ambiguous' : 'unmatched')
      }
    })

    return NextResponse.json({
      data: {
        purchaseNumber,
        items: processedItems
      }
    })

  } catch (error: any) {
    console.error('Error importing PO:', error)
    return NextResponse.json({ error: error.message || 'Error processing file' }, { status: 500 })
  }
}
