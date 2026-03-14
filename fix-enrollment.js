const db = require('./src/config/database');

async function fixEnrollment() {
  try {
    // Get the learner
    const learnerRes = await db.query("SELECT id, grade_id FROM users WHERE role = 'learner' LIMIT 1");
    const learner = learnerRes.rows[0];
    console.log('Learner ID:', learner.id);
    console.log('Learner Grade ID:', learner.grade_id);
    
    // Get available modules
    const modulesRes = await db.query('SELECT id, name, code FROM modules LIMIT 3');
    console.log('\nAvailable modules:', modulesRes.rows);
    
    // Enroll learner in modules
    for (const module of modulesRes.rows) {
      await db.query(
        `INSERT INTO learner_modules (learner_id, module_id, grade_id, status) 
         VALUES ($1, $2, $3, 'active') 
         ON CONFLICT (learner_id, module_id) DO NOTHING`,
        [learner.id, module.id, learner.grade_id]
      );
      console.log('Enrolled in:', module.name);
    }
    
    // Verify
    const enrolledRes = await db.query(
      `SELECT lm.*, m.name as module_name 
       FROM learner_modules lm
       JOIN modules m ON lm.module_id = m.id
       WHERE lm.learner_id = $1`,
      [learner.id]
    );
    console.log('\n✅ Total enrollments now:', enrolledRes.rows.length);
    enrolledRes.rows.forEach(e => console.log('  -', e.module_name));
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  process.exit(0);
}

fixEnrollment();
