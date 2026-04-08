const db = require('./src/config/database');

async function check() {
  try {
    // Check subjects table columns
    const columns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'subjects'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in subjects table:');
    columns.rows.forEach(r => {
      console.log(`  - ${r.column_name}: ${r.data_type}`);
    });
    
    // Check if school_id exists
    const hasSchoolId = columns.rows.some(r => r.column_name === 'school_id');
    const hasSchoolCode = columns.rows.some(r => r.column_name === 'school_code');
    
    console.log('\nMulti-tenancy support:');
    console.log(`  - school_id column: ${hasSchoolId ? '✅' : '❌'}`);
    console.log(`  - school_code column: ${hasSchoolCode ? '✅' : '❌'}`);
    
    // Show sample subjects
    const subjects = await db.query('SELECT * FROM subjects LIMIT 5');
    console.log('\nSample subjects:');
    subjects.rows.forEach(s => {
      console.log(`  - ${s.name} (${s.code})`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
