const db = require('./src/config/database');

async function checkMatch() {
  // Check the assignment's subject_id
  const assignmentRes = await db.query(`
    SELECT a.*, m.name as subject_name, m.id as module_id
    FROM assignments a
    JOIN modules m ON a.subject_id = m.id
    WHERE a.title = 'fn.kadnifudabf'
  `);
  
  console.log('Assignment:');
  console.log('  Subject Name:', assignmentRes.rows[0].subject_name);
  console.log('  Subject ID:', assignmentRes.rows[0].subject_id);
  console.log('  Module ID:', assignmentRes.rows[0].module_id);
  
  // Check learner enrollments
  const learnerRes = await db.query(`
    SELECT lm.*, m.name as module_name
    FROM learner_modules lm
    JOIN modules m ON lm.module_id = m.id
    WHERE lm.learner_id = '9486d2c3-994c-4ccb-9f23-3b99095ba621'
  `);
  
  console.log('\nLearner Enrollments:');
  learnerRes.rows.forEach(e => {
    console.log('  -', e.module_name, '| ID:', e.module_id);
  });
  
  // Check if they match
  const assignmentSubjectId = assignmentRes.rows[0].subject_id;
  const enrolledSubjectIds = learnerRes.rows.map(e => e.module_id);
  
  console.log('\nMatch check:');
  console.log('  Assignment subject in enrolled?', enrolledSubjectIds.includes(assignmentSubjectId));
  
  process.exit(0);
}

checkMatch();
