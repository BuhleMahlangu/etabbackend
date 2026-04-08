const db = require('./src/config/database');

async function check() {
  try {
    // Get Sphiwe's user ID
    const teacher = await db.query(
      "SELECT id, email, school_id, school_code FROM users WHERE email = 'sphiwem@gmail.com'"
    );
    
    if (teacher.rows.length === 0) {
      console.log('Teacher not found');
      return;
    }
    
    const teacherId = teacher.rows[0].id;
    const schoolId = teacher.rows[0].school_id;
    console.log('Teacher ID:', teacherId);
    console.log('School ID:', schoolId);
    console.log('School Code:', teacher.rows[0].school_code);
    
    // Check teacher_assignments
    const assignments = await db.query(`
      SELECT ta.*, m.name as module_name, m.code as module_code
      FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      WHERE ta.teacher_id = $1
    `, [teacherId]);
    
    console.log('\nTeacher assignments:', assignments.rows.length);
    assignments.rows.forEach(a => {
      console.log(`  - ${a.module_name} (${a.module_code})`);
    });
    
    // Check if modules exist for KHS
    const modules = await db.query(`
      SELECT id, code, name, school_code 
      FROM modules 
      WHERE school_code = 'KHS' OR school_id = $1
      LIMIT 5
    `, [schoolId]);
    
    console.log('\nKHS Modules:', modules.rows.length);
    modules.rows.forEach(m => console.log(`  - ${m.code}: ${m.name}`));
    
    // Check subjects for KHS
    const subjects = await db.query(`
      SELECT id, code, name, school_code 
      FROM subjects 
      WHERE school_code = 'KHS'
      LIMIT 5
    `);
    
    console.log('\nKHS Subjects:', subjects.rows.length);
    subjects.rows.forEach(s => console.log(`  - ${s.code}: ${s.name}`));
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
