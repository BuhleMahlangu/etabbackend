const db = require('./src/config/database');

async function check() {
  try {
    // Get teacher's original registration info
    const teacher = await db.query(
      "SELECT id, first_name, email, teacher_subjects FROM users WHERE email = 'sphiwem@gmail.com'"
    );
    
    if (teacher.rows.length === 0) {
      console.log('Teacher not found');
      return;
    }
    
    const t = teacher.rows[0];
    console.log('Teacher:', t.first_name, `(${t.email})`);
    console.log('Registered subjects:', t.teacher_subjects);
    
    // Check if there was a pending registration
    const pending = await db.query(
      "SELECT * FROM pending_teachers WHERE email = 'sphiwem@gmail.com'"
    );
    
    if (pending.rows.length > 0) {
      console.log('\nPending registration found:');
      console.log('  Assignments:', JSON.stringify(pending.rows[0].assignments, null, 2));
    }
    
    // Current assignments
    const assignments = await db.query(`
      SELECT ta.*, m.code as module_code, m.name as module_name
      FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      WHERE ta.teacher_id = $1
    `, [t.id]);
    
    console.log('\nCurrent assignments:', assignments.rows.length);
    assignments.rows.forEach(a => {
      console.log(`  - ${a.module_code}: ${a.module_name}`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
