const db = require('./src/config/database');

async function debug() {
  try {
    const pendingId = '6a0ae4c6-67df-4f68-a39c-85005a0c24e4';
    const schoolId = 'd796848c-0db2-4ba7-bc24-9bc3778fc4ea';
    
    // Check pending teacher
    const pending = await db.query(
      "SELECT * FROM pending_teachers WHERE id = $1 AND status = 'pending'",
      [pendingId]
    );
    console.log('Pending teacher:', pending.rows);
    
    // Check if school matches
    if (pending.rows.length > 0) {
      console.log('Teacher school_id:', pending.rows[0].school_id);
      console.log('Admin school_id:', schoolId);
      console.log('Match:', pending.rows[0].school_id === schoolId);
    }
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

debug();
