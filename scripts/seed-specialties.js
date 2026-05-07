#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load env vars
const envPath = path.join(__dirname, '..', '.env.local')
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found')
  process.exit(1)
}

const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const specialties = [
  'Ortopedia y Traumatología',
  'Cirugía de Columna',
  'Artroscopia y Cirugía Deportiva',
  'Cirugía de Rodilla',
  'Cirugía de Cadera',
  'Cirugía de Hombro',
  'Cirugía de Pie y Tobillo',
  'Cirugía de Mano',
  'Reumatología',
  'Medicina del Deporte',
  'Neurocirugía',
  'Otorrinolaringología',
  'Cardiología',
  'Urología',
  'Cirugía General'
]

async function seed() {
  console.log('🌱 Seeding specialties...')
  
  const records = specialties.map(name => ({ name }))
  
  const { data, error } = await supabase
    .from('catalog_specialties')
    .upsert(records, { onConflict: 'name' })
    .select()

  if (error) {
    if (error.message.includes('schema cache')) {
      console.error('❌ Error: Table "catalog_specialties" does not exist in the database.')
      console.error('👉 Please run the SQL script in your Supabase SQL Editor first.')
    } else {
      console.error('❌ Error seeding:', error.message)
    }
    return
  }

  console.log(`✅ Successfully seeded ${data.length} specialties.`)
}

seed().catch(console.error)
