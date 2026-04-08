const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    console.log('Users table columns:');
    result.rows.forEach(r => {
      console.log(` - ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? '(required)' : ''}`);
    });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
