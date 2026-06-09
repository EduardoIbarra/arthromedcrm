const XLSX = require('xlsx');

const files = [
  '/Users/ed/Downloads/Prospectos CONGRESOS 2025.xlsx',
  '/Users/ed/Downloads/Prospectos de congresos 2026.xlsx'
];

files.forEach(filePath => {
  console.log(`\n========================================`);
  console.log(`File: ${filePath}`);
  try {
    const workbook = XLSX.readFile(filePath);
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log(`\nTab: "${sheetName}"`);
      console.log(`  Total rows returned: ${data.length}`);
      
      // Print first 5 rows
      for (let i = 0; i < Math.min(10, data.length); i++) {
        console.log(`  Row ${i}:`, data[i]);
      }
    });
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
  }
});
