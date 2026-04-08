const db = require('./src/config/database');

async function checkDB() {
  console.log('Checking database connection...\n');
  
  try {
    // Test simple query
    const result = await db.query('SELECT NOW() as time');
    console.log('✅ Database connected');
    console.log('Server time:', result.rows[0].time);
    
    // Check connection pool settings
    console.log('\nConnection pool info:');
    console.log('Total clients:', db.pool.totalCount);
    console.log('Idle clients:', db.pool.idleCount);
    console.log('Waiting clients:', db.pool.waitingCount);
    
    // Try subjects query for KHS
    const khs = await db.query("SELECT id FROM schools WHERE code = 'KHS'");
    if (khs.rows.length > 0) {
      const subjects = await db.query(
        'SELECT COUNT(*) as count FROM subjects WHERE school_id = $1',
        [khs.rows[0].id]
      );
      console.log(`\nKHS subjects: ${subjects.rows[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
  
  process.exit(0);
}

checkDB();
