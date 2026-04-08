const db = require('./src/config/database');

async function check() {
  try {
    console.log('Checking school admins...');
    const result = await db.query("SELECT id, email, first_name, last_name, role, school_id FROM users WHERE role = 'school_admin' LIMIT 10");
    console.log('School admins:', result.rows);
    
    console.log('\nChecking schools...');
    const schools = await db.query('SELECT id, name, code FROM schools LIMIT 10');
    console.log('Schools:', schools.rows);
    
    console.log('\nChecking all users by role...');
    const roles = await db.query("SELECT role, COUNT(*) FROM users GROUP BY role");
    console.log('User counts by role:', roles.rows);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
