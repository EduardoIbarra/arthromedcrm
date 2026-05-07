#!/usr/bin/env node
// scripts/seed-csv.js
// Run: node scripts/seed-csv.js
// Seeds the CSV file into Supabase

const fs = require('fs')
const path = require('path')

// Load env vars manually
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
})

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const CSV_PATH = path.join(__dirname, '..', 'Alta de clientes - Respuestas de formulario 1.csv')

function parseDate(s) {
  if (!s) return null
  const parts = s.split(' ')[0].split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`).toISOString()
  }
  return null
}

function splitList(s) {
  if (!s) return []
  return s.split(/[,;]/).map(v => v.trim()).filter(Boolean)
}

function parseCsv(text) {
  const lines = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current.replace(/\r$/, ''))
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)
  return lines
}

function parseFields(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.replace(/^"|"$/g, ''))
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.replace(/^"|"$/g, ''))
  return fields
}

async function main() {
  console.log('📂 Reading CSV...')
  const text = fs.readFileSync(CSV_PATH, 'utf8')
  const lines = parseCsv(text)
  const headers = parseFields(lines[0])
  console.log('📋 Headers:', headers.join(' | '))

  const records = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const fields = parseFields(lines[i])
    const row = {}
    headers.forEach((h, idx) => { row[h] = fields[idx] || '' })

    const client = {
      registered_at: parseDate(row['comerker'] || ''),
      name: (row['Nombre / Razón social'] || '').trim(),
      rfc: row['RFC']?.trim() || null,
      email_primary: row['Dirección de correo electrónico']?.trim() || null,
      zip_code: row['Código postal']?.trim() || null,
      fiscal_address: row['Dirección fiscal']?.trim() || null,
      email_billing: row['Correo electrónico para facturación']?.trim() || null,
      email_contact: row['Correo electrónico de contacto']?.trim() || null,
      phone: row['Teléfono contacto principal']?.trim() || null,
      states: splitList(row['¿En qué estado(s) de la República Mexicana trabaja actualmente? ']),
      hospitals: splitList(row['Seleccione los hospitales o cadena hospitalaria en los que actualmente distribuye nuestros productos. (Puede elegir más de una opción)']),
      specialties: splitList(row['¿En qué especialidades tiene mayor actividad actualmente? ']),
      tax_regime: row['Régimen fiscal']?.trim() || null,
      status: ['Activo','Inactivo','Prospecto'].includes(row['Estado']?.trim()) ? row['Estado'].trim() : 'Activo',
    }

    if (client.name) records.push(client)
  }

  console.log(`📊 Parsed ${records.length} records`)

  // Insert in batches
  const BATCH = 20
  let inserted = 0
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error, data } = await supabase.from('clients').insert(batch).select()
    if (error) {
      console.error(`❌ Error in batch ${i}-${i+BATCH}:`, error.message)
    } else {
      inserted += data.length
      console.log(`✅ Inserted batch ${Math.floor(i/BATCH)+1}: ${data.length} records`)
    }
  }

  console.log(`\n🎉 Done! ${inserted} clients seeded into Supabase.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
