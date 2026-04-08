const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'pending_teachers' AND tc.constraint_type = 'FOREIGN KEY'
    `);
    console.log('Foreign keys on pending_teachers:');
    result.rows.forEach(r => {
      console.log(` - ${r.constraint_name}: ${r.column_name} -> ${r.foreign_table}.${r.foreign_column}`);
    });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
