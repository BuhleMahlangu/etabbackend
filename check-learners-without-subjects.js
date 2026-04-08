const db = require('./src/config/database');

async function check() {
  try {
    console.log('Checking for learners without subjects...\n');
    
    // Find all learners and their enrollment counts
    const learners = await db.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.grade_id,
        u.school_id,
        s.code as school_code,
        g.name as grade_name,
        g.level as grade_level,
        COUNT(lm.id) as enrollment_count
      FROM users u
      LEFT JOIN learner_modules lm ON u.id = lm.learner_id
      LEFT JOIN schools s ON u.school_id = s.id
      LEFT JOIN grades g ON u.grade_id = g.id
      WHERE u.role = 'learner'
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.grade_id, u.school_id, s.code, g.name, g.level
      ORDER BY enrollment_count ASC
      LIMIT 20
    `);
    
    console.log(`Total learners checked: ${learners.rows.length}`);
    console.log('='.repeat(80));
    
    let learnersWithoutSubjects = 0;
    
    for (const learner of learners.rows) {
      if (learner.enrollment_count === 0) {
        learnersWithoutSubjects++;
        console.log(`\n❌ NO SUBJECTS: ${learner.first_name} ${learner.last_name} (${learner.email})`);
        console.log(`   School: ${learner.school_code || 'N/A'}`);
        console.log(`   Grade: ${learner.grade_name || 'N/A'} (Level: ${learner.grade_level || 'N/A'})`);
        
        // Check if subjects exist for this grade/school
        if (learner.grade_id && learner.school_id) {
          const subjects = await db.query(`
            SELECT s.code, s.name, s.phase
            FROM subjects s
            WHERE s.school_id = $1
            AND $2 = ANY(s.applicable_grades)
            AND s.is_active = true
            LIMIT 5
          `, [learner.school_id, learner.grade_level?.toString()]);
          
          if (subjects.rows.length === 0) {
            console.log(`   ⚠️  No subjects configured for this grade in database`);
          } else {
            console.log(`   ℹ️  ${subjects.rows.length} subjects available for this grade`);
          }
        }
      }
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Learners without subjects: ${learnersWithoutSubjects}`);
    
    // Summary by school
    console.log('\n\nEnrollments by School:');
    console.log('='.repeat(80));
    
    const bySchool = await db.query(`
      SELECT 
        s.code as school_code,
        COUNT(DISTINCT u.id) as total_learners,
        COUNT(DISTINCT CASE WHEN lm.id IS NOT NULL THEN u.id END) as learners_with_subjects,
        COUNT(lm.id) as total_enrollments
      FROM users u
      LEFT JOIN learner_modules lm ON u.id = lm.learner_id
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.role = 'learner'
      GROUP BY s.code
      ORDER BY s.code
    `);
    
    for (const row of bySchool.rows) {
      const without = row.total_learners - row.learners_with_subjects;
      console.log(`${row.school_code || 'N/A'}:`);
      console.log(`  Total learners: ${row.total_learners}`);
      console.log(`  With subjects: ${row.learners_with_subjects}`);
      console.log(`  Without subjects: ${without}`);
      console.log(`  Total enrollments: ${row.total_enrollments}`);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
