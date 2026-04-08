const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function createPendingTeacher() {
  try {
    const email = 'pendingteacher@demo.com';
    const schoolCode = 'DEMO';
    
    // Get school ID
    const schoolResult = await db.query('SELECT id FROM schools WHERE code = $1', [schoolCode]);
    if (schoolResult.rows.length === 0) {
      console.error('School not found:', schoolCode);
      return;
    }
    const schoolId = schoolResult.rows[0].id;
    
    // Check if already exists
    const existing = await db.query('SELECT id FROM pending_teachers WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('Pending teacher already exists');
      return;
    }
    
    // Create pending teacher
    const hashedPassword = await bcrypt.hash('Teacher123!', 10);
    const result = await db.query(
      `INSERT INTO pending_teachers (
        email, password_hash, first_name, last_name, 
        employee_number, qualification, specialization, years_experience, bio,
        school_id, status, requested_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW()) RETURNING *`,
      [
        email, 
        hashedPassword, 
        'Pending', 
        'Teacher',
        'EMP001',
        'Bachelor of Education',
        'Mathematics',
        5,
        'Experienced math teacher',
        schoolId
      ]
    );
    console.log('Created pending teacher:', result.rows[0].email);
    console.log('School ID:', result.rows[0].school_id);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

createPendingTeacher();
