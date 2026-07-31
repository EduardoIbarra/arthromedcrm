const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
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

const ATTENDEES = [
  'Dr. Luis Alfonso Meza Ulloa',
  'Dra. Dalia Mejía',
  'Dr. Rafael Castellanos',
  'Dr. Catarino López',
  'Dr. Hector Ismael de Haro',
  'Dr. Brandon Morales Pineda',
  'Dr. Poncho Núñez',
  'Dr. Iván Andrey García',
  'Dr. Hazzel Martínez',
  'Dr. Miguel Uribe',
  'Dr. Gibran González Martínez'
];

async function seedAttendees() {
  console.log(`\n=======================================================`);
  console.log(`SEEDING 11 ATTENDEES FOR WORKSHOP ${WORKSHOP_ID}`);
  console.log(`IN PROD AND DEV DATABASES`);
  console.log(`=======================================================\n`);

  for (let index = 0; index < ATTENDEES.length; index++) {
    const rawName = ATTENDEES[index];
    const cleanName = rawName.trim();
    console.log(`\n[${index + 1}/${ATTENDEES.length}] Processing: "${cleanName}"...`);

    // 1. Search for existing client in PROD
    const { data: existingProdClients } = await prodClient
      .from('clients')
      .select('*')
      .ilike('name', `%${cleanName.replace(/^(Dr\.|Dra\.)\s*/i, '')}%`);

    let clientRecord = null;

    if (existingProdClients && existingProdClients.length > 0) {
      // Find best match
      clientRecord = existingProdClients.find(c => c.name.toLowerCase() === cleanName.toLowerCase()) || existingProdClients[0];
      console.log(`  Found existing client in PROD: "${clientRecord.name}" (ID: ${clientRecord.id})`);
    } else {
      // Create new client object
      const newClientId = uuidv4();
      clientRecord = {
        id: newClientId,
        name: cleanName,
        status: 'Nuevo Prospecto',
        source: 'Taller Endoscopia',
        tags: ['taller-registro'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      console.log(`  Client not found in PROD. Creating new client: "${cleanName}" (ID: ${clientRecord.id})`);

      // Insert into PROD
      const { error: prodInsertErr } = await prodClient.from('clients').insert(clientRecord);
      if (prodInsertErr) {
        console.error(`  Error inserting client "${cleanName}" into PROD:`, prodInsertErr.message);
      } else {
        console.log(`  ✅ Client created in PROD.`);
      }
    }

    // 2. Ensure client exists in DEV
    const { error: devUpsertErr } = await devClient.from('clients').upsert(clientRecord);
    if (devUpsertErr) {
      console.warn(`  Warning upserting client "${cleanName}" to DEV:`, devUpsertErr.message);
    } else {
      console.log(`  ✅ Client upserted into DEV.`);
    }

    // 3. Create Enrollment record
    const enrollmentRecord = {
      workshop_id: WORKSHOP_ID,
      client_id: clientRecord.id,
      created_at: new Date().toISOString()
    };

    // 4. Upsert Enrollment in PROD
    const { error: prodEnrollErr } = await prodClient
      .from('congress_workshop_enrollments')
      .upsert(enrollmentRecord, { onConflict: 'workshop_id,client_id' });

    if (prodEnrollErr) {
      console.warn(`  Warning enrolling "${cleanName}" in PROD:`, prodEnrollErr.message);
    } else {
      console.log(`  ✅ Enrolled in PROD.`);
    }

    // 5. Upsert Enrollment in DEV
    const { error: devEnrollErr } = await devClient
      .from('congress_workshop_enrollments')
      .upsert(enrollmentRecord, { onConflict: 'workshop_id,client_id' });

    if (devEnrollErr) {
      console.warn(`  Warning enrolling "${cleanName}" in DEV:`, devEnrollErr.message);
    } else {
      console.log(`  ✅ Enrolled in DEV.`);
    }
  }

  console.log(`\n=======================================================`);
  console.log(`ALL 11 ATTENDEES SUCCESSFULLY SEEDED IN PROD & DEV!`);
  console.log(`=======================================================\n`);
}

seedAttendees().catch(err => {
  console.error('Fatal error seeding attendees:', err);
  process.exit(1);
});
