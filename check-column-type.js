const db = require('./src/config/database');

async function check() {
  const result = await db.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'subjects' AND column_name = 'applicable_grades'
  `);
  console.log(result.rows[0]);
  
  // Check a sample
  const sample = await db.query(`SELECT applicable_grades FROM subjects WHERE phase = 'FET' LIMIT 1`);
  console.log('\nSample applicable_grades:', sample.rows[0]?.applicable_grades);
  console.log('Type:', typeof sample.rows[0]?.applicable_grades);
  
  process.exit(0);
}

check();
