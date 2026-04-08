const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as def 
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass AND contype = 'c'
    `);
    console.log('Constraints on users table:');
    result.rows.forEach(r => {
      console.log(' -', r.conname, ':', r.def);
    });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
