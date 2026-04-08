const db = require('./src/config/database');

async function verify() {
  try {
    // Check the admin user
    const result = await db.query(
      "SELECT id, email, is_super_admin FROM admins WHERE email = 'joeadams@gmail.com'"
    );
    console.log('Admin from DB:', result.rows[0]);
    
    // Also check all admins
    const all = await db.query(
      "SELECT id, email, is_super_admin FROM admins"
    );
    console.log('\nAll admins:', all.rows);
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

verify();
