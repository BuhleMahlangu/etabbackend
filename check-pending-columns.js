const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'pending_teachers'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in pending_teachers table:');
    result.rows.forEach(r => {
      console.log(`  - ${r.column_name}: ${r.data_type}`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
