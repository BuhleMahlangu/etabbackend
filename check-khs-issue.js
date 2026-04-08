const db = require('./src/config/database');

async function check() {
  try {
    console.log('Checking KHS issue...\n');
    
    // Get KHS school ID
    const khsResult = await db.query("SELECT id FROM schools WHERE code = 'KHS'");
    if (khsResult.rows.length === 0) {
      console.log('KHS school not found');
      process.exit(1);
    }
    const khsId = khsResult.rows[0].id;
    console.log('KHS School ID:', khsId);
    
    // Get KHS learners
    const learners = await db.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.grade_id, g.name as grade_name, g.level
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      WHERE u.school_id = $1 AND u.role = 'learner'
    `, [khsId]);
    
    console.log(`\nKHS Learners: ${learners.rows.length}`);
    for (const learner of learners.rows) {
      console.log(`\n${learner.first_name} ${learner.last_name} (${learner.email})`);
      console.log(`  Grade: ${learner.grade_name} (Level: ${learner.level})`);
      console.log(`  Grade ID: ${learner.grade_id}`);
      
      // Check for subjects at this grade level
      if (learner.level) {
        const subjects = await db.query(`
          SELECT code, name, phase, applicable_grades
          FROM subjects
          WHERE school_id = $1
          AND $2 = ANY(applicable_grades)
          AND is_active = true
        `, [khsId, learner.level.toString()]);
        
        console.log(`  Available subjects: ${subjects.rows.length}`);
        subjects.rows.forEach(s => {
          console.log(`    - ${s.code}: ${s.name}`);
        });
        
        // Check for modules
        const modules = await db.query(`
          SELECT m.code, m.name, gm.is_compulsory
          FROM modules m
          JOIN grade_modules gm ON m.id = gm.module_id
          WHERE m.school_id = $1
          AND gm.grade_id = $2
        `, [khsId, learner.grade_id]);
        
        console.log(`  Available modules: ${modules.rows.length}`);
        
        // Check enrollments
        const enrollments = await db.query(`
          SELECT lm.*, m.code, m.name
          FROM learner_modules lm
          JOIN modules m ON lm.module_id = m.id
          WHERE lm.learner_id = $1
        `, [learner.id]);
        
        console.log(`  Current enrollments: ${enrollments.rows.length}`);
      }
    }
    
    // Check all KHS modules
    console.log('\n\nAll KHS Modules:');
    const modules = await db.query(`
      SELECT code, name, department
      FROM modules
      WHERE school_id = $1
      ORDER BY code
    `, [khsId]);
    
    console.log(`Total: ${modules.rows.length} modules`);
    modules.rows.forEach(m => {
      console.log(`  - ${m.code}: ${m.name}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
