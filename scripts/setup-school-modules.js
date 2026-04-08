#!/usr/bin/env node
/**
 * Setup GET Phase (Grades 1-9) modules for schools that are missing them
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');

async function setupSchoolModules() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Setup GET Phase Modules for Schools                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Get all schools
  const schools = await db.query('SELECT id, name, code FROM schools');
  console.log(`Found ${schools.rows.length} schools:\n`);
  schools.rows.forEach(s => console.log(`  - ${s.name} (${s.code})`));
  console.log();

  // Get all grades 1-9
  const grades = await db.query('SELECT id, level, name FROM grades WHERE level BETWEEN 1 AND 9 ORDER BY level');
  
  for (const school of schools.rows) {
    console.log(`\n📚 Processing: ${school.name}`);
    console.log('─'.repeat(60));
    
    for (const grade of grades.rows) {
      // Check if modules exist for this school + grade
      const existing = await db.query(`
        SELECT COUNT(*) as count 
        FROM modules m
        JOIN grade_modules gm ON m.id = gm.module_id
        WHERE m.school_id = $1 AND gm.grade_id = $2
      `, [school.id, grade.id]);
      
      const count = parseInt(existing.rows[0].count);
      
      if (count === 0) {
        console.log(`  Grade ${grade.level}: ❌ No modules - copying from template...`);
        
        // Find template modules for this grade (from any school)
        const templates = await db.query(`
          SELECT DISTINCT m.name, m.description, m.department, m.credits, m.code
          FROM modules m
          JOIN grade_modules gm ON m.id = gm.module_id
          JOIN grades g ON gm.grade_id = g.id
          WHERE g.level = $1
          AND m.is_active = true
        `, [grade.level]);
        
        if (templates.rows.length === 0) {
          console.log(`    ⚠️  No template modules found for Grade ${grade.level}`);
          continue;
        }
        
        // Create modules for this school
        for (const template of templates.rows) {
          // Check if this exact module already exists for this school
          const exists = await db.query(
            'SELECT id FROM modules WHERE name = $1 AND school_id = $2',
            [template.name, school.id]
          );
          
          if (exists.rows.length > 0) {
            // Module exists, just link it to the grade
            await db.query(
              `INSERT INTO grade_modules (grade_id, module_id, is_compulsory)
               VALUES ($1, $2, true)
               ON CONFLICT DO NOTHING`,
              [grade.id, exists.rows[0].id]
            );
          } else {
            // Create new module
            const newId = uuidv4();
            const newCode = `${template.code || 'MOD'}-${school.code}-${grade.level}`;
            
            await db.query(
              `INSERT INTO modules (id, code, name, description, department, credits, is_active, school_id, school_code)
               VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
              [newId, newCode, template.name, template.description, template.department, template.credits, school.id, school.code]
            );
            
            // Link to grade
            await db.query(
              `INSERT INTO grade_modules (grade_id, module_id, is_compulsory)
               VALUES ($1, $2, true)`,
              [grade.id, newId]
            );
          }
        }
        
        console.log(`    ✅ Created ${templates.rows.length} modules`);
      } else {
        console.log(`  Grade ${grade.level}: ✅ ${count} modules`);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Setup complete!');
  console.log('\nNext steps:');
  console.log('  1. Run: node scripts/test-enrollment.js');
  console.log('  2. Test learner registration for each grade');
  
  process.exit(0);
}

setupSchoolModules().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
