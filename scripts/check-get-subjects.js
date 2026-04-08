#!/usr/bin/env node
/**
 * Check GET Phase (Grade 1-9) Subject Setup
 */

require('dotenv').config();
const db = require('../src/config/database');

async function checkSubjects() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       GET Phase (Grade 1-9) Subject Enrollment Check      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Check grades table
  console.log('1️⃣  Grades Table:');
  const grades = await db.query('SELECT id, name, level FROM grades ORDER BY level');
  grades.rows.forEach(g => {
    console.log(`   Grade ${g.level} (ID: ${g.id}): ${g.name}`);
  });
  console.log();

  // Check modules for each grade 1-9
  console.log('2️⃣  Subjects per Grade (GET Phase):');
  for (let grade = 1; grade <= 9; grade++) {
    const result = await db.query(
      `SELECT m.id, m.name, m.applicable_grades, m.is_active, m.school_id, s.name as school_name
       FROM modules m
       LEFT JOIN schools s ON m.school_id = s.id
       WHERE $1 = ANY(m.applicable_grades) AND m.is_active = true`,
      [grade.toString()]
    );
    console.log(`   Grade ${grade}: ${result.rows.length} subjects`);
    if (result.rows.length > 0) {
      result.rows.forEach(r => {
        console.log(`      - ${r.name} (School: ${r.school_name || r.school_id || 'N/A'})`);
      });
    } else {
      console.log(`      ⚠️  NO SUBJECTS FOUND!`);
    }
  }
  console.log();

  // Check all modules
  console.log('3️⃣  All Modules in Database:');
  const allModules = await db.query(
    `SELECT m.name, m.applicable_grades, m.is_active, m.school_id, s.name as school_name
     FROM modules m
     LEFT JOIN schools s ON m.school_id = s.id
     ORDER BY m.name`
  );
  console.log(`   Total modules: ${allModules.rows.length}`);
  allModules.rows.forEach(m => {
    const grades = Array.isArray(m.applicable_grades) ? m.applicable_grades.join(', ') : m.applicable_grades;
    console.log(`   - ${m.name} | Grades: [${grades}] | Active: ${m.is_active} | School: ${m.school_name || m.school_id || 'N/A'}`);
  });
  console.log();

  // Check schools
  console.log('4️⃣  Schools:');
  const schools = await db.query('SELECT id, name, code FROM schools');
  schools.rows.forEach(s => {
    console.log(`   - ${s.name} (Code: ${s.code}, ID: ${s.id})`);
  });
  console.log();

  // Simulate enrollment for a test grade
  console.log('5️⃣  Test Enrollment Simulation:');
  const testGrade = '5';
  const testSchoolId = schools.rows[0]?.id;
  console.log(`   Testing Grade ${testGrade} enrollment for school: ${schools.rows[0]?.name || 'N/A'}`);
  
  const enrollResult = await db.query(
    `SELECT * FROM modules 
     WHERE $1 = ANY(applicable_grades) 
     AND is_active = true
     AND (school_id = $2 OR school_id IS NULL)`,
    [testGrade, testSchoolId]
  );
  console.log(`   Would enroll in: ${enrollResult.rows.length} subjects`);
  enrollResult.rows.forEach(r => console.log(`      - ${r.name}`));
  console.log();

  // Check for issues
  console.log('6️⃣  Issues Found:');
  let issues = 0;
  
  for (let grade = 1; grade <= 9; grade++) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM modules WHERE $1 = ANY(applicable_grades) AND is_active = true',
      [grade.toString()]
    );
    if (parseInt(result.rows[0].count) === 0) {
      console.log(`   ❌ Grade ${grade}: No active subjects found!`);
      issues++;
    }
  }

  if (allModules.rows.length === 0) {
    console.log('   ❌ No modules exist in the database!');
    issues++;
  }

  // Check if modules are school-specific
  const schoolSpecificModules = allModules.rows.filter(m => m.school_id !== null);
  if (schoolSpecificModules.length > 0 && schoolSpecificModules.length === allModules.rows.length) {
    console.log('   ⚠️  All modules are school-specific. This may cause issues if learners enroll without a school_id.');
    issues++;
  }

  if (issues === 0) {
    console.log('   ✅ No issues found!');
  }
  console.log();

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    Summary                                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`Total modules: ${allModules.rows.length}`);
  console.log(`Total schools: ${schools.rows.length}`);
  console.log(`Grades 1-9 coverage: ${grades.rows.filter(g => g.level >= 1 && g.level <= 9).length} grades`);

  await db.end();
}

checkSubjects().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
