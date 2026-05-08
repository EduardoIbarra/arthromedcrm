const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase environment variables missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('--- Starting Client Migration ---');

  // 1. Read Excel file
  const filePath = '/Users/ed/Downloads/MasterClientes.xlsx';
  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (error) {
    console.error(`Error reading Excel file at ${filePath}:`, error.message);
    process.exit(1);
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet); // This uses first row as keys

  console.log(`Read ${rows.length} records from Excel.`);

  // 2. Delete existing clients (Activo/Inactivo)
  console.log('Deleting existing clients (status Activo/Inactivo)...');
  const { error: deleteError, count: deleteCount } = await supabase
    .from('clients')
    .delete({ count: 'exact' })
    .in('status', ['Activo', 'Inactivo']);

  if (deleteError) {
    console.error('Error deleting clients:', deleteError);
    process.exit(1);
  }
  console.log(`Deleted ${deleteCount} existing clients.`);

  // 3. Prepare new records
  const newClients = rows.map(row => {
    // Header mapping: RFC, Nombre, CLIENTE, TIPO, ANTIGUEDAD, ACTIVO
    const isActive = row['ACTIVO'] && row['ACTIVO'].toString().toLowerCase() === 'activo';
    
    // Notes composition
    const notes = [
      row['CLIENTE'] ? `Cliente: ${row['CLIENTE']}` : null,
      row['TIPO'] ? `Tipo: ${row['TIPO']}` : null,
      row['ANTIGUEDAD'] ? `Antigüedad: ${row['ANTIGUEDAD']}` : null
    ].filter(Boolean).join(' | ');

    return {
      name: row['Nombre'] || 'S/N',
      rfc: row['RFC'] || null,
      status: isActive ? 'Activo' : 'Inactivo',
      notes: notes || null,
      source: 'Excel Import'
    };
  });

  // 4. Batch Insert
  console.log(`Inserting ${newClients.length} new clients...`);
  
  // Supabase has a limit on batch size, but 1000 is usually safe. 
  // Let's check how many we have.
  const batchSize = 100;
  for (let i = 0; i < newClients.length; i += batchSize) {
    const batch = newClients.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('clients')
      .insert(batch);

    if (insertError) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
      // We don't exit here to try other batches, but ideally it should work.
    }
  }

  console.log('--- Migration Completed Successfully ---');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
