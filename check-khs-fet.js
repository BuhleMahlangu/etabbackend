const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(`
      SELECT m.code, m.name, gm.is_compulsory
      FROM modules m
      JOIN grade_modules gm ON m.id = gm.module_id
      WHERE m.school_id = 'e0ba1d69-519a-4ea7-9a85-36eb3e0c2622'
      AND gm.grade_id = (SELECT id FROM grades WHERE level = 10)
      ORDER BY gm.is_compulsory DESC, m.name
    `);
    
    console.log('KHS Grade 10 modules:');
    result.rows.forEach(r => {
      console.log(`  ${r.is_compulsory ? '✅' : '⭕'} ${r.code}: ${r.name}`);
    });
    console.log(`Total: ${result.rows.length}`);
    console.log(`Compulsory: ${result.rows.filter(r => r.is_compulsory).length}`);
    console.log(`Optional: ${result.rows.filter(r => !r.is_compulsory).length}`);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
