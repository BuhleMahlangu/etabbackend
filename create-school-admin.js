const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function createSchoolAdmin() {
  try {
    const email = 'schooladmin@demo.com';
    const password = 'SchoolAdmin123!';
    const firstName = 'School';
    const lastName = 'Admin';
    const schoolCode = 'DEMO';
    
    // Get school ID
    const schoolResult = await db.query('SELECT id FROM schools WHERE code = $1', [schoolCode]);
    if (schoolResult.rows.length === 0) {
      console.error('School not found:', schoolCode);
      return;
    }
    const schoolId = schoolResult.rows[0].id;
    
    // Check if user already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('User already exists, updating role to school_admin...');
      await db.query("UPDATE users SET role = 'school_admin', school_id = $1 WHERE email = $2", [schoolId, email]);
      console.log('Updated existing user to school_admin');
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
    
    console.log('\nTest credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('School Code:', schoolCode);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

createSchoolAdmin();
