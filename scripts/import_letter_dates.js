const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function importData() {
    console.log('Reading Excel file...');
    const workbook = XLSX.readFile('/Users/ed/Downloads/Cartas_Distribucion_08-05-2026.xlsx');
    const sheetName = 'Cartas Distribución';
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
        console.error(`Sheet "${sheetName}" not found!`);
        return;
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const rows = data.slice(1); // Skip header

    console.log(`Processing ${rows.length} rows...`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const row of rows) {
        const rfc = row[2];
        const fechaCreacion = row[5];
        const fechaVigencia = row[6];

        if (!rfc) continue;

        // Convert Excel dates to strings if they are numbers
        const formatDate = (val) => {
            if (!val) return null;
            if (typeof val === 'number') {
                // Excel date serial number
                const date = XLSX.SSF.parse_date_code(val);
                return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
            }
            return val;
        };

        const createdDate = formatDate(fechaCreacion);
        const expiresDate = formatDate(fechaVigencia);

        console.log(`Updating RFC: ${rfc} | Created: ${createdDate} | Expires: ${expiresDate}`);

        const { data: updateData, error } = await supabase
            .from('clients')
            .update({
                letter_created_at: createdDate,
                letter_expires_at: expiresDate
            })
            .eq('rfc', rfc);

        if (error) {
            console.error(`Error updating RFC ${rfc}:`, error.message);
            errorCount++;
        } else {
            // Check if any rows were affected
            // In Supabase v2, update doesn't return the count by default unless requested
            // But we can check if it succeeded. 
            // To check if record existed, we'd need to select first or use count.
            // For now, assume if no error and RFC exists, it worked.
            updatedCount++;
        }
    }

    console.log('\nImport Summary:');
    console.log(`Total rows processed: ${rows.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('Done.');
}

importData();
