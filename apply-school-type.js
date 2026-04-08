const fs = require('fs');
const db = require('./src/config/database');

async function run() {
  try {
    const sql = fs.readFileSync('add-school-type.sql', 'utf8');
    await db.query(sql);
    console.log('✅ School type column added successfully');
    
    // Verify
    const result = await db.query('SELECT code, name, school_type FROM schools');
    console.log('\nSchools:');
    result.rows.forEach(s => {
      console.log(`  ${s.code}: ${s.name} (${s.school_type})`);
    });
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}

run();
