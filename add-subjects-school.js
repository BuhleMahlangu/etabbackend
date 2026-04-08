const db = require('./src/config/database');

async function addSchoolColumns() {
  try {
    // Add school_id column
    await db.query(`
      ALTER TABLE subjects 
      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE
    `);
    console.log('✅ Added school_id column to subjects table');
    
    // Add school_code column
    await db.query(`
      ALTER TABLE subjects 
      ADD COLUMN IF NOT EXISTS school_code VARCHAR(20)
    `);
    console.log('✅ Added school_code column to subjects table');
    
    // Create index for faster queries
    await db.query(`CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_subjects_school_code ON subjects(school_code)`);
    console.log('✅ Created indexes for school_id and school_code');
    
    // Assign existing subjects to Demo School (DEMO) as default
    const demoSchool = await db.query("SELECT id, code FROM schools WHERE code = 'DEMO'");
    if (demoSchool.rows.length > 0) {
      const demoId = demoSchool.rows[0].id;
      const demoCode = demoSchool.rows[0].code;
      
      await db.query(`
        UPDATE subjects 
        SET school_id = $1, school_code = $2 
        WHERE school_id IS NULL
      `, [demoId, demoCode]);
      console.log(`✅ Assigned existing subjects to ${demoCode} school`);
    }
    
    // Show updated subjects
    const subjects = await db.query(`
      SELECT s.name, s.code, sch.name as school_name, s.school_code 
      FROM subjects s
      JOIN schools sch ON s.school_id = sch.id
      LIMIT 5
    `);
    
    console.log('\nSample subjects with schools:');
    subjects.rows.forEach(s => {
      console.log(`  - ${s.name} (${s.code}) → ${s.school_name} (${s.school_code})`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

addSchoolColumns();
