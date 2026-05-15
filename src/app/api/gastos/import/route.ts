import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Fetch existing categories to help Gemini map them
    const { data: categories } = await supabase
      .from('catalog_spending_categories')
      .select('id, name')
      .order('name')

    const categoryList = categories?.map(c => `${c.name} (ID: ${c.id})`).join(', ') || ''

    const { object } = await generateObject({
      model: google('models/gemini-2.5-flash'),
      schema: z.object({
        spendings: z.array(
          z.object({
            expense_date: z.string().describe('The date of the expense in YYYY-MM-DD format. Extract from header [DD/MM/YYYY] if needed.'),
            description: z.string().describe('The item or service bought (e.g. "Hotel Safi 2 noches"). DO NOT include the person name, amount, or card info.'),
            name: z.string().describe('The person who made the expense (e.g. "Ricardo Puente").'),
            amount: z.number().describe('The numerical value of the expense.'),
            card: z.string().optional().describe('The card or payment method used (e.g. "Tarjeta 8841").'),
            category_id: z.string().optional().describe('The ID of the category that best fits this expense from the provided list.'),
          })
        ),
      }),
      prompt: `Extract spending data from the following WhatsApp chat text. 
      
For each message that looks like an expense:
1. 'name': Extract the name of the person (e.g., "Ricardo Puente", "Alan Reyes").
2. 'description': Extract what was paid for (e.g., "Hotel Safi 2 noches", "Casetas SLP-MTY", "Vuelo 15 de Mayo"). IMPORTANT: Do not include the person's name, the amount, or the card/payment method in the description.
3. 'expense_date': Extract the date. If the message has a header like [DD/MM/YYYY], use that date but convert it to YYYY-MM-DD.
4. 'amount': Extract only the number.
5. 'card': Extract the card or payment method mentioned (e.g., "Tarjeta 8841", "Efectivo").
6. 'category_id': Choose the most appropriate category ID from this list: ${categoryList}. If none fit well, leave it null.

Text to analyze:
${text}`,
    })

    // Add total based on amount (since no tax is typically listed in these messages, total = amount)
    const spendingsWithTotal = object.spendings.map(s => ({
      ...s,
      total: s.amount,
      iva_percent: 0,
      iva: 0,
      is_billable: false,
      is_billed: false,
    }))

    return NextResponse.json({ spendings: spendingsWithTotal })
  } catch (error: any) {
    console.error('AI Import Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to process text' }, { status: 500 })
  }
}
