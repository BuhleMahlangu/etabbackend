const db = require('./src/config/database');

async function check() {
  try {
    // Check all subjects
    const subjects = await db.query(`
      SELECT code, name, school_code 
      FROM subjects 
      WHERE school_code = 'KHS'
      ORDER BY phase, code
    `);
    
    console.log('KHS Subjects:', subjects.rows.length);
    console.log('\nChecking for proper KHS- prefix:');
    
    let withPrefix = 0;
    let withoutPrefix = 0;
    
    subjects.rows.forEach(s => {
      if (s.code.startsWith('KHS-')) {
        withPrefix++;
      } else {
        withoutPrefix++;
        console.log(`  ❌ Missing prefix: ${s.code} - ${s.name}`);
      }
    });
    
    console.log(`\n✅ With KHS- prefix: ${withPrefix}`);
    console.log(`❌ Without prefix: ${withoutPrefix}`);
    
    // Check modules
    const modules = await db.query(`
      SELECT code, name, school_code 
      FROM modules 
      WHERE school_code = 'KHS'
      ORDER BY code
    `);
    
    console.log('\nKHS Modules:', modules.rows.length);
    
    let modWithPrefix = 0;
    let modWithoutPrefix = 0;
    
    modules.rows.forEach(m => {
      if (m.code.startsWith('KHS-')) {
        modWithPrefix++;
      } else {
        modWithoutPrefix++;
        console.log(`  ❌ Missing prefix: ${m.code} - ${m.name}`);
      }
    });
    
    console.log(`\n✅ With KHS- prefix: ${modWithPrefix}`);
    console.log(`❌ Without prefix: ${modWithoutPrefix}`);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
