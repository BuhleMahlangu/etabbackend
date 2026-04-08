const db = require('./src/config/database');
const bcrypt = require('bcrypt');

async function test() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create test school
    const schoolResult = await client.query(
      `INSERT INTO schools (name, code, address, subscription_plan, max_teachers, max_learners)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      ['Test Secondary School', 'TSS', '789 Test Ave', 'free', 10, 500]
    );
    
    const school = schoolResult.rows[0];
    console.log('✅ Created school:', school.name, `(${school.code})`);
    
    // Create default subjects for the school
    const subjects = [
      // Foundation Phase
      { name: 'Home Language', code: 'HL-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Languages' },
      { name: 'First Additional Language', code: 'FAL-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Languages' },
      { name: 'Mathematics', code: 'MATH-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Mathematics' },
      { name: 'Life Skills', code: 'LS-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Life Skills' },
      
      // FET Phase
      { name: 'English Home Language', code: 'ENG-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Languages' },
      { name: 'Mathematics', code: 'MATH-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Mathematics' },
    ];
    
    let createdCount = 0;
    for (const subj of subjects) {
      const uniqueCode = `${school.code}-${subj.code}`;
      try {
        await client.query(`
          INSERT INTO subjects (code, name, phase, applicable_grades, department,
            school_id, school_code, is_active, is_compulsory, credits)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, 10)
        `, [uniqueCode, subj.name, subj.phase, subj.grades, subj.dept, school.id, school.code]);
        createdCount++;
      } catch (e) {
        console.log(`  Skipped ${uniqueCode}: ${e.message}`);
      }
    }
    
    console.log(`✅ Created ${createdCount} subjects for ${school.code}`);
    
    // Verify subjects were created
    const subjectCount = await client.query(
      'SELECT COUNT(*) as count FROM subjects WHERE school_code = $1',
      [school.code]
    );
    console.log(`📊 Total subjects for ${school.code}: ${subjectCount.rows[0].count}`);
    
    // Show sample subjects
    const sample = await client.query(
      'SELECT code, name, phase FROM subjects WHERE school_code = $1 LIMIT 5',
      [school.code]
    );
    console.log('\nSample subjects:');
    sample.rows.forEach(s => console.log(`  - ${s.code}: ${s.name} (${s.phase})`));
    
    await client.query('ROLLBACK');
    console.log('\n✅ Test completed successfully (rolled back)');
    
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

test();
