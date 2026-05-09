const fs = require('fs');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We must use a Service Role Key or an Anon key if RLS allows inserts.
// The public policies for these tables are `USING (true) WITH CHECK (true)`,
// so the anon key is sufficient for inserting data from this script.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Anon Key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EXCEL_PATH = '/Users/ed/Downloads/MasterProductos.xlsx';

async function seed() {
  console.log(`Reading Excel file: ${EXCEL_PATH}`);
  const workbook = xlsx.readFile(EXCEL_PATH, { cellStyles: true });
  const sheetName = 'ELECTRODOS';
  
  if (!workbook.Sheets[sheetName]) {
    console.error(`Sheet '${sheetName}' not found in Excel file.`);
    process.exit(1);
  }

  const sheet = workbook.Sheets[sheetName];
  // We need both the structured data and cell-level access to check colors.
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`Found ${data.length} rows in the sheet.`);

  // 1. Determine columns for hospitals
  const rawHospitalNames = [' ANGELES ', ' MEDICA SUR ', ' TEC SALUD ', ' STAR MEDICA ', ' GRUPO ORGOA '];
  const hospitalNames = rawHospitalNames.map(n => n.trim());
  
  // Create hospitals
  const hospitalsMap = {};
  for (const cleanName of hospitalNames) {
    // Check if exists first
    let { data: hData, error: hErr } = await supabase
      .from('hospitals')
      .select()
      .eq('name', cleanName)
      .maybeSingle();
      
    if (!hData) {
      const res = await supabase
        .from('hospitals')
        .insert({ name: cleanName })
        .select()
        .single();
      hData = res.data;
      hErr = res.error;
    }
      
    if (hErr) {
      console.error(`Error inserting hospital ${cleanName}:`, hErr);
    } else {
      hospitalsMap[cleanName] = hData.id;
      console.log(`Hospital ${cleanName} seeded with ID: ${hData.id}`);
    }
  }

  // Find column letters for the hospitals by reading the first few rows
  const range = xlsx.utils.decode_range(sheet['!ref']);
  const hospitalCols = {};
  let headerRow = 0;
  
  for (let R = range.s.r; R <= Math.min(range.e.r, 10); ++R) {
    let found = false;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = { c: C, r: R };
      const cellRef = xlsx.utils.encode_cell(cellAddress);
      const cell = sheet[cellRef];
      if (cell && cell.v && typeof cell.v === 'string') {
        const cleanVal = cell.v.trim();
        if (hospitalNames.includes(cleanVal)) {
          hospitalCols[cleanVal] = xlsx.utils.encode_col(C);
          found = true;
        }
      }
    }
    if (found) {
      headerRow = R;
      break;
    }
  }

  console.log("Hospital Columns mapped:", hospitalCols);

  let insertedProducts = 0;
  let insertedPrices = 0;

  for (let i = 0; i < data.length; i++) {
    const rowData = data[i];
    // sheet_to_json output doesn't map directly to row index easily if there are empty rows before headers.
    // However, if headerRow was found, the first data row is usually headerRow + 1, so rowData i is at headerRow + 1 + i.
    // BUT we must convert from 0-indexed r to 1-indexed Excel rows.
    const rowNum = headerRow + 2 + i; 

    const productPayload = {
      description: rowData['DESCRIPCION'] || 'Unknown',
      model: rowData['MODELO'] || null,
      order_code: rowData['ORDEN'] || null,
      invoice_concept: rowData['CONCEPTO FACTURA'] || null,
      generic_description: rowData['DESCRIPCION GENERICA'] || null,
      new_alg_description: rowData['NUEVA DESCRIPCION ALG'] || null,
      measurements: rowData['MEDIDAS'] || null,
      alg_description: rowData['DESCRIPCION ALG'] || null,
      sale_price: parseFloat(rowData['VENTA']) || 0,
      base_hospital_price: parseFloat(rowData[' HOSPITALES ']) || 0,
      line: rowData['LINEA'] || null,
      type: rowData['TIPO'] || null,
    };

    const { data: pData, error: pErr } = await supabase
      .from('products')
      .insert(productPayload)
      .select()
      .single();

    if (pErr) {
      console.error(`Error inserting product row ${rowNum}:`, pErr);
      continue;
    }
    insertedProducts++;

    // Now insert hospital prices
    for (let hIdx = 0; hIdx < rawHospitalNames.length; hIdx++) {
      const rawName = rawHospitalNames[hIdx];
      const cleanName = hospitalNames[hIdx];
      const colLetter = hospitalCols[cleanName];
      if (!colLetter) continue;
      
      const priceVal = rowData[rawName] || rowData[cleanName];
      if (priceVal === undefined || priceVal === null) continue;

      const cellRef = `${colLetter}${rowNum}`;
      const cell = sheet[cellRef];
      
      // Determine if yellow (pending)
      let isPending = false;
      if (cell && cell.s && cell.s.fgColor) {
        if (cell.s.fgColor.rgb === 'FFFF00') {
          isPending = true;
        }
      }

      const pricePayload = {
        product_id: pData.id,
        hospital_id: hospitalsMap[cleanName],
        price: parseFloat(priceVal) || 0,
        pending: isPending
      };

      const { error: hpErr } = await supabase
        .from('hospital_prices')
        .insert(pricePayload);

      if (hpErr) {
        console.error(`Error inserting price for product ${pData.id} and hospital ${cleanName}:`, hpErr);
      } else {
        insertedPrices++;
      }
    }
  }

  console.log(`Seeding complete. Inserted ${insertedProducts} products and ${insertedPrices} hospital prices.`);
}

seed().catch(console.error);
