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

async function pushTallerDevToProd() {
  console.log(`\n=======================================================`);
  console.log(`PUSHING TALLER ${WORKSHOP_ID} FROM DEV TO PROD`);
  console.log(`=======================================================\n`);

  // 1. Fetch Workshop from DEV
  const { data: workshop, error: workshopError } = await devClient
    .from('congress_workshops')
    .select('*')
    .eq('id', WORKSHOP_ID)
    .single();

  if (workshopError || !workshop) {
    console.error('Error fetching workshop from DEV:', workshopError);
    process.exit(1);
  }

  console.log(`[DEV Record] Name: "${workshop.name}"`);
  console.log(`[DEV Record] Professor: "${workshop.professor}"`);
  console.log(`[DEV Record] Has diploma_template: ${Boolean(workshop.diploma_template)}`);

  // 2. Ensure parent congress exists in PROD if congress_id is set
  if (workshop.congress_id) {
    const { data: devCongress } = await devClient
      .from('congresos')
      .select('*')
      .eq('id', workshop.congress_id)
      .single();

    if (devCongress) {
      console.log(`\n1. Upserting Parent Congress "${devCongress.name}" into PROD...`);
      const { error: congressErr } = await prodClient.from('congresos').upsert(devCongress);
      if (congressErr) console.warn('Warning upserting congress to PROD:', congressErr);
      else console.log('  ✅ Congress upserted into PROD.');
    }
  }

  // 3. Upsert Workshop into PROD
  console.log(`\n2. Upserting Workshop record into PROD...`);
  const { error: workshopUpsertErr } = await prodClient
    .from('congress_workshops')
    .upsert(workshop);

  if (workshopUpsertErr) {
    console.error('❌ Error updating workshop in PROD:', workshopUpsertErr);
    process.exit(1);
  }
  console.log('  ✅ Workshop record successfully updated in PROD database!');

  // 4. Sync Doctors / Instructors
  console.log(`\n3. Syncing Workshop Doctors / Instructors...`);
  const { data: devDoctors } = await devClient
    .from('congress_workshop_doctors')
    .select('*')
    .eq('workshop_id', WORKSHOP_ID);

  if (devDoctors && devDoctors.length > 0) {
    // Ensure doctors exist in PROD
    for (const docRel of devDoctors) {
      if (docRel.doctor_id) {
        const { data: devDoc } = await devClient.from('doctors').select('*').eq('id', docRel.doctor_id).single();
        if (devDoc) {
          console.log(`  Syncing doctor "${devDoc.name}" to PROD...`);
          await prodClient.from('doctors').upsert(devDoc);
        }
      }
    }
    const { error: docsErr } = await prodClient.from('congress_workshop_doctors').upsert(devDoctors);
    if (docsErr) console.warn('Warning upserting doctors to PROD:', docsErr);
    else console.log(`  ✅ ${devDoctors.length} Doctors synced to PROD.`);
  }

  // 5. Sync Itinerary
  const { data: devItinerary } = await devClient
    .from('congress_workshop_itinerary')
    .select('*')
    .eq('workshop_id', WORKSHOP_ID);

  if (devItinerary && devItinerary.length > 0) {
    console.log(`\n4. Syncing Itinerary (${devItinerary.length} items)...`);
    await prodClient.from('congress_workshop_itinerary').upsert(devItinerary);
    console.log('  ✅ Itinerary synced to PROD.');
  }

  // 6. Sync Stations
  const { data: devStations } = await devClient
    .from('congress_workshop_stations')
    .select('*')
    .eq('workshop_id', WORKSHOP_ID);

  if (devStations && devStations.length > 0) {
    console.log(`\n5. Syncing Work Stations (${devStations.length} stations)...`);
    await prodClient.from('congress_workshop_stations').upsert(devStations);
    console.log('  ✅ Stations synced to PROD.');
  }

  // 7. Sync Staff
  const { data: devStaff } = await devClient
    .from('congress_workshop_staff')
    .select('*')
    .eq('workshop_id', WORKSHOP_ID);

  if (devStaff && devStaff.length > 0) {
    console.log(`\n6. Syncing Staff (${devStaff.length} members)...`);
    await prodClient.from('congress_workshop_staff').upsert(devStaff);
    console.log('  ✅ Staff synced to PROD.');
  }

  console.log(`\n=======================================================`);
  console.log(`SUCCESSFULLY PUSHED WORKSHOP ${WORKSHOP_ID} TO PROD!`);
  console.log(`=======================================================\n`);
}

pushTallerDevToProd().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
