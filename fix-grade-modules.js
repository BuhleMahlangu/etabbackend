const db = require('./src/config/database');

async function fix() {
  try {
    // Get all KHS modules
    const modules = await db.query(`
      SELECT id, code, name 
      FROM modules 
      WHERE school_code = 'KHS'
    `);
    
    console.log('Found', modules.rows.length, 'KHS modules');
    
    // Get grades mapping
    const grades = await db.query(`
      SELECT id, name, level FROM grades ORDER BY level
    `);
    
    const gradeMap = {};
    grades.rows.forEach(g => {
      gradeMap[g.name] = g.id;
    });
    
    console.log('Grade map:', Object.keys(gradeMap));
    
    let fixed = 0;
    
    for (const mod of modules.rows) {
      // Determine grade from code
      // e.g., KHS-HL-F -> Foundation (Grades 1-3)
      // e.g., KHS-ENG-FET -> FET (Grades 10-12)
      
      let gradeIds = [];
      
      if (mod.code.endsWith('-F')) {
        // Foundation: Grades 1, 2, 3
        gradeIds = [gradeMap['Grade 1'], gradeMap['Grade 2'], gradeMap['Grade 3']];
      } else if (mod.code.endsWith('-I')) {
        // Intermediate: Grades 4, 5, 6
        gradeIds = [gradeMap['Grade 4'], gradeMap['Grade 5'], gradeMap['Grade 6']];
      } else if (mod.code.endsWith('-H') || mod.code === 'KHS-LO' || mod.code === 'KHS-EMS' || mod.code === 'KHS-CA' || mod.code === 'KHS-TECH' || mod.code === 'KHS-NS-S' || mod.code === 'KHS-SS-S' || mod.code === 'KHS-ZUL-FAL' || mod.code === 'KHS-MATH-S') {
        // Senior: Grades 7, 8, 9
        gradeIds = [gradeMap['Grade 7'], gradeMap['Grade 8'], gradeMap['Grade 9']];
      } else if (mod.code.endsWith('-FET') || ['KPS-ACC', 'KPS-BUS', 'KPS-ECON', 'KPS-LIFE-SCI', 'KPS-PHY-SCI', 'KPS-GEO', 'KPS-HIST', 'KPS-MATH-LIT', 'KPS-LO-FET'].some(code => mod.code.includes(code.split('-')[1]))) {
        // FET: Grades 10, 11, 12
        gradeIds = [gradeMap['Grade 10'], gradeMap['Grade 11'], gradeMap['Grade 12']];
      }
      
      // Create grade_modules entries
      for (const gradeId of gradeIds) {
        if (gradeId) {
          try {
            await db.query(`
              INSERT INTO grade_modules (grade_id, module_id, is_compulsory)
              VALUES ($1, $2, true)
              ON CONFLICT DO NOTHING
            `, [gradeId, mod.id]);
          } catch (e) {
            // Ignore conflicts
          }
        }
      }
      
      if (gradeIds.length > 0) fixed++;
    }
    
    console.log('✅ Fixed', fixed, 'modules with grade_modules entries');
    
    // Also fix KPS
    const kpsModules = await db.query(`
      SELECT id, code, name 
      FROM modules 
      WHERE school_code = 'KPS'
    `);
    
    let kpsFixed = 0;
    for (const mod of kpsModules.rows) {
      let gradeIds = [];
      
      if (mod.code.endsWith('-F')) {
        gradeIds = [gradeMap['Grade 1'], gradeMap['Grade 2'], gradeMap['Grade 3']];
      } else if (mod.code.endsWith('-I')) {
        gradeIds = [gradeMap['Grade 4'], gradeMap['Grade 5'], gradeMap['Grade 6']];
      } else if (mod.code.endsWith('-H') || ['KPS-LO', 'KPS-EMS', 'KPS-CA', 'KPS-TECH', 'KPS-NS-S', 'KPS-SS-S', 'KPS-ZUL-FAL', 'KPS-MATH-S'].includes(mod.code)) {
        gradeIds = [gradeMap['Grade 7'], gradeMap['Grade 8'], gradeMap['Grade 9']];
      } else if (mod.code.endsWith('-FET') || mod.code.match(/KPS-(ACC|BUS|ECON|LIFE-SCI|PHY-SCI|GEO|HIST|MATH-LIT|LO-FET)/)) {
        gradeIds = [gradeMap['Grade 10'], gradeMap['Grade 11'], gradeMap['Grade 12']];
      }
      
      for (const gradeId of gradeIds) {
        if (gradeId) {
          try {
            await db.query(`
              INSERT INTO grade_modules (grade_id, module_id, is_compulsory)
              VALUES ($1, $2, true)
              ON CONFLICT DO NOTHING
            `, [gradeId, mod.id]);
          } catch (e) {}
        }
      }
      
      if (gradeIds.length > 0) kpsFixed++;
    }
    
    console.log('✅ Fixed', kpsFixed, 'KPS modules');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

fix();
