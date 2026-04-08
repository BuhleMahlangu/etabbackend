const db = require('./src/config/database');

async function check() {
  try {
    // Get all learners with their enrollment counts
    const learners = await db.query(
      `SELECT u.id, u.email, u.school_id, COUNT(lm.id) as enrollment_count
       FROM users u
       LEFT JOIN learner_modules lm ON u.id = lm.learner_id
       WHERE u.role = 'learner'
       GROUP BY u.id
       ORDER BY enrollment_count DESC
       LIMIT 5`
    );
    
    for (const learner of learners.rows) {
      console.log(`\n${learner.email} (${learner.enrollment_count} enrollments):`);
      console.log('='.repeat(60));
      
      // Get their enrollments
      const enrollments = await db.query(
        `SELECT 
          m.code,
          m.name as module_name,
          s.name as subject_name,
          s.phase
         FROM learner_modules lm
         JOIN modules m ON lm.module_id = m.id
         JOIN subjects s ON m.code = s.code AND m.school_id = s.school_id
         WHERE lm.learner_id = $1
         ORDER BY s.phase, s.name`,
        [learner.id]
      );
      
      // Check for duplicates by subject name
      const seen = new Set();
      const duplicates = [];
      
      enrollments.rows.forEach(e => {
        const key = `${e.subject_name}-${e.phase}`;
        if (seen.has(key)) {
          duplicates.push(e);
        } else {
          seen.add(key);
        }
      });
      
      if (duplicates.length > 0) {
        console.log('  ⚠️  DUPLICATES FOUND:');
        duplicates.forEach(d => {
          console.log(`     - ${d.subject_name} (${d.code})`);
        });
      }
      
      enrollments.rows.forEach(e => {
        console.log(`  ${e.phase}: ${e.subject_name}`);
      });
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
