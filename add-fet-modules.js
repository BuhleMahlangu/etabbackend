const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

// FET compulsory subjects (only 3)
const compulsoryCodes = ['ENG-FET', 'ZUL-FET', 'LO-FET'];

async function addModules() {
  try {
    const schoolsResult = await db.query('SELECT id, code FROM schools');
    
    for (const school of schoolsResult.rows) {
      console.log(`\n📦 Adding modules for ${school.code}...`);
      
      try {
        // Get all FET subjects for this school
        const subjectsResult = await db.query(
          `SELECT id, code, name, department, credits FROM subjects 
           WHERE school_id = $1 AND phase = 'FET'`,
          [school.id]
        );
        
        console.log(`  Found ${subjectsResult.rows.length} FET subjects`);
        
        let modulesAdded = 0;
        let gmAdded = 0;
        
        for (const subject of subjectsResult.rows) {
          try {
            // Check if module already exists
            const existingModule = await db.query(
              'SELECT id FROM modules WHERE code = $1 AND school_id = $2',
              [subject.code, school.id]
            );
            
            let moduleId;
            
            if (existingModule.rows.length > 0) {
              moduleId = existingModule.rows[0].id;
            } else {
              // Create module
              moduleId = uuidv4();
              await db.query(
                `INSERT INTO modules (id, code, name, description, department, credits, school_id, school_code, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
                [
                  moduleId,
                  subject.code,
                  subject.name,
                  `${subject.name} module for FET phase`,
                  subject.department,
                  subject.credits,
                  school.id,
                  school.code
                ]
              );
              modulesAdded++;
            }
            
            // Determine if compulsory
            const baseCode = subject.code.replace(`${school.code}-`, '');
            const isCompulsory = compulsoryCodes.includes(baseCode);
            
            // Add grade_modules for grades 10, 11, 12
            for (const gradeLevel of [10, 11, 12]) {
              const gradeResult = await db.query(
                'SELECT id FROM grades WHERE level = $1',
                [gradeLevel]
              );
              
              if (gradeResult.rows.length > 0) {
                const gradeId = gradeResult.rows[0].id;
                
                await db.query(
                  `INSERT INTO grade_modules (module_id, grade_id, is_compulsory)
                   VALUES ($1, $2, $3)
                   ON CONFLICT DO NOTHING`,
                  [moduleId, gradeId, isCompulsory]
                );
                gmAdded++;
              }
            }
          } catch (err) {
            console.log(`  ⚠️  Skipping ${subject.code}: ${err.message}`);
          }
        }
        
        console.log(`  ✅ Added ${modulesAdded} modules, ${gmAdded} grade_modules`);
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (e) {
    console.error('❌ Fatal Error:', e.message);
  }
  process.exit(0);
}

addModules();
