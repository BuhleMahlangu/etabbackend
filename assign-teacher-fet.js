const db = require('./src/config/database');

async function assign() {
  try {
    // Get teacher ID
    const teacher = await db.query(
      "SELECT id FROM users WHERE email = 'sphiwem@gmail.com'"
    );
    const teacherId = teacher.rows[0].id;
    
    // Get Grade 10 ID
    const grade = await db.query(
      "SELECT id FROM grades WHERE name = 'Grade 10'"
    );
    const gradeId = grade.rows[0].id;
    
    console.log('Assigning teacher to FET Grade 10 subjects...\n');
    
    // Get all KHS FET modules (Grade 10-12)
    const fetModules = await db.query(`
      SELECT id, code, name 
      FROM modules 
      WHERE school_code = 'KHS' 
        AND code LIKE '%-FET'
      ORDER BY code
    `);
    
    console.log('Available FET modules:', fetModules.rows.length);
    
    // Assign teacher to first 3 FET subjects (typical teacher load)
    const subjectsToAssign = fetModules.rows.slice(0, 3);
    
    for (const mod of subjectsToAssign) {
      await db.query(`
        INSERT INTO teacher_assignments 
          (teacher_id, subject_id, grade_id, is_active, is_primary, academic_year)
        VALUES ($1, $2, $3, true, true, '2026')
        ON CONFLICT DO NOTHING
      `, [teacherId, mod.id, gradeId]);
      
      console.log(`✅ Assigned: ${mod.code} - ${mod.name}`);
    }
    
    // Verify
    const assigned = await db.query(`
      SELECT m.code, m.name, g.name as grade
      FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      JOIN grades g ON ta.grade_id = g.id
      WHERE ta.teacher_id = $1
    `, [teacherId]);
    
    console.log('\n✅ Teacher now has', assigned.rows.length, 'assignments:');
    assigned.rows.forEach(a => {
      console.log(`   - ${a.code}: ${a.name} (${a.grade})`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

assign();
