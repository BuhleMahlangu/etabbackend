const db = require('./src/config/database');

async function test() {
  try {
    // Check if test learner already exists
    const existing = await db.query("SELECT id FROM users WHERE email = 'testlearner@demo.com'");
    if (existing.rows.length > 0) {
      console.log('Test learner already exists:', existing.rows[0].id);
    } else {
      console.log('Test learner not found - would be created through API');
    }
    
    // Count learners for Demo School
    const demoSchoolId = 'd796848c-0db2-4ba7-bc24-9bc3778fc4ea';
    const learners = await db.query(
      "SELECT COUNT(*) FROM users WHERE role = 'learner' AND school_id = $1",
      [demoSchoolId]
    );
    console.log('Demo School learners:', learners.rows[0].count);
    
    // Count pending teachers for Demo School
    const pending = await db.query(
      "SELECT COUNT(*) FROM pending_teachers WHERE school_id = $1 AND status = 'pending'",
      [demoSchoolId]
    );
    console.log('Demo School pending teachers:', pending.rows[0].count);
    
    // Show sample of learners with school
    const sample = await db.query(
      "SELECT email, first_name, school_id FROM users WHERE role = 'learner' LIMIT 3"
    );
    console.log('Sample learners:', sample.rows);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

test();
