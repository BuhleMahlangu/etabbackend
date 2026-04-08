const db = require('./src/config/database');

async function check() {
  const result = await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'grade_modules' ORDER BY ordinal_position
  `);
  console.log('grade_modules columns:', result.rows.map(r => r.column_name));
  
  // Check primary key
  const pk = await db.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'grade_modules' AND tc.constraint_type = 'PRIMARY KEY'
  `);
  console.log('Primary key:', pk.rows.map(r => r.column_name));
  
  process.exit(0);
}

check();
