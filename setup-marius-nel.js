const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function setupMariusNel() {
  try {
    const email = 'mariusnel@krielhigh.co.za';
    const password = 'Admin123!';
    const firstName = 'Marius';
    const lastName = 'Nel';
    const schoolCode = 'KHS';
    
    // Get school ID for Kriel High
    const schoolResult = await db.query('SELECT id, name FROM schools WHERE code = $1', [schoolCode]);
    if (schoolResult.rows.length === 0) {
      console.error('School not found:', schoolCode);
      return;
    }
    const schoolId = schoolResult.rows[0].id;
    const schoolName = schoolResult.rows[0].name;
    console.log(`Found school: ${schoolName} (${schoolId})`);
    
    // Check if user already exists
    const existing = await db.query('SELECT id, role FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('User exists, updating to school_admin...');
      await db.query(
        "UPDATE users SET role = 'school_admin', school_id = $1, first_name = $2, last_name = $3 WHERE email = $4",
        [schoolId, firstName, lastName, email]
      );
      console.log('Updated existing user to school_admin for Kriel High');
    } else {
      // Create new school admin
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, is_active)
         VALUES ($1, $2, $3, $4, 'school_admin', $5, true) RETURNING *`,
        [email, hashedPassword, firstName, lastName, schoolId]
      );
      console.log('Created school admin:', result.rows[0].email);
    }
    
    console.log('\n=== Kriel High School Admin Credentials ===');
    console.log('Name: Marius Nel');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('School:', schoolName);
    console.log('School Code:', schoolCode);
    console.log('===========================================');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

setupMariusNel();
