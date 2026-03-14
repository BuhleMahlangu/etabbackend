const db = require('./src/config/database');

async function fixEnrollment() {
  const learnerId = '9486d2c3-994c-4ccb-9f23-3b99095ba621';
  const gradeId = 'e6127953-4597-49d8-9c04-3fb795ecc977';
  
  // Get the subject ID that has the assignment
  const assignmentRes = await db.query(`
    SELECT subject_id FROM assignments WHERE title = 'fn.kadnifudabf'
  `);
  const subjectWithAssignment = assignmentRes.rows[0]?.subject_id;
  
  console.log('Subject with assignment:', subjectWithAssignment);
  
  // Enroll learner in that subject
  if (subjectWithAssignment) {
    await db.query(
      `INSERT INTO learner_modules (learner_id, module_id, grade_id, status) 
       VALUES ($1, $2, $3, 'active') 
       ON CONFLICT (learner_id, module_id) DO NOTHING`,
      [learnerId, subjectWithAssignment, gradeId]
    );
    console.log('✅ Enrolled in subject with assignment');
  }
  
  // Verify all enrollments
  const enrolledRes = await db.query(
    `SELECT lm.*, m.name as module_name 
     FROM learner_modules lm
     JOIN modules m ON lm.module_id = m.id
     WHERE lm.learner_id = $1`,
    [learnerId]
  );
  
  console.log('\nCurrent enrollments:', enrolledRes.rows.length);
  enrolledRes.rows.forEach(e => console.log('  -', e.module_name));
  
  // Test the progress query again
  const subjectIds = enrolledRes.rows.map(r => r.module_id);
  const assignmentsQuery = `
    SELECT 
      a.subject_id,
      COUNT(DISTINCT a.id) as total_assignments,
      COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN a.id END) as submitted_count
    FROM assignments a
    LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.learner_id = $1
    WHERE a.is_published = true AND a.status = 'published'
    AND a.subject_id = ANY($2)
    GROUP BY a.subject_id
  `;
  const result = await db.query(assignmentsQuery, [learnerId, subjectIds]);
  console.log('\n✅ Assignments now found:', result.rows);
  
  process.exit(0);
}

fixEnrollment();
