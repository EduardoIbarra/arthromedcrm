import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const initialLines = [
  { name: 'SPORTS MEDICINE', description: 'artroscopía y ortopedia', color: '#F8CBAD' },
  { name: 'ENT', description: 'otorrinolaringología, cabeza y cuello', color: '#BDD7EE' },
  { name: 'SPINE', description: 'columna y neurocirugía', color: '#C6E0B4' },
  { name: 'UBE', description: 'cirugía endoscópica biportal unilateral', color: '#33CCCC' },
  { name: 'URO & GYN', description: 'urología y ginecología', color: '#FFE699' },
  { name: 'Systems', description: 'sistemas', color: '#38bdf8' },
  { name: 'VISION', description: 'visión', color: '#E2D5F8' }
];

async function main() {
  const prisma = (await import('../src/lib/prisma')).default;
  console.log('🌱 Clearing existing product lines...');
  await prisma.catalog_lines.deleteMany();
  
  console.log('🌱 Seeding product lines with official colors...');
  for (const line of initialLines) {
    const record = await prisma.catalog_lines.create({
      data: {
        name: line.name,
        description: line.description,
        color: line.color
      }
    });
    console.log(`✅ Seeded line: ${record.name} (${record.color})`);
  }

  console.log('🎉 Seeding completed!');
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
