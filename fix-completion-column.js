const db = require('./src/config/database');

async function fixColumn() {
  try {
    // Check if column exists
    const checkRes = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'learner_modules' AND column_name = 'completion_percentage'
    `);
    
    if (checkRes.rows.length === 0) {
      console.log('Adding completion_percentage column...');
      await db.query(`
        ALTER TABLE learner_modules 
        ADD COLUMN completion_percentage INTEGER DEFAULT 0
      `);
      console.log('✅ Column added');
    } else {
      console.log('✅ Column already exists');
    }
    
    // Verify
    const colsRes = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'learner_modules'
    `);
    console.log('\nlearner_modules columns:');
    colsRes.rows.forEach(c => console.log('  -', c.column_name));
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

fixColumn();
