#!/usr/bin/env node
/**
 * Test Enrollment Logic for Grades 1-12
 */

require('dotenv').config();
const db = require('../src/config/database');

// Import the function from authController
const getCompulsorySubjectsForGrade = async (grade, schoolId) => {
  const gradeLevel = parseInt(grade);
  const isFET = gradeLevel >= 10;
  
  const result = await db.query(
    `SELECT DISTINCT m.* FROM modules m
     JOIN grade_modules gm ON m.id = gm.module_id
     JOIN grades g ON gm.grade_id = g.id
     WHERE g.level = $1
     AND m.school_id = $2
     AND m.is_active = true
     AND ($3 = false OR gm.is_compulsory = true)`,
    [gradeLevel, schoolId, isFET]
  );
  return result.rows;
};

async function testEnrollment() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       Testing Enrollment Logic (Grades 1-12)              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Get a school ID
  const schools = await db.query('SELECT id, name FROM schools LIMIT 1');
  if (schools.rows.length === 0) {
    console.log('No schools found!');
    process.exit(1);
  }
  
  const schoolId = schools.rows[0].id;
  console.log('Using school:', schools.rows[0].name, '(ID:', schoolId + ')\n');

  // Test each grade
  console.log('Enrollment Summary:');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (let grade = 1; grade <= 12; grade++) {
    const subjects = await getCompulsorySubjectsForGrade(grade.toString(), schoolId);
    const phase = grade >= 10 ? 'FET' : 'GET';
    
    console.log(`Grade ${grade} (${phase}): ${subjects.length} subjects`);
    
    if (subjects.length === 0) {
      console.log('  ⚠️  NO SUBJECTS - Enrollment will fail!');
    } else if (subjects.length > 15) {
      console.log('  ⚠️  Too many subjects - possible duplication issue');
      // Show unique subject names
      const uniqueNames = [...new Set(subjects.map(s => s.name))];
      console.log('  Unique subjects:', uniqueNames.length);
      uniqueNames.forEach(name => console.log(`    - ${name}`));
    } else {
      subjects.forEach(s => console.log(`    - ${s.name}`));
    }
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Summary
  console.log('Summary:');
  let allGood = true;
  for (let grade = 1; grade <= 12; grade++) {
    const subjects = await getCompulsorySubjectsForGrade(grade.toString(), schoolId);
    if (subjects.length === 0) {
      console.log(`❌ Grade ${grade}: No subjects (CRITICAL)`);
      allGood = false;
    } else if (subjects.length > 12) {
      console.log(`⚠️  Grade ${grade}: ${subjects.length} subjects (may have duplicates)`);
    } else {
      console.log(`✅ Grade ${grade}: ${subjects.length} subjects`);
    }
  }

  console.log();
  if (allGood) {
    console.log('✅ All grades have subjects for enrollment!');
  } else {
    console.log('❌ Some grades are missing subjects. Check the database.');
  }

  process.exit(0);
}

testEnrollment().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
