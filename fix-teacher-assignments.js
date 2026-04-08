const db = require('./src/config/database');

async function fix() {
  try {
    // Get teacher ID
    const teacher = await db.query(
      "SELECT id FROM users WHERE email = 'sphiwem@gmail.com'"
    );
    const teacherId = teacher.rows[0].id;
    
    // Get pending registration with assignments
    const pending = await db.query(
      "SELECT * FROM pending_teachers WHERE email = 'sphiwem@gmail.com'"
    );
    
    if (pending.rows.length === 0) {
      console.log('No pending registration found');
      return;
    }
    
    const assignments = pending.rows[0].assignments;
    console.log('Teacher registered for:');
    
    // Delete current incorrect assignments
    await db.query('DELETE FROM teacher_assignments WHERE teacher_id = $1', [teacherId]);
    console.log('✅ Cleared incorrect assignments');
    
    // Create proper assignments based on what they registered for
    for (const assignment of assignments) {
      const gradeId = assignment.gradeId;
      const gradeName = assignment.gradeName;
      const isPrimary = assignment.isPrimary;
      
      console.log(`\n  Grade: ${gradeName}`);
      
      for (const subjectId of assignment.subjectIds) {
        // Get subject details
        const subject = await db.query(
          'SELECT code, name FROM subjects WHERE id = $1',
          [subjectId]
        );
        
        if (subject.rows.length > 0) {
          const subjCode = subject.rows[0].code;
          const subjName = subject.rows[0].name;
          console.log(`    - Subject: ${subjCode} (${subjName})`);
          
          // Find the corresponding module
          const module = await db.query(
            'SELECT id, code, name FROM modules WHERE code = $1',
            [subjCode]
          );
          
          if (module.rows.length > 0) {
            const modId = module.rows[0].id;
            
            // Create correct assignment
            await db.query(`
              INSERT INTO teacher_assignments 
                (teacher_id, subject_id, grade_id, is_active, is_primary, academic_year)
              VALUES ($1, $2, $3, true, $4, '2026')
            `, [teacherId, modId, gradeId, isPrimary]);
            
            console.log(`      ✅ Assigned to module: ${module.rows[0].code}`);
          } else {
            console.log(`      ❌ No module found for ${subjCode}`);
          }
        }
      }
    }
    
    // Verify final assignments
    const final = await db.query(`
      SELECT ta.*, m.code as module_code, m.name as module_name, g.name as grade_name
      FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      JOIN grades g ON ta.grade_id = g.id
      WHERE ta.teacher_id = $1
    `, [teacherId]);
    
    console.log('\n✅ Final assignments:', final.rows.length);
    final.rows.forEach(a => {
      console.log(`   - ${a.module_code}: ${a.module_name} (${a.grade_name})`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

fix();
