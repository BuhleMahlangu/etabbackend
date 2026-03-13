require('dotenv').config();
const db = require('./src/config/database');

async function checkSubjectSelection() {
  try {
    console.log('=== Checking Subject Selection Tables ===\n');
    
    // Check if subject_selection table exists
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%selection%'
    `);
    
    console.log('Tables with "selection":', tables.rows.map(t => t.table_name));
    
    // Check subjectselection (if exists)
    try {
      const cols = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'subjectselection'
      `);
      console.log('\nsubjectselection columns:', cols.rows.map(c => c.column_name));
    } catch(e) {
      console.log('\nsubjectselection table not found');
    }
    
    // Check grade_progression
    try {
      const gp = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'grade_progression'
      `);
      console.log('\ngrade_progression columns:', gp.rows.map(c => c.column_name));
    } catch(e) {
      console.log('\ngrade_progression table not found');
    }
    
    // Sample enrollment history for a learner
    const learner = await db.query("SELECT id, email FROM users WHERE role = 'learner' LIMIT 1");
    if (learner.rows.length > 0) {
      const history = await db.query(`
        SELECT e.*, s.name as subject_name
        FROM enrollments e
        JOIN subjects s ON e.subject_id = s.id
        WHERE e.learner_id = $1
        ORDER BY e.academic_year DESC, s.name
      `, [learner.rows[0].id]);
      
      console.log(`\nEnrollment history for ${learner.rows[0].email}:`);
      history.rows.forEach(h => {
        console.log(`  ${h.academic_year} | ${h.grade} | ${h.subject_name} | ${h.status}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkSubjectSelection();
