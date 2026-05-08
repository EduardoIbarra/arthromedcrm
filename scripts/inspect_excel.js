const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('/Users/ed/Downloads/Cartas_Distribucion_08-05-2026.xlsx');
    console.log('Sheet Names:', workbook.SheetNames);
    
    workbook.SheetNames.forEach(name => {
        const worksheet = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log(`Sheet: ${name}`);
        console.log('Headers:', data[0]);
        console.log('Sample data (row 1):', data[1]);
        console.log('Total rows:', data.length);
    });
} catch (error) {
    console.error('Error reading file:', error);
}

