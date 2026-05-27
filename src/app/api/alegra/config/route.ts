import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const email = process.env.ALEGRA_API_EMAIL
  const token = process.env.ALEGRA_API_TOKEN
  
  return NextResponse.json({
    configured: !!(email && token),
    email: email ? `${email.substring(0, 3)}***@${email.split('@')[1] || 'domain.com'}` : null
  })
}
