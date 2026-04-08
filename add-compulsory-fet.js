const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

// FET compulsory subjects
const compulsorySubjects = [
  { code: 'ENG-FET', name: 'English Home Language', department: 'Languages' },
  { code: 'ZUL-FET', name: 'isiZulu First Additional Language', department: 'Languages' },
  { code: 'LO-FET', name: 'Life Orientation', department: 'Life Orientation' }
];

async function add() {
  try {
    console.log('Adding compulsory FET subjects...\n');
    
    const schools = await db.query('SELECT id, code FROM schools');
    
    for (const school of schools.rows) {
      console.log(`${school.code}:`);
      
      for (const subj of compulsorySubjects) {
        const fullCode = `${school.code}-${subj.code}`;
        
        // Check if subject exists
        const existing = await db.query(
          'SELECT id FROM subjects WHERE code = $1 AND school_id = $2',
          [fullCode, school.id]
        );
        
        let subjectId;
        
        if (existing.rows.length === 0) {
          // Create subject
          subjectId = uuidv4();
          await db.query(
            `INSERT INTO subjects (id, code, name, phase, department, credits, school_id, school_code, applicable_grades, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
            [subjectId, fullCode, subj.name, 'FET', subj.department, 10, school.id, school.code, ['Grade 10', 'Grade 11', 'Grade 12']]
          );
          console.log(`  ✅ Created subject: ${subj.name}`);
        } else {
          subjectId = existing.rows[0].id;
          console.log(`  ℹ️  Subject exists: ${subj.name}`);
        }
        
        // Check if module exists
        const existingMod = await db.query(
          'SELECT id FROM modules WHERE code = $1 AND school_id = $2',
          [fullCode, school.id]
        );
        
        let moduleId;
        
        if (existingMod.rows.length === 0) {
          moduleId = uuidv4();
          await db.query(
            `INSERT INTO modules (id, code, name, description, department, credits, school_id, school_code, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
            [moduleId, fullCode, subj.name, `${subj.name} module for FET phase`, subj.department, 10, school.id, school.code]
          );
          console.log(`     ✅ Created module`);
        } else {
          moduleId = existingMod.rows[0].id;
          console.log(`     ℹ️  Module exists`);
        }
        
        // Add grade_modules for grades 10, 11, 12 with is_compulsory = true
        for (const gradeLevel of [10, 11, 12]) {
          const gradeResult = await db.query('SELECT id FROM grades WHERE level = $1', [gradeLevel]);
          if (gradeResult.rows.length > 0) {
            const gradeId = gradeResult.rows[0].id;
            await db.query(
              `INSERT INTO grade_modules (module_id, grade_id, is_compulsory)
               VALUES ($1, $2, true)
               ON CONFLICT DO NOTHING`,
              [moduleId, gradeId]
            );
          }
        }
        console.log(`     ✅ Added to grades 10-12 as compulsory`);
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}

add();
