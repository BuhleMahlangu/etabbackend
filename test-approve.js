const db = require('./src/config/database');

async function testApprove() {
  const client = await db.pool.connect();
  
  try {
    const pendingId = '6a0ae4c6-67df-4f68-a39c-85005a0c24e4';
    const adminUserId = 'f93f695f-b0f8-4fad-bb8e-518eb4016800';
    
    await client.query('BEGIN');

    // Get pending teacher
    const pendingResult = await client.query(
      "SELECT * FROM pending_teachers WHERE id = $1 AND status = 'pending'",
      [pendingId]
    );

    if (pendingResult.rows.length === 0) {
      console.log('Teacher not found or already processed');
      await client.query('ROLLBACK');
      return;
    }

    const pending = pendingResult.rows[0];
    console.log('Found pending teacher:', pending.email);
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [pending.email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('User already exists with this email!');
      await client.query('ROLLBACK');
      return;
    }

    // Create user account
    console.log('Creating user account...');
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, is_active)
       VALUES ($1, $2, $3, $4, 'teacher', $5, true) RETURNING *`,
      [pending.email, pending.password_hash, pending.first_name, pending.last_name, pending.school_id]
    );
    console.log('User created:', userResult.rows[0].id);

    // Update pending status
    await client.query(
      `UPDATE pending_teachers SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1 WHERE id = $2`,
      [adminUserId, pendingId]
    );
    console.log('Pending status updated');

    await client.query('COMMIT');
    console.log('Teacher approved successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    process.exit(0);
  }
}

testApprove();
