const db = require('./src/config/database');

async function verify() {
  try {
    // Get teacher info
    const teacher = await db.query(
      "SELECT id, email, first_name, school_id, school_code FROM users WHERE email = 'sphiwem@gmail.com'"
    );
    
    if (teacher.rows.length === 0) {
      console.log('❌ Teacher not found');
      return;
    }
    
    const t = teacher.rows[0];
    console.log('✅ Teacher:', t.first_name, `(${t.email})`);
    console.log('   School:', t.school_code);
    
    // Check assignments
    const assignments = await db.query(`
      SELECT ta.*, m.name as module_name, m.code as module_code, g.name as grade_name
      FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      JOIN grades g ON ta.grade_id = g.id
      WHERE ta.teacher_id = $1 AND ta.is_active = true
    `, [t.id]);
    
    console.log('\n✅ Teacher Assignments:', assignments.rows.length);
    assignments.rows.forEach(a => {
      console.log(`   - ${a.module_code}: ${a.module_name} (${a.grade_name})`);
    });
    
    // Check KHS modules
    const modules = await db.query(
      "SELECT COUNT(*) as count FROM modules WHERE school_code = 'KHS'"
    );
    console.log('\n✅ KHS Modules:', modules.rows[0].count);
    
    // Check KHS subjects  
    const subjects = await db.query(
      "SELECT COUNT(*) as count FROM subjects WHERE school_code = 'KHS'"
    );
    console.log('✅ KHS Subjects:', subjects.rows[0].count);
    
    console.log('\n📝 Summary:');
    console.log('   The teacher now has', assignments.rows.length, 'subject assignments');
    console.log('   Subjects should now appear on the teacher dashboard');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

verify();
