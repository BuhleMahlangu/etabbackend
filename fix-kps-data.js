const db = require('./src/config/database');

async function fix() {
  try {
    // Fix admin school_code
    await db.query("UPDATE users SET school_code = 'KPS' WHERE email = 'thembi@gmail.com'");
    console.log('✅ Fixed admin school_code');
    
    // Get KPS school ID
    const school = await db.query("SELECT id FROM schools WHERE code = 'KPS'");
    const schoolId = school.rows[0].id;
    
    // Get all KPS subjects
    const subjects = await db.query("SELECT * FROM subjects WHERE school_code = 'KPS'");
    console.log('Found', subjects.rows.length, 'KPS subjects');
    
    // Create modules for each subject
    for (const subj of subjects.rows) {
      await db.query(`
        INSERT INTO modules (code, name, description, department, credits, school_id, school_code, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        ON CONFLICT (code) DO NOTHING
      `, [subj.code, subj.name, subj.name + ' - ' + subj.phase, subj.department, 10, schoolId, 'KPS']);
    }
    
    const modules = await db.query("SELECT COUNT(*) as count FROM modules WHERE school_code = 'KPS'");
    console.log('✅ Created', modules.rows[0].count, 'KPS modules');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

fix();
