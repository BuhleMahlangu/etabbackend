const db = require('./src/config/database');

async function checkTable() {
  try {
    // Check columns
    const cols = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'notifications'
    `);
    console.log('Notifications table columns:');
    cols.rows.forEach(c => console.log('  -', c.column_name));
    
    // Check if read_at exists
    const hasReadAt = cols.rows.some(c => c.column_name === 'read_at');
    
    if (!hasReadAt) {
      console.log('\n❌ read_at column missing, adding it...');
      await db.query('ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP');
      console.log('✅ read_at column added');
    } else {
      console.log('\n✅ read_at column exists');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

checkTable();
