const db = require('./src/config/database');

async function testQuery() {
  try {
    // Get a learner
    const learnerRes = await db.query("SELECT id, grade_id FROM users WHERE role = 'learner' LIMIT 1");
    const learnerId = learnerRes.rows[0].id;
    const gradeId = learnerRes.rows[0].grade_id;
    
    console.log('Testing for learner:', learnerId);
    console.log('Grade ID:', gradeId);
    
    // Get enrolled subjects
    const enrollmentRes = await db.query(
      'SELECT module_id, grade_id FROM learner_modules WHERE learner_id = $1 AND status = $2',
      [learnerId, 'active']
    );
    const subjectIds = enrollmentRes.rows.map(r => r.module_id);
    console.log('Enrolled subjects:', subjectIds);
    
    // Test the assignments query
    if (subjectIds.length > 0) {
      const assignmentsQuery = `
        SELECT 
          a.subject_id,
          COUNT(DISTINCT a.id) as total_assignments,
          COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN a.id END) as submitted_count,
          COUNT(DISTINCT CASE WHEN s.status = 'graded' THEN a.id END) as graded_count,
          COALESCE(SUM(CASE WHEN s.status = 'graded' THEN s.marks_obtained ELSE 0 END), 0) as total_marks_obtained,
          COALESCE(SUM(CASE WHEN s.status = 'graded' THEN a.max_marks ELSE 0 END), 0) as total_max_marks
        FROM assignments a
        LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.learner_id = $1
        WHERE a.is_published = true AND a.status = 'published'
        AND a.subject_id = ANY($2)
        GROUP BY a.subject_id
      `;
      const assignmentsResult = await db.query(assignmentsQuery, [learnerId, subjectIds]);
      console.log('\n✅ Assignments Result:', assignmentsResult.rows);
    } else {
      console.log('\n❌ No enrolled subjects');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testQuery();
