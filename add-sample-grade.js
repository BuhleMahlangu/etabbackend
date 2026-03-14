const db = require('./src/config/database');

async function addSampleGrade() {
  const learnerId = '9486d2c3-994c-4ccb-9f23-3b99095ba621';
  
  // Get the assignment
  const assignmentRes = await db.query(`
    SELECT id, max_marks FROM assignments WHERE title = 'fn.kadnifudabf'
  `);
  const assignment = assignmentRes.rows[0];
  
  console.log('Assignment ID:', assignment.id);
  console.log('Max Marks:', assignment.max_marks);
  
  // Check if already submitted
  const existingRes = await db.query(`
    SELECT id FROM assignment_submissions 
    WHERE assignment_id = $1 AND learner_id = $2
  `, [assignment.id, learnerId]);
  
  if (existingRes.rows.length > 0) {
    console.log('Already has submission, updating grade...');
    await db.query(`
      UPDATE assignment_submissions 
      SET marks_obtained = $1, 
          status = 'graded',
          feedback = 'Good work! Keep it up.',
          graded_at = NOW(),
          graded_by = (SELECT id FROM users WHERE role = 'teacher' LIMIT 1)
      WHERE assignment_id = $2 AND learner_id = $3
    `, [Math.round(assignment.max_marks * 0.75), assignment.id, learnerId]);
  } else {
    console.log('Creating new submission with grade...');
    await db.query(`
      INSERT INTO assignment_submissions 
        (assignment_id, learner_id, submission_text, status, marks_obtained, feedback, graded_at, graded_by, submitted_at)
      VALUES ($1, $2, 'Sample submission text', 'graded', $3, 'Good work! Keep it up.', NOW(), 
        (SELECT id FROM users WHERE role = 'teacher' LIMIT 1), NOW())
    `, [assignment.id, learnerId, Math.round(assignment.max_marks * 0.75)]);
  }
  
  console.log('✅ Added sample grade: 75%');
  
  // Verify
  const verifyRes = await db.query(`
    SELECT s.*, a.title, a.max_marks
    FROM assignment_submissions s
    JOIN assignments a ON s.assignment_id = a.id
    WHERE s.learner_id = $1
  `, [learnerId]);
  
  console.log('\nSubmissions:');
  verifyRes.rows.forEach(s => {
    console.log('  -', s.title, '| Marks:', s.marks_obtained + '/' + s.max_marks, '| Status:', s.status);
  });
  
  process.exit(0);
}

addSampleGrade();
