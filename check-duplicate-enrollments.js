const db = require('./src/config/database');

async function check() {
  try {
    // Get a sample learner
    const learnerResult = await db.query(
      `SELECT id, email, school_id FROM users WHERE role = 'learner' LIMIT 1`
    );
    
    if (learnerResult.rows.length === 0) {
      console.log('No learners found');
      process.exit(0);
    }
    
    const learner = learnerResult.rows[0];
    console.log(`Checking enrollments for: ${learner.email}`);
    console.log('===========================================\n');
    
    // Get their enrollments with subject names
    const enrollments = await db.query(
      `SELECT 
        lm.id,
        m.code,
        m.name as module_name,
        s.name as subject_name,
        s.code as subject_code,
        lm.status,
        lm.enrolled_at
       FROM learner_modules lm
       JOIN modules m ON lm.module_id = m.id
       JOIN subjects s ON m.code = s.code AND m.school_id = s.school_id
       WHERE lm.learner_id = $1
       ORDER BY s.name`,
      [learner.id]
    );
    
    console.log(`Total enrollments: ${enrollments.rows.length}\n`);
    
    // Group by subject name to find duplicates
    const byName = {};
    enrollments.rows.forEach(e => {
      const key = e.subject_name;
      if (!byName[key]) byName[key] = [];
      byName[key].push(e);
    });
    
    console.log('Subjects:');
    Object.entries(byName).forEach(([name, items]) => {
      if (items.length > 1) {
        console.log(`\n  ⚠️  DUPLICATE: "${name}" (${items.length} times)`);
        items.forEach(i => {
          console.log(`     - Module: ${i.module_name} (${i.code})`);
        });
      } else {
        console.log(`  ✅ ${name}`);
      }
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
