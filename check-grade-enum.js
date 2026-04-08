const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(`
      SELECT unnest(enum_range(NULL::grade_level)) as grade
    `);
    console.log('Grade enum values:', result.rows.map(r => r.grade));
    
    // Check applicable_grades format
    const subjects = await db.query(`
      SELECT name, applicable_grades FROM subjects LIMIT 3
    `);
    console.log('\nSample applicable_grades:');
    subjects.rows.forEach(s => {
      console.log(`  - ${s.name}: ${JSON.stringify(s.applicable_grades)}`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
