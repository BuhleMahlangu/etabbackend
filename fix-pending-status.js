const db = require('./src/config/database');

async function fix() {
  try {
    // Update the pending teacher status
    await db.query(`
      UPDATE pending_teachers 
      SET status = 'approved', 
          reviewed_at = NOW(), 
          reviewed_by = 'f93f695f-b0f8-4fad-bb8e-518eb4016800'
      WHERE id = '6a0ae4c6-67df-4f68-a39c-85005a0c24e4'
    `);
    console.log('Updated pending teacher status to approved');
    
    // Verify the user was created
    const user = await db.query(
      "SELECT id, email, role, school_id FROM users WHERE email = 'newteacher@demo.com'"
    );
    console.log('Created user:', user.rows[0]);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

fix();
