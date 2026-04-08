#!/usr/bin/env node
const db = require('../src/config/database');

async function checkGradeModules() {
  // Check grade_modules table
  console.log('=== Grade Modules Table ===');
  const result = await db.query(`
    SELECT gm.*, g.name as grade_name, g.level as grade_level, m.name as module_name
    FROM grade_modules gm
    JOIN grades g ON gm.grade_id = g.id
    JOIN modules m ON gm.module_id = m.id
    ORDER BY g.level, m.name
  `);
  
  console.log('Total grade-module relationships:', result.rows.length);
  result.rows.forEach(row => {
    console.log(`Grade ${row.grade_level} (${row.grade_name}): ${row.module_name} | Compulsory: ${row.is_compulsory}`);
  });
  
  // Check grade 1-9 specifically
  console.log('\n=== GET Phase (Grades 1-9) ===');
  for (let g = 1; g <= 9; g++) {
    const gradeResult = await db.query(`
      SELECT m.name, gm.is_compulsory
      FROM grade_modules gm
      JOIN grades g ON gm.grade_id = g.id
      JOIN modules m ON gm.module_id = m.id
      WHERE g.level = $1
    `, [g]);
    
    console.log(`Grade ${g}: ${gradeResult.rows.length} subjects`);
    gradeResult.rows.forEach(r => {
      console.log(`  - ${r.name} ${r.is_compulsory ? '(compulsory)' : '(optional)'}`);
    });
  }
  
  process.exit(0);
}

checkGradeModules().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
