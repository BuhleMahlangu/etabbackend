#!/usr/bin/env node
const db = require('../src/config/database');

async function debugCompulsory() {
  console.log('=== Debugging Compulsory Modules ===\n');
  
  // Get all modules for Grade 4
  console.log('Grade 4 - All modules in grade_modules:');
  const grade4 = await db.query(`
    SELECT m.name, m.school_id, gm.is_compulsory, g.level, g.name as grade_name
    FROM grade_modules gm
    JOIN modules m ON gm.module_id = m.id
    JOIN grades g ON gm.grade_id = g.id
    WHERE g.level = 4
    ORDER BY m.name
  `);
  
  console.log('Total entries:', grade4.rows.length);
  grade4.rows.forEach(r => {
    console.log(`  - ${r.name} | School: ${r.school_id} | Compulsory: ${r.is_compulsory}`);
  });
  
  // Check schools
  console.log('\n=== Schools ===');
  const schools = await db.query('SELECT id, name FROM schools');
  schools.rows.forEach(s => console.log(`  ${s.id}: ${s.name}`));
  
  // Test with specific school
  const schoolId = schools.rows[0]?.id;
  console.log(`\n=== Testing with school: ${schools.rows[0]?.name} (${schoolId}) ===`);
  
  for (let grade = 1; grade <= 9; grade++) {
    const result = await db.query(`
      SELECT DISTINCT m.name, m.school_id, gm.is_compulsory
      FROM modules m
      JOIN grade_modules gm ON m.id = gm.module_id
      JOIN grades g ON gm.grade_id = g.id
      WHERE g.level = $1
      AND m.school_id = $2
      AND m.is_active = true
    `, [grade, schoolId]);
    
    console.log(`\nGrade ${grade}: ${result.rows.length} subjects`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));
  }
  
  // Check for modules with NULL school_id
  console.log('\n=== Modules with NULL school_id ===');
  const nullSchool = await db.query(`
    SELECT m.name, g.level as grade_level
    FROM modules m
    JOIN grade_modules gm ON m.id = gm.module_id
    JOIN grades g ON gm.grade_id = g.id
    WHERE m.school_id IS NULL
    AND g.level BETWEEN 1 AND 9
    ORDER BY g.level, m.name
  `);
  
  console.log('Count:', nullSchool.rows.length);
  nullSchool.rows.forEach(r => console.log(`  Grade ${r.grade_level}: ${r.name}`));
  
  process.exit(0);
}

debugCompulsory().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
