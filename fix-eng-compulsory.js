const db = require('./src/config/database');

async function fix() {
  try {
    console.log('Fixing ENG-FET as compulsory...\n');
    
    const schools = await db.query('SELECT id, code FROM schools');
    
    for (const school of schools.rows) {
      const moduleResult = await db.query(
        'SELECT id FROM modules WHERE code = $1 AND school_id = $2',
        [school.code + '-ENG-FET', school.id]
      );
      
      if (moduleResult.rows.length > 0) {
        const moduleId = moduleResult.rows[0].id;
        
        // Update grade_modules to set is_compulsory = true for grades 10-12
        for (const level of [10, 11, 12]) {
          const gradeResult = await db.query('SELECT id FROM grades WHERE level = $1', [level]);
          if (gradeResult.rows.length > 0) {
            const gradeId = gradeResult.rows[0].id;
            await db.query(
              'UPDATE grade_modules SET is_compulsory = true WHERE module_id = $1 AND grade_id = $2',
              [moduleId, gradeId]
            );
          }
        }
        console.log(`✅ Updated ENG-FET for ${school.code}`);
      } else {
        console.log(`⚠️  ENG-FET not found for ${school.code}`);
      }
    }
    
    console.log('\nDone!');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

fix();
