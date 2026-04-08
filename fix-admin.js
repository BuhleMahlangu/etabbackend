const db = require('./src/config/database');

async function fix() {
  try {
    // Set joeadams as super admin
    await db.query(
      "UPDATE admins SET is_super_admin = true WHERE email = 'joeadams@gmail.com'"
    );
    console.log('✅ Updated joeadams@gmail.com to super admin');
    
    // Verify
    const result = await db.query(
      "SELECT id, email, is_super_admin FROM admins WHERE email = 'joeadams@gmail.com'"
    );
    console.log('Admin:', result.rows[0]);
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

fix();
