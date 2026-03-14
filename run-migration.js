// Run database migration to add missing column
const db = require('./src/config/database');

async function runMigration() {
  try {
    console.log('Checking notifications table...');
    
    // Check if column exists
    const checkResult = await db.query(`
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'notifications' 
      AND column_name = 'related_id'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('Adding related_id column to notifications table...');
      await db.query('ALTER TABLE notifications ADD COLUMN related_id UUID');
      console.log('✅ Column added successfully!');
    } else {
      console.log('✅ related_id column already exists');
    }
    
    // Verify structure
    const columns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notifications' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Current notifications table structure:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
