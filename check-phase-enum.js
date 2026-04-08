const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(`
      SELECT unnest(enum_range(NULL::school_phase)) as phase
    `);
    console.log('Phase enum values:', result.rows.map(r => r.phase));
    
    // Check some existing subjects
    const subjects = await db.query(`
      SELECT name, phase FROM subjects LIMIT 5
    `);
    console.log('\nSample subjects with phases:');
    subjects.rows.forEach(s => {
      console.log(`  - ${s.name}: ${s.phase}`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
