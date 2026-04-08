const db = require('./src/config/database');

async function check() {
  try {
    // Check if users have school_code column
    const columns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'school_code'
    `);
    
    if (columns.rows.length === 0) {
      console.log('❌ school_code column does NOT exist in users table');
    } else {
      console.log('✅ school_code column exists');
    }
    
    // Show sample learners with their school info
    const learners = await db.query(`
      SELECT u.id, u.email, u.first_name, u.school_id, s.code as school_code, s.name as school_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.role = 'learner'
      LIMIT 5
    `);
    
    console.log('\nSample learners:');
    learners.rows.forEach(l => {
      console.log(`  - ${l.first_name} (${l.email})`);
      console.log(`    School: ${l.school_name} (${l.school_code})`);
      console.log(`    School ID: ${l.school_id}`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
