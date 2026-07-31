const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const PROD_URL = 'https://lmiymbdnqkvppaalgayr.supabase.co';
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD;

const DEV_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zdvkatyzqgbeewtbuyfu.supabase.co';
const DEV_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROD_KEY || !DEV_KEY) {
  console.error('Error: Service role keys missing in .env.local');
  process.exit(1);
}

const prodClient = createClient(PROD_URL, PROD_KEY);
const devClient = createClient(DEV_URL, DEV_KEY);

const WORKSHOP_ID = 'b5f17396-7636-47c2-bde3-34c3ddffa0fd';

async function seedTaller() {
  console.log(`\n========== SEEDING TALLER ${WORKSHOP_ID} FROM PROD TO DEV ==========\n`);

  // 1. Fetch Workshop from Prod
  const { data: workshop, error: workshopError } = await prodClient
    .from('congress_workshops')
    .select('*')
    .eq('id', WORKSHOP_ID)
    .single();

  if (workshopError || !workshop) {
    console.error('Error fetching workshop from PROD:', workshopError);
    process.exit(1);
  }

  console.log(`Found Workshop in PROD: "${workshop.name}" (Date: ${workshop.date_time})`);

  // 2. Sync referenced Congress if applicable
  if (workshop.congress_id) {
    const { data: prodCongress } = await prodClient
      .from('congresos')
      .select('*')
      .eq('id', workshop.congress_id)
      .single();

    if (prodCongress) {
      console.log(`Upserting congress "${prodCongress.name}" into DEV...`);
      await devClient.from('congresos').upsert(prodCongress);
    }
  }

  // 3. Upsert Workshop into DEV
  console.log(`Upserting workshop "${workshop.name}" into DEV...`);
  const { error: workshopUpsertErr } = await devClient
    .from('congress_workshops')
    .upsert(workshop);

  if (workshopUpsertErr) {
    console.error('Error upserting workshop to DEV:', workshopUpsertErr);
    process.exit(1);
  }
  console.log('✅ Workshop row successfully upserted into DEV!');

  // 4. Sync Doctors referenced by this workshop
  const { data: doctorLinks } = await prodClient
    .from('congress_workshop_doctors')
    .select('doctor_id')
    .eq('workshop_id', WORKSHOP_ID);

  if (doctorLinks && doctorLinks.length > 0) {
    const doctorIds = doctorLinks.map(d => d.doctor_id).filter(Boolean);
    console.log(`Syncing ${doctorIds.length} referenced doctors from PROD to DEV...`);
    const { data: prodDoctors } = await prodClient
      .from('doctores')
      .select('*')
      .in('id', doctorIds);

    if (prodDoctors && prodDoctors.length > 0) {
      const { error: docErr } = await devClient.from('doctores').upsert(prodDoctors);
      if (docErr) console.warn('Warning syncing doctores to DEV:', docErr.message);
      else console.log(`  ✅ Synced ${prodDoctors.length} doctores to DEV.`);
    }
  }

  // 5. Sync Clients/Enrollments referenced by this workshop
  const { data: enrollmentLinks } = await prodClient
    .from('congress_workshop_enrollments')
    .select('client_id')
    .eq('workshop_id', WORKSHOP_ID);

  if (enrollmentLinks && enrollmentLinks.length > 0) {
    const clientIds = enrollmentLinks.map(e => e.client_id).filter(Boolean);
    console.log(`Syncing ${clientIds.length} referenced clients from PROD to DEV...`);
    
    // Try syncing from master_clientes or clientes
    const { data: prodClients } = await prodClient
      .from('master_clientes')
      .select('*')
      .in('id', clientIds);

    if (prodClients && prodClients.length > 0) {
      const { error: cliErr } = await devClient.from('master_clientes').upsert(prodClients);
      if (cliErr) console.warn('Warning syncing master_clientes to DEV:', cliErr.message);
      else console.log(`  ✅ Synced ${prodClients.length} master_clientes to DEV.`);
    }
  }

  // 6. Seed All Related Child Tables
  const childTables = [
    { name: 'congress_workshop_doctors', foreignKey: 'workshop_id' },
    { name: 'congress_workshop_enrollments', foreignKey: 'workshop_id' },
    { name: 'congress_workshop_members', foreignKey: 'workshop_id' },
    { name: 'workshop_hotel_rooms', foreignKey: 'workshop_id' },
    { name: 'workshop_itinerarios', foreignKey: 'workshop_id' },
    { name: 'workshop_stations', foreignKey: 'workshop_id' },
    { name: 'workshop_temp_staff', foreignKey: 'workshop_id' },
    { name: 'workshop_gastos_estimados', foreignKey: 'workshop_id' }
  ];

  for (const { name: tableName, foreignKey } of childTables) {
    const { data: childRows, error: fetchErr } = await prodClient
      .from(tableName)
      .select('*')
      .eq(foreignKey, WORKSHOP_ID);

    if (fetchErr || !childRows || childRows.length === 0) continue;

    const { error: upsertErr } = await devClient
      .from(tableName)
      .upsert(childRows);

    if (upsertErr) {
      console.warn(`Warning upserting "${tableName}" to DEV:`, upsertErr.message);
    } else {
      console.log(`  ✅ Synced ${childRows.length} rows to "${tableName}" in DEV.`);
    }
  }

  console.log(`\n===========================================================`);
  console.log(`SUCCESS: Taller ${WORKSHOP_ID} fully seeded into DEV!`);
  console.log(`===========================================================\n`);
}

seedTaller().catch((err) => {
  console.error('Unhandled error in seed script:', err);
  process.exit(1);
});
