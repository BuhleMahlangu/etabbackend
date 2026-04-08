const db = require('./src/config/database');

async function check() {
  try {
    // Get latest school
    const school = await db.query(`
      SELECT * FROM schools 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (school.rows.length === 0) {
      console.log('No schools found');
      return;
    }
    
    const s = school.rows[0];
    console.log('Latest School:', s.name, `(${s.code})`);
    console.log('ID:', s.id);
    
    // Check admin for this school
    const admin = await db.query(`
      SELECT id, email, first_name, role, school_id, school_code
      FROM users 
      WHERE school_id = $1 AND role = 'school_admin'
    `, [s.id]);
    
    if (admin.rows.length > 0) {
      const a = admin.rows[0];
      console.log('\nAdmin:', a.first_name, `(${a.email})`);
      console.log('School ID:', a.school_id);
      console.log('School Code:', a.school_code || '❌ NULL');
    } else {
      console.log('\n❌ No admin found for this school');
    }
    
    // Check subjects for this school
    const subjects = await db.query(`
      SELECT COUNT(*) as count 
      FROM subjects 
      WHERE school_id = $1
    `, [s.id]);
    
    console.log('\nSubjects created:', subjects.rows[0].count);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
