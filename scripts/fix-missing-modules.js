#!/usr/bin/env node
/**
 * Fix missing compulsory modules for GET Phase (Grades 1-9)
 * Ensures all schools have: Home Language, FAL, Maths, Life Skills/Life Orientation for all grades
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');

// Define the core subjects that every grade 1-9 should have
const GET_CORE_SUBJECTS = {
  'Home Language': { dept: 'Languages', credits: 10 },
  'First Additional Language': { dept: 'Languages', credits: 10 },
  'Mathematics': { dept: 'Mathematics', credits: 10 },
  'Life Skills': { dept: 'Life Skills', credits: 5 }, // Grades 1-6
  'Life Orientation': { dept: 'Life Orientation', credits: 5 }, // Grades 7-9
  'Natural Sciences and Technology': { dept: 'Natural Sciences', credits: 8 }, // Grades 4-6
  'Social Sciences': { dept: 'Social Sciences', credits: 8 }, // Grades 4-6
  'Natural Sciences': { dept: 'Natural Sciences', credits: 8 }, // Grades 7-9
  'Technology': { dept: 'Technology', credits: 5 }, // Grades 7-9
  'Economic Management Sciences': { dept: 'EMS', credits: 5 }, // Grades 7-9
  'Creative Arts': { dept: 'Arts', credits: 5 }, // Grades 7-9
};

async function fixMissingModules() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Fix Missing GET Phase Modules                            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Get all schools
  const schools = await db.query('SELECT id, name, code FROM schools');
  console.log(`Processing ${schools.rows.length} schools...\n`);

  for (const school of schools.rows) {
    console.log(`\n📚 ${school.name}`);
    console.log('─'.repeat(60));
    
    // Process grades 1-9
    for (let gradeLevel = 1; gradeLevel <= 9; gradeLevel++) {
      const gradeResult = await db.query(
        'SELECT id FROM grades WHERE level = $1',
        [gradeLevel]
      );
      
      if (gradeResult.rows.length === 0) {
        console.log(`  Grade ${gradeLevel}: Grade not found in database`);
        continue;
      }
      
      const gradeId = gradeResult.rows[0].id;
      
      // Determine which subjects this grade should have
      let requiredSubjects = ['Home Language', 'First Additional Language', 'Mathematics'];
      
      if (gradeLevel <= 3) {
        // Foundation Phase (Grades 1-3)
        requiredSubjects.push('Life Skills');
      } else if (gradeLevel <= 6) {
        // Intermediate Phase (Grades 4-6)
        requiredSubjects.push('Life Skills', 'Natural Sciences and Technology', 'Social Sciences');
      } else {
        // Senior Phase (Grades 7-9)
        requiredSubjects.push('Life Orientation', 'Natural Sciences', 'Social Sciences', 'Technology', 'Economic Management Sciences', 'Creative Arts');
      }
      
      // Check which subjects are missing
      const existing = await db.query(`
        SELECT m.name 
        FROM modules m
        JOIN grade_modules gm ON m.id = gm.module_id
        WHERE m.school_id = $1 AND gm.grade_id = $2
      `, [school.id, gradeId]);
      
      const existingNames = existing.rows.map(r => r.name);
      const missingSubjects = requiredSubjects.filter(subj => !existingNames.includes(subj));
      
      if (missingSubjects.length > 0) {
        console.log(`  Grade ${gradeLevel}: Adding ${missingSubjects.length} missing modules...`);
        
        for (const subjectName of missingSubjects) {
          const subjectInfo = GET_CORE_SUBJECTS[subjectName];
          const newId = uuidv4();
          const code = `${subjectName.substring(0, 3).toUpperCase()}-${gradeLevel}-${school.code}`;
          
          try {
            // Create module
            await db.query(
              `INSERT INTO modules (id, code, name, description, department, credits, is_active, school_id, school_code)
               VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
              [
                newId, 
                code, 
                subjectName, 
                `${subjectName} for Grade ${gradeLevel}`, 
                subjectInfo.dept, 
                subjectInfo.credits, 
                school.id, 
                school.code
              ]
            );
            
            // Link to grade
            await db.query(
              `INSERT INTO grade_modules (grade_id, module_id, is_compulsory)
               VALUES ($1, $2, true)`,
              [gradeId, newId]
            );
            
            console.log(`    ✅ ${subjectName}`);
          } catch (err) {
            console.log(`    ❌ ${subjectName}: ${err.message}`);
          }
        }
      } else {
        console.log(`  Grade ${gradeLevel}: ✅ All ${existingNames.length} modules present`);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Fix complete!');
  console.log('\nNext steps:');
  console.log('  node scripts/test-enrollment.js');
  
  process.exit(0);
}

fixMissingModules().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
