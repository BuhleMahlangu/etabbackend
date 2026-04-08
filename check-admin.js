const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query("SELECT id, email, is_super_admin FROM admins WHERE email = 'joeadams@gmail.com'");
    console.log('Admin:', result.rows[0]);
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
