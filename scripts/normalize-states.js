#!/usr/bin/env node
// scripts/normalize-states.js
// Normalizes states, hospitals, and specialties arrays in all client records.
// Run: node scripts/normalize-states.js

const fs = require('fs')
const path = require('path')

// Load env vars
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
})

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── Canonical state names ───────────────────────────────────────
// Key: normalized uppercase version → Value: canonical display name
const STATE_MAP = {
  'AGUASCALIENTES': 'Aguascalientes',
  'BAJA CALIFORNIA': 'Baja California',
  'BAJA CALIFORNIA NORTE': 'Baja California',
  'BAJA CALIFORNIA SUR': 'Baja California Sur',
  'CAMPECHE': 'Campeche',
  'CHIAPAS': 'Chiapas',
  'CHIHUAHUA': 'Chihuahua',
  'CDMX': 'CDMX',
  'CIUDAD DE MEXICO': 'CDMX',
  'CIUDAD DE MÉXICO': 'CDMX',
  'CIUDAD DE MEXICO.': 'CDMX',
  'COAHUILA': 'Coahuila',
  'COAHUILA DE ZARAGOZA': 'Coahuila',
  'COHAUILA': 'Coahuila',   // typo
  'COLIMA': 'Colima',
  'DURANGO': 'Durango',
  'ESTADO DE MEXICO': 'Estado de México',
  'ESTADO DE MÉXICO': 'Estado de México',
  'EDOMEX': 'Estado de México',
  'GUANAJUATO': 'Guanajuato',
  'GUNAJUATO': 'Guanajuato', // typo
  'GUERRERO': 'Guerrero',
  'HIDALGO': 'Hidalgo',
  'JALISCO': 'Jalisco',
  'MICHOACAN': 'Michoacán',
  'MICHOACÁN': 'Michoacán',
  'MORELOS': 'Morelos',
  'NAYARIT': 'Nayarit',
  'NUEVO LEON': 'Nuevo León',
  'NUEVO LEÓN': 'Nuevo León',
  'OAXACA': 'Oaxaca',
  'PUEBLA': 'Puebla',
  'QUERETARO': 'Querétaro',
  'QUERÉTARO': 'Querétaro',
  'QUINTANA ROO': 'Quintana Roo',
  'Q. ROO': 'Quintana Roo',
  'SAN LUIS POTOSI': 'San Luis Potosí',
  'SAN LUIS POTOSÍ': 'San Luis Potosí',
  'SINALOA': 'Sinaloa',
  'SINALOA.': 'Sinaloa',
  'SONORA': 'Sonora',
  'TABASCO': 'Tabasco',
  'TAMAULIPAS': 'Tamaulipas',
  'TLAXCALA': 'Tlaxcala',
  'VERACRUZ': 'Veracruz',
  'YUCATAN': 'Yucatán',
  'YUCATÁN': 'Yucatán',
  'YUCATÁN. CAMPECHE': null, // will be split by comma first, this shouldn't appear
  'ZACATECAS': 'Zacatecas',
  // Cities used as states — map to their state
  'MONTERREY': 'Nuevo León',
  'GUADALAJARA': 'Jalisco',
  'MORELIA': 'Michoacán',
  'MÉRIDA': 'Yucatán',
  'MERIDA': 'Yucatán',
  'TORREON': 'Coahuila',
  'TORREÓN': 'Coahuila',
  'PACHUCA': 'Hidalgo',
  // Catch-all phrases
  'TODA LA REPUBLICA MEXICANA': 'Toda la República',
  'TODA LA REPÚBLICA MEXICANA': 'Toda la República',
  'TODA LA REPÚBLICA MEXICANA ': 'Toda la República',
  // Non-state values — remove
  'SOY REVENDEDOR': null,
  'NO ESPECIFICADO': null,
  'NO ESPEFICICADO': null,
  'SIN DEFINIR': null,
  // Conjunctions that end up as standalone tokens
  'Y': null,
  'AND': null,
  'ALREDEDORES': null,
  'AFUADCSLIENTES': null,  // garbled text from CSV
  'CIUDAD DE MÉXICO.': 'CDMX',
}

function normalizeState(raw) {
  const key = raw.trim().toUpperCase()
  if (key in STATE_MAP) return STATE_MAP[key] // may be null (remove)
  // Fallback: Title Case
  return raw.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function normalizeArray(arr) {
  if (!arr || !Array.isArray(arr)) return arr
  return arr
    .flatMap(item => item.split(/[,;]|\s+y\s+|\s+Y\s+|\s+and\s+/i).map(s => s.trim()).filter(Boolean)) // split multi-state entries
    .map(normalizeState)
    .filter(Boolean) // remove nulls
    .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
}

async function main() {
  console.log('📥 Fetching all clients...')
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, states, hospitals, specialties')
    .order('created_at')

  if (error) { console.error('❌ Fetch error:', error.message); process.exit(1) }
  console.log(`📊 Found ${clients.length} clients\n`)

  let updated = 0
  let skipped = 0

  for (const client of clients) {
    const newStates = normalizeArray(client.states)
    const changed = JSON.stringify(newStates) !== JSON.stringify(client.states)

    if (!changed) { skipped++; continue }

    console.log(`✏️  ${client.name}`)
    if (client.states?.length) {
      console.log(`   Before: ${client.states.join(', ')}`)
      console.log(`   After:  ${newStates.join(', ')}`)
    }

    const { error: upErr } = await supabase
      .from('clients')
      .update({ states: newStates })
      .eq('id', client.id)

    if (upErr) {
      console.error(`   ❌ Error: ${upErr.message}`)
    } else {
      updated++
    }
  }

  console.log(`\n✅ Done — ${updated} updated, ${skipped} already correct.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
