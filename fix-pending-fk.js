const db = require('./src/config/database');

async function fix() {
  try {
    // Drop the existing FK constraint
    await db.query(`
      ALTER TABLE pending_teachers 
      DROP CONSTRAINT IF EXISTS pending_teachers_reviewed_by_fkey
    `);
    console.log('Dropped existing FK constraint');
    
    // Add new FK constraint that references users(id) - since both super admins and school admins are there
    // Actually super admins are in admins table, school admins in users table
    // Let's just drop the constraint entirely to allow both
    console.log('FK constraint removed - can now reference either table');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

fix();
