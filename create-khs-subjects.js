const db = require('./src/config/database');

async function createSubjects() {
  try {
    // Get Kriel High School ID
    const khs = await db.query("SELECT id, code FROM schools WHERE code = 'KHS'");
    if (khs.rows.length === 0) {
      console.error('Kriel High School not found');
      return;
    }
    const schoolId = khs.rows[0].id;
    const schoolCode = khs.rows[0].code;
    
    // Define KHS subjects (similar structure to Demo School)
    const subjects = [
      // Foundation Phase
      { name: 'Home Language', code: 'KHS-HL-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Languages' },
      { name: 'First Additional Language', code: 'KHS-FAL-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Languages' },
      { name: 'Mathematics', code: 'KHS-MATH-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Mathematics' },
      { name: 'Life Skills', code: 'KHS-LS-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Life Skills' },
      
      // Intermediate Phase
      { name: 'Home Language', code: 'KHS-HL-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Languages' },
      { name: 'First Additional Language', code: 'KHS-FAL-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Languages' },
      { name: 'Mathematics', code: 'KHS-MATH-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Mathematics' },
      { name: 'Natural Sciences', code: 'KHS-NS-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Sciences' },
      { name: 'Social Sciences', code: 'KHS-SS-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Social Sciences' },
      { name: 'Life Skills', code: 'KHS-LS-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Life Skills' },
      
      // Senior Phase (GET)
      { name: 'English Home Language', code: 'KHS-ENG-H', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Languages' },
      { name: 'isiZulu First Additional', code: 'KHS-ZUL-FAL', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Languages' },
      { name: 'Mathematics', code: 'KHS-MATH-S', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Mathematics' },
      { name: 'Natural Sciences', code: 'KHS-NS-S', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Sciences' },
      { name: 'Social Sciences', code: 'KHS-SS-S', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Social Sciences' },
      { name: 'Economic Management Sciences', code: 'KHS-EMS', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Business' },
      { name: 'Life Orientation', code: 'KHS-LO', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Life Skills' },
      { name: 'Creative Arts', code: 'KHS-CA', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Arts' },
      { name: 'Technology', code: 'KHS-TECH', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Technology' },
      
      // FET Phase
      { name: 'English Home Language', code: 'KHS-ENG-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Languages' },
      { name: 'isiZulu First Additional', code: 'KHS-ZUL-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Languages' },
      { name: 'Mathematics', code: 'KHS-MATH-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Mathematics' },
      { name: 'Mathematical Literacy', code: 'KHS-MATH-LIT', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Mathematics' },
      { name: 'Life Sciences', code: 'KHS-LIFE-SCI', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Sciences' },
      { name: 'Physical Sciences', code: 'KHS-PHY-SCI', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Sciences' },
      { name: 'Geography', code: 'KHS-GEO', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Sciences' },
      { name: 'History', code: 'KHS-HIST', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Social Sciences' },
      { name: 'Accounting', code: 'KHS-ACC', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Business' },
      { name: 'Business Studies', code: 'KHS-BUS', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Business' },
      { name: 'Economics', code: 'KHS-ECON', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Business' },
      { name: 'Life Orientation', code: 'KHS-LO-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Life Skills' }
    ];
    
    let created = 0;
    for (const subj of subjects) {
      // Check if already exists
      const existing = await db.query(
        'SELECT id FROM subjects WHERE code = $1 AND school_code = $2',
        [subj.code, schoolCode]
      );
      
      if (existing.rows.length === 0) {
        await db.query(`
          INSERT INTO subjects (
            code, name, phase, applicable_grades, department,
            school_id, school_code, is_active, is_compulsory, credits
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, 10)
        `, [
          subj.code,
          subj.name,
          subj.phase,
          subj.grades,
          subj.dept,
          schoolId,
          schoolCode
        ]);
        created++;
      }
    }
    
    console.log(`✅ Created ${created} subjects for Kriel High School`);
    
    // Show subjects by phase
    const byPhase = await db.query(`
      SELECT phase, COUNT(*) as count 
      FROM subjects 
      WHERE school_code = 'KHS' 
      GROUP BY phase
    `);
    
    console.log('\nSubjects by phase:');
    byPhase.rows.forEach(r => {
      console.log(`  - ${r.phase}: ${r.count} subjects`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

createSubjects();
