import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Canonical State Map
const STATE_MAP: Record<string, string> = {
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
  'CD DE MEXICO': 'CDMX',
  'COAHUILA': 'Coahuila',
  'COLIMA': 'Colima',
  'DURANGO': 'Durango',
  'ESTADO DE MEXICO': 'Estado de México',
  'ESTADO DE MÉXICO': 'Estado de México',
  'EDOMEX': 'Estado de México',
  'EDO MEX': 'Estado de México',
  'GUANAJUATO': 'Guanajuato',
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
  'SAN LUIS POTOSI': 'San Luis Potosí',
  'SAN LUIS POTOSÍ': 'San Luis Potosí',
  'SINALOA': 'Sinaloa',
  'SONORA': 'Sonora',
  'TABASCO': 'Tabasco',
  'TAMAULIPAS': 'Tamaulipas',
  'TLAXCALA': 'Tlaxcala',
  'VERACRUZ': 'Veracruz',
  'YUCATAN': 'Yucatán',
  'YUCATÁN': 'Yucatán',
  'ZACATECAS': 'Zacatecas',
  // Cities / Municipalities / Regions
  'MONTERREY': 'Nuevo León',
  'MTY': 'Nuevo León',
  'GUADALAJARA': 'Jalisco',
  'ZAPOPAN': 'Jalisco',
  'MORELIA': 'Michoacán',
  'MÉRIDA': 'Yucatán',
  'MERIDA': 'Yucatán',
  'TORREON': 'Coahuila',
  'TORREÓN': 'Coahuila',
  'PACHUCA': 'Hidalgo',
  'TOLUCA': 'Estado de México',
  'OBREGON': 'Sonora',
  'CIUDAD OBREGON': 'Sonora',
  'CD OBREGON': 'Sonora',
  'TIJUANA': 'Baja California',
  'CULIACAN': 'Sinaloa',
  'CULIACÁN': 'Sinaloa',
  'MONCLOVA': 'Coahuila',
  'HERMOSILLO': 'Sonora',
  'TAMPICO': 'Tamaulipas',
  'AMPICO': 'Tamaulipas',
  'PUERTO VALLARTA': 'Jalisco',
  'TODA LA REPUBLICA MEXICANA': 'CDMX',
  'TODA LA REPÚBLICA': 'CDMX',
};

function normalizeState(raw: string): string | null {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
  if (key in STATE_MAP) return STATE_MAP[key];
  
  // Try substring checks
  for (const k in STATE_MAP) {
    if (key.includes(k) || k.includes(key)) {
      return STATE_MAP[k];
    }
  }
  
  // Fallback: Title Case
  return String(raw).trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function normalizeStatesArray(arr: any[]): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr
    .flatMap(item => String(item || '').split(/[,;]|\s+y\s+|\s+Y\s+|\s+and\s+/i).map(s => s.trim()).filter(Boolean))
    .map(normalizeState)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i) as string[];
}

function findHeaderRow(data: any[][]): number {
  for (let idx = 0; idx < data.length; idx++) {
    const row = data[idx];
    if (!row || row.length === 0) continue;
    const normalized = row.map(cell => String(cell || '').trim().toLowerCase());
    if (normalized.some(c => c.includes('name') || c.includes('nombre') || c.includes('contact number') || c.includes('telefono'))) {
      return idx;
    }
  }
  return -1;
}

async function main() {
  const isCommit = process.argv.includes('--commit');
  console.log('--- CONGRESS PROSPECTS PRISMA IMPORT SCRIPT ---');
  console.log(`Mode: ${isCommit ? 'COMMIT (Writes to DB)' : 'DRY-RUN (No writes)'}`);

  // Dynamic import of Prisma client to ensure env is loaded first
  const prisma = (await import('../src/lib/prisma')).default;

  const files = [
    { path: '/Users/ed/Downloads/Prospectos CONGRESOS 2025.xlsx', defaultYear: 2025 },
    { path: '/Users/ed/Downloads/Prospectos de congresos 2026.xlsx', defaultYear: 2026 }
  ];

  // 1. Fetch existing congresses
  console.log('Fetching congresses from DB...');
  const dbCongresos = await prisma.congresos.findMany({
    select: { id: true, name: true, start_date: true }
  });
  console.log(`Loaded ${dbCongresos.length} congresses.`);
  const congressMap = new Map<string, typeof dbCongresos[0]>(
    dbCongresos.map((c: any) => [c.name.toLowerCase().trim(), c])
  );

  // 2. Fetch existing clients
  console.log('Fetching clients from DB...');
  const dbClients = await prisma.clients.findMany({
    select: { id: true, name: true, phone: true, email_primary: true, email_contact: true, tags: true, states: true, hospitals: true, notes: true }
  });
  console.log(`Loaded ${dbClients.length} clients.`);

  // Indexes for client lookups
  const clientByEmail = new Map<string, any>();
  const clientByPhone = new Map<string, any>();
  const clientByName = new Map<string, any>();

  dbClients.forEach((c: any) => {
    if (c.email_primary) clientByEmail.set(c.email_primary.toLowerCase().trim(), c);
    if (c.email_contact) clientByEmail.set(c.email_contact.toLowerCase().trim(), c);
    
    if (c.phone) {
      const cleanP = c.phone.replace(/\D/g, '');
      if (cleanP) clientByPhone.set(cleanP, c);
    }
    
    if (c.name) clientByName.set(c.name.toLowerCase().trim(), c);
  });

  // Trackers
  let totalRowsRead = 0;
  let newClientsCreated = 0;
  let clientsUpdated = 0;
  let skipCount = 0;

  // 3. Process each Excel file
  for (const fileInfo of files) {
    const { path: filePath, defaultYear } = fileInfo;
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}, skipping.`);
      continue;
    }

    console.log(`\nReading workbook: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 }) as any[][];
      
      const congressName = sheetName.trim();
      console.log(`\nProcessing tab "${congressName}"...`);
      
      const headerIdx = findHeaderRow(data);
      if (headerIdx === -1) {
        console.log(`  Could not find header row, skipping.`);
        continue;
      }
      
      // Determine headers and rows
      const headers = data[headerIdx].map(c => String(c || '').trim().toLowerCase());
      const rawRows = data.slice(headerIdx + 1);
      
      // Map column indexes
      let nameColIdx = headers.findIndex(h => h.includes('nombre') || h.includes('name'));
      if (nameColIdx === -1) {
        nameColIdx = headers.findIndex(h => h === 'columna 1');
      }
      const phoneColIdx = headers.findIndex(h => h.includes('contact number') || h.includes('telefono') || h.includes('phone'));
      const emailColIdx = headers.findIndex(h => h.includes('mail') || h.includes('correo') || h.includes('email'));
      const cityColIdx = headers.findIndex(h => h.includes('city') || h.includes('ciudad') || h.includes('municipio'));
      const stateColIdx = headers.findIndex(h => h.includes('state') || h.includes('estado'));
      const hospitalColIdx = headers.findIndex(h => h.includes('hospital'));
      const interestColIdx = headers.findIndex(h => h.includes('interest') || h.includes('interes') || h.includes('product') || h.includes('uso'));
      const notesColIdx = headers.findIndex(h => h.includes('nota') || h.includes('notaf') || h.includes('observaciones'));
      const agentColIdx = headers.findIndex(h => h.includes('atendido por') || h.includes('asesor') || h.includes('atendido'));

      console.log(`  Found column indexes:`);
      console.log(`    Name: ${nameColIdx}, Phone: ${phoneColIdx}, Email: ${emailColIdx}, State: ${stateColIdx}, City: ${cityColIdx}, Notes: ${notesColIdx}`);
      
      // Find or create congress
      let congressId = '';
      const congressKey = congressName.toLowerCase();
      
      if (congressMap.has(congressKey)) {
        congressId = congressMap.get(congressKey)!.id;
        console.log(`  Matched existing congress in DB: ID ${congressId}`);
      } else {
        console.log(`  Congress "${congressName}" not found in DB. Creating it...`);
        if (isCommit) {
          const start_date = new Date(`${defaultYear}-01-01`);
          const end_date = new Date(`${defaultYear}-01-02`);
          const location = 'Por definir';
          const description = `Creado automáticamente durante la importación de prospectos del archivo: ${path.basename(filePath)}`;
          
          const newCongreso = await prisma.congresos.create({
            data: {
              name: congressName,
              start_date,
              end_date,
              location,
              description,
              enable_workshops: true
            }
          });
          congressId = newCongreso.id;
          congressMap.set(congressKey, newCongreso);
          console.log(`  Successfully created congress: ID ${congressId}`);
        } else {
          congressId = 'DRY_RUN_CONGRESS_ID';
          console.log(`  (Dry Run) Will create congress: "${congressName}"`);
        }
      }

      // Process rows
      for (const row of rawRows) {
        if (!row || row.length === 0) continue;
        
        const name = nameColIdx !== -1 && row[nameColIdx] ? String(row[nameColIdx]).trim() : '';
        // Skip empty names
        if (!name || name === 'Columna 1' || name.toLowerCase() === 'nombre') continue;
        
        totalRowsRead++;
        
        let phone = '';
        if (phoneColIdx !== -1 && row[phoneColIdx] !== undefined && row[phoneColIdx] !== null) {
          phone = String(row[phoneColIdx]).trim();
        }
        
        let email = '';
        if (emailColIdx !== -1 && row[emailColIdx] !== undefined && row[emailColIdx] !== null) {
          email = String(row[emailColIdx]).trim().toLowerCase();
        }

        let rawStates: string[] = [];
        if (stateColIdx !== -1 && row[stateColIdx]) rawStates.push(String(row[stateColIdx]));
        if (cityColIdx !== -1 && row[cityColIdx]) rawStates.push(String(row[cityColIdx]));

        let hospitals: string[] = [];
        if (hospitalColIdx !== -1 && row[hospitalColIdx]) {
          hospitals = [String(row[hospitalColIdx]).trim()];
        }

        let noteParts = [];
        if (interestColIdx !== -1 && row[interestColIdx]) {
          noteParts.push(`Interés: ${row[interestColIdx]}`);
        }
        if (notesColIdx !== -1 && row[notesColIdx]) {
          noteParts.push(`Notas: ${row[notesColIdx]}`);
        }
        if (agentColIdx !== -1 && row[agentColIdx]) {
          noteParts.push(`Asesor/Atendido: ${row[agentColIdx]}`);
        }
        const notes = noteParts.length > 0 ? noteParts.join(' | ') : null;

        // Perform Matching
        let matchedClient: any = null;

        // Match by email
        if (email) {
          matchedClient = clientByEmail.get(email);
        }

        // Match by phone
        if (!matchedClient && phone) {
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone) {
            matchedClient = clientByPhone.get(cleanPhone);
          }
        }

        // Match by name
        if (!matchedClient && name) {
          matchedClient = clientByName.get(name.toLowerCase());
        }

        const tagToAdd = `congreso:${congressId}`;

        if (matchedClient) {
          // Existing Client update tags and enrich info
          const updatedTags = matchedClient.tags || [];
          const hasTag = updatedTags.includes(tagToAdd);
          
          let needsUpdate = !hasTag;
          const updates: any = {};
          
          if (!hasTag) {
            updates.tags = [...updatedTags, tagToAdd];
          }

          if (!matchedClient.phone && phone) {
            updates.phone = phone;
            needsUpdate = true;
          }

          if (!matchedClient.email_contact && email) {
            updates.email_contact = email;
            updates.email_primary = email;
            needsUpdate = true;
          }

          const currentStates = matchedClient.states || [];
          const newStates = normalizeStatesArray([...currentStates, ...rawStates]);
          if (JSON.stringify(newStates) !== JSON.stringify(currentStates)) {
            updates.states = newStates;
            needsUpdate = true;
          }

          const currentHospitals = matchedClient.hospitals || [];
          const newHospitals = Array.from(new Set([...currentHospitals, ...hospitals]));
          if (JSON.stringify(newHospitals) !== JSON.stringify(currentHospitals)) {
            updates.hospitals = newHospitals;
            needsUpdate = true;
          }

          if (notes) {
            updates.notes = matchedClient.notes ? `${matchedClient.notes} || ${notes}` : notes;
            needsUpdate = true;
          }

          if (needsUpdate) {
            clientsUpdated++;
            if (isCommit) {
              await prisma.clients.update({
                where: { id: matchedClient.id },
                data: updates
              });
              console.log(`    [UPDATE] Enriched existing client: "${name}"`);
            } else {
              console.log(`    (Dry Run) Will enrich client: "${name}" (ID: ${matchedClient.id}) with updates:`, updates);
            }
            // Update local memory
            Object.assign(matchedClient, updates);
          } else {
            skipCount++;
          }
        } else {
          // Create new client
          newClientsCreated++;
          
          const congressStartDate = (congressId && congressId !== 'DRY_RUN_CONGRESS_ID') 
            ? (congressMap.get(congressKey)?.start_date || new Date()) 
            : new Date();

          const newClientData: any = {
            name,
            phone: phone || null,
            email_contact: email || null,
            email_primary: email || null,
            states: normalizeStatesArray(rawStates),
            hospitals,
            notes: notes || null,
            tags: [tagToAdd],
            status: 'Nuevo Prospecto',
            source: 'Importación Congreso',
            created_at: congressStartDate,
            registered_at: congressStartDate
          };

          if (isCommit) {
            const createdClient = await prisma.clients.create({
              data: newClientData
            });
            console.log(`    [CREATE] Created new prospect: "${name}"`);
            // Add to indexes to prevent duplicate creation in this run
            clientByName.set(name.toLowerCase(), createdClient);
            if (email) clientByEmail.set(email, createdClient);
            if (phone) {
              const cleanP = phone.replace(/\D/g, '');
              if (cleanP) clientByPhone.set(cleanP, createdClient);
            }
          } else {
            console.log(`    (Dry Run) Will create new prospect: "${name}" with data:`, newClientData);
            // Simulate adding to local memory
            const mockClient = { id: 'MOCK_ID_' + newClientsCreated, ...newClientData };
            clientByName.set(name.toLowerCase(), mockClient);
            if (email) clientByEmail.set(email, mockClient);
            if (phone) {
              const cleanP = phone.replace(/\D/g, '');
              if (cleanP) clientByPhone.set(cleanP, mockClient);
            }
          }
        }
      }
    }
  }

  console.log('\n--- MIGRATION RUN REPORT ---');
  console.log(`Total prospect rows read:   ${totalRowsRead}`);
  console.log(`New clients created:         ${newClientsCreated}`);
  console.log(`Clients updated / enriched:  ${clientsUpdated}`);
  console.log(`Rows skipped (no changes):   ${skipCount}`);
  console.log('----------------------------');
  if (isCommit) {
    console.log('✅ Import completed successfully!');
  } else {
    console.log('ℹ️ Dry-run completed. Run with `--commit` to actually write to the database.');
  }
}

main()
  .catch(err => {
    console.error('Fatal error running migration:', err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      const prisma = (await import('../src/lib/prisma')).default;
      await prisma.$disconnect();
    } catch {}
  });
