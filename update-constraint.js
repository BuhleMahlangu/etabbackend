const db = require('./src/config/database');

async function update() {
  try {
    await db.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role');
    await db.query("ALTER TABLE users ADD CONSTRAINT check_role CHECK (role IN ('learner', 'teacher', 'admin', 'school_admin'))");
    console.log('Constraint updated successfully');
    
    const result = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as def 
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass AND contype = 'c' AND conname = 'check_role'
    `);
    console.log('New constraint:', result.rows[0].def);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

update();
