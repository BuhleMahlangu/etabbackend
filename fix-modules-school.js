const db = require('./src/config/database');

async function fix() {
  try {
    // Add school_id and school_code to modules
    await db.query(`ALTER TABLE modules ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id)`);
    await db.query(`ALTER TABLE modules ADD COLUMN IF NOT EXISTS school_code VARCHAR(20)`);
    console.log('✅ Added school columns to modules');
    
    // Update existing modules with school info
    const demoSchool = await db.query("SELECT id, code FROM schools WHERE code = 'DEMO'");
    if (demoSchool.rows.length > 0) {
      await db.query(`
        UPDATE modules 
        SET school_id = $1, school_code = $2 
        WHERE school_id IS NULL
      `, [demoSchool.rows[0].id, demoSchool.rows[0].code]);
      console.log('✅ Updated existing modules with DEMO school');
    }
    
    // Create modules for KHS based on subjects
    const khs = await db.query("SELECT id, code FROM schools WHERE code = 'KHS'");
    if (khs.rows.length === 0) {
      console.log('KHS not found');
      return;
    }
    
    const khsId = khs.rows[0].id;
    const khsCode = khs.rows[0].code;
    
    // Get KHS subjects and create modules for them
    const subjects = await db.query(
      'SELECT * FROM subjects WHERE school_code = $1',
      [khsCode]
    );
    
    console.log(`Found ${subjects.rows.length} KHS subjects`);
    
    let created = 0;
    for (const subj of subjects.rows) {
      // Check if module already exists
      const existing = await db.query(
        'SELECT id FROM modules WHERE code = $1 AND school_id = $2',
        [subj.code, khsId]
      );
      
      if (existing.rows.length === 0) {
        // Create module from subject
        await db.query(`
          INSERT INTO modules (code, name, description, department, credits, 
            is_active, school_id, school_code)
          VALUES ($1, $2, $3, $4, $5, true, $6, $7)
        `, [
          subj.code,
          subj.name,
          subj.description,
          subj.department,
          subj.credits || 10,
          khsId,
          khsCode
        ]);
        created++;
      }
    }
    
    console.log(`✅ Created ${created} modules for KHS`);
    
    // Now assign Sphiwe to some modules
    const teacher = await db.query(
      "SELECT id FROM users WHERE email = 'sphiwem@gmail.com'"
    );
    
    if (teacher.rows.length > 0) {
      const teacherId = teacher.rows[0].id;
      
      // Get some KHS modules to assign
      const modules = await db.query(
        'SELECT id, code FROM modules WHERE school_code = $1 LIMIT 5',
        [khsCode]
      );
      
      for (const mod of modules.rows) {
        // Check if already assigned
        const existing = await db.query(
          'SELECT id FROM teacher_assignments WHERE teacher_id = $1 AND subject_id = $2',
          [teacherId, mod.id]
        );
        
        if (existing.rows.length === 0) {
          // Create assignment - need grade_id, let's get one from applicable grades
          await db.query(`
            INSERT INTO teacher_assignments (teacher_id, subject_id, grade_id, is_active, is_primary, academic_year)
            VALUES ($1, $2, (SELECT id FROM grades WHERE level = 10 LIMIT 1), true, true, '2026')
          `, [teacherId, mod.id]);
          console.log(`  Assigned to ${mod.code}`);
        }
      }
      
      console.log('✅ Created teacher assignments');
    }
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

fix();
