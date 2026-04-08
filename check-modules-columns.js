const db = require('./src/config/database');

async function check() {
  const result = await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'modules' ORDER BY ordinal_position
  `);
  console.log('modules columns:', result.rows.map(r => r.column_name));
  process.exit(0);
}

check();
