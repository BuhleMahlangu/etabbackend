const db = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function fixPassword() {
  const email = 'tyleraustin@gmail.com';
  const newPassword = 'password123';
  
  // Hash password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  // Update
  await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);
  
  console.log('✅ Password updated for', email);
  console.log('   New password:', newPassword);
  
  // Verify
  const userRes = await db.query('SELECT id, email FROM users WHERE email = $1', [email]);
  console.log('   User ID:', userRes.rows[0].id);
  
  process.exit(0);
}

fixPassword();
