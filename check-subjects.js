const db = require('./src/config/database');

async function check() {
  try {
    // Get user's school
    const userResult = await db.query(
      "SELECT school_id FROM users WHERE email = 'tomjiyane@gmail.com'"
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found');
      process.exit(1);
    }
    
    const schoolId = userResult.rows[0].school_id;
    console.log('School ID:', schoolId);
    
    // Get all subjects for this school
    const subjectsResult = await db.query(
      `SELECT id, code, name, phase, department, is_active 
       FROM subjects 
       WHERE school_id = $1 
       ORDER BY phase, name`,
      [schoolId]
    );
    
    console.log(`\nFound ${subjectsResult.rows.length} subjects:`);
    
    // Group by phase
    const byPhase = {};
    subjectsResult.rows.forEach(s => {
      if (!byPhase[s.phase]) byPhase[s.phase] = [];
      byPhase[s.phase].push(`${s.code}: ${s.name} (${s.is_active ? 'active' : 'inactive'})`);
    });
    
    Object.entries(byPhase).forEach(([phase, subjects]) => {
      console.log(`\n${phase} (${subjects.length}):`);
      subjects.forEach(s => console.log(`  - ${s}`));
    });
    
    // Check for optional/compulsory distinction
    console.log('\n\nChecking grade_modules for is_compulsory flag...');
    const gmResult = await db.query(
      `SELECT m.code, m.name, gm.is_compulsory
       FROM modules m
       JOIN grade_modules gm ON m.id = gm.module_id
       WHERE m.school_id = $1
       LIMIT 20`,
      [schoolId]
    );
    
    console.log(`Found ${gmResult.rows.length} grade_modules entries`);
    gmResult.rows.forEach(r => {
      console.log(`  - ${r.code}: ${r.name} (${r.is_compulsory ? 'compulsory' : 'optional'})`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
