const db = require('./src/config/database');

async function addColumn() {
  try {
    // Add school_code column to users table
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS school_code VARCHAR(20)
    `);
    console.log('✅ Added school_code column to users table');
    
    // Add school_code to pending_teachers table too
    await db.query(`
      ALTER TABLE pending_teachers 
      ADD COLUMN IF NOT EXISTS school_code VARCHAR(20)
    `);
    console.log('✅ Added school_code column to pending_teachers table');
    
    // Update existing users with their school codes
    await db.query(`
      UPDATE users u
      SET school_code = s.code
      FROM schools s
      WHERE u.school_id = s.id
      AND u.school_code IS NULL
    `);
    console.log('✅ Updated existing users with school codes');
    
    // Update existing pending teachers
    await db.query(`
      UPDATE pending_teachers pt
      SET school_code = s.code
      FROM schools s
      WHERE pt.school_id = s.id
      AND pt.school_code IS NULL
    `);
    console.log('✅ Updated existing pending teachers with school codes');
    
    // Verify
    const result = await db.query(`
      SELECT u.email, u.first_name, u.school_code, s.name as school_name
      FROM users u
      JOIN schools s ON u.school_id = s.id
      WHERE u.role = 'learner'
      LIMIT 3
    `);
    
    console.log('\nSample learners with school codes:');
    result.rows.forEach(r => {
      console.log(`  - ${r.first_name}: ${r.school_code} (${r.school_name})`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

addColumn();
