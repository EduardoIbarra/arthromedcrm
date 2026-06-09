const XLSX = require('xlsx');
const workbook = XLSX.readFile('/Users/ed/Downloads/ventas2025 (1).xlsx');
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
console.log('Headers:', Object.keys(rows[0]));
