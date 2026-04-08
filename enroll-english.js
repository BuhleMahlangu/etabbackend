const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

async function enroll() {
  try {
    console.log('Enrolling FET learners in English Home Language...\n');
    
    // Find FET learners without English enrollment
    const learners = await db.query(`
      SELECT DISTINCT u.id, u.email, u.school_id, m.id as module_id
      FROM users u
      JOIN grades g ON u.grade_id = g.id
      JOIN modules m ON m.school_id = u.school_id
      WHERE u.role = 'learner'
      AND g.level >= 10
      AND m.code LIKE '%-ENG-FET'
      AND NOT EXISTS (
        SELECT 1 FROM learner_modules lm 
        WHERE lm.learner_id = u.id 
        AND lm.module_id = m.id
      )
    `);
    
    console.log(`Found ${learners.rows.length} learners to enroll`);
    
    for (const learner of learners.rows) {
      try {
        // Get grade_id for the learner
        const gradeResult = await db.query(
          'SELECT grade_id FROM users WHERE id = $1',
          [learner.id]
        );
        const gradeId = gradeResult.rows[0]?.grade_id;
        
        await db.query(`
          INSERT INTO learner_modules (id, learner_id, module_id, grade_id, status, progress_percent)
          VALUES ($1, $2, $3, $4, 'active', 0)
          ON CONFLICT DO NOTHING
        `, [uuidv4(), learner.id, learner.module_id, gradeId]);
        
        console.log(`✅ Enrolled ${learner.email}`);
      } catch (err) {
        console.log(`⚠️  Failed ${learner.email}: ${err.message}`);
      }
    }
    
    console.log('\nDone!');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

enroll();
