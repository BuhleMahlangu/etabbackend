const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

async function fix() {
  try {
    console.log('Fixing missing enrollments...\n');
    
    // Find all learners without enrollments
    const learners = await db.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.grade_id,
        u.school_id,
        g.name as grade_name,
        g.level as grade_level
      FROM users u
      JOIN grades g ON u.grade_id = g.id
      LEFT JOIN learner_modules lm ON u.id = lm.learner_id
      WHERE u.role = 'learner'
      AND lm.id IS NULL
    `);
    
    console.log(`Found ${learners.rows.length} learners without enrollments`);
    
    for (const learner of learners.rows) {
      console.log(`\n${learner.first_name} ${learner.last_name} (${learner.email})`);
      console.log(`  Grade: ${learner.grade_name} (Level ${learner.grade_level})`);
      
      // Find modules for this grade
      const modules = await db.query(`
        SELECT m.id, m.code, m.name, gm.is_compulsory
        FROM modules m
        JOIN grade_modules gm ON m.id = gm.module_id
        WHERE gm.grade_id = $1
        AND m.school_id = $2
        AND m.is_active = true
      `, [learner.grade_id, learner.school_id]);
      
      console.log(`  Found ${modules.rows.length} modules`);
      
      // Determine which modules to enroll based on grade level
      const isFET = learner.grade_level >= 10;
      
      let enrolled = 0;
      for (const mod of modules.rows) {
        // For FET: Only auto-enroll compulsory subjects
        // For non-FET: Auto-enroll all subjects
        const shouldEnroll = isFET ? mod.is_compulsory : true;
        
        if (shouldEnroll) {
          try {
            await db.query(`
              INSERT INTO learner_modules (id, learner_id, module_id, grade_id, status, progress_percent)
              VALUES ($1, $2, $3, $4, 'active', 0)
              ON CONFLICT DO NOTHING
            `, [uuidv4(), learner.id, mod.id, learner.grade_id]);
            enrolled++;
            console.log(`    ✅ Enrolled: ${mod.name}`);
          } catch (err) {
            console.log(`    ⚠️  Failed: ${mod.name} - ${err.message}`);
          }
        }
      }
      
      console.log(`  Total enrolled: ${enrolled}`);
    }
    
    console.log('\n✅ Done!');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}

fix();
