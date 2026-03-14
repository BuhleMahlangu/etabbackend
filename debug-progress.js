const db = require('./src/config/database');

async function checkData() {
  console.log('=== Debugging Progress Data ===\n');
  
  try {
    // Get a test learner
    const learnerRes = await db.query("SELECT id, email, first_name FROM users WHERE role = 'learner' LIMIT 1");
    if (learnerRes.rows.length === 0) {
      console.log('❌ No learners found');
      return;
    }
    const learner = learnerRes.rows[0];
    console.log('Learner:', learner.email, '(ID:', learner.id + ')\n');
    
    // 1. Check learner modules
    console.log('1. Learner Modules (enrollments):');
    const modules = await db.query(
      `SELECT lm.*, m.name as module_name, m.code 
       FROM learner_modules lm
       JOIN modules m ON lm.module_id = m.id
       WHERE lm.learner_id = $1 AND lm.status = 'active'`,
      [learner.id]
    );
    console.log('   Found:', modules.rows.length, 'enrollments');
    modules.rows.forEach(m => console.log('   -', m.module_name, '(Grade ID:', m.grade_id + ')'));
    
    // 2. Check assignments
    console.log('\n2. Published Assignments:');
    const assignments = await db.query(
      `SELECT a.*, m.name as subject_name
       FROM assignments a
       JOIN modules m ON a.subject_id = m.id
       WHERE a.is_published = true AND a.status = 'published'
       LIMIT 5`
    );
    console.log('   Total published:', assignments.rows.length);
    assignments.rows.forEach(a => {
      console.log('   -', a.title, '| Subject:', a.subject_name);
      console.log('     Grade IDs:', a.applicable_grade_ids);
    });
    
    // 3. Check submissions
    console.log('\n3. Assignment Submissions:');
    const submissions = await db.query(
      `SELECT s.*, a.title as assignment_title, a.max_marks
       FROM assignment_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       WHERE s.learner_id = $1`,
      [learner.id]
    );
    console.log('   Submissions by learner:', submissions.rows.length);
    submissions.rows.forEach(s => {
      console.log('   -', s.assignment_title, '| Status:', s.status, '| Marks:', s.marks_obtained + '/' + s.max_marks);
    });
    
    // 4. Check quizzes
    console.log('\n4. Published Quizzes:');
    const quizzes = await db.query(
      `SELECT q.*, m.name as subject_name
       FROM quizzes q
       JOIN modules m ON q.subject_id = m.id
       WHERE q.is_published = true
       LIMIT 5`
    );
    console.log('   Total published:', quizzes.rows.length);
    quizzes.rows.forEach(q => {
      console.log('   -', q.title, '| Subject:', q.subject_name);
      console.log('     Grade IDs:', q.applicable_grade_ids);
    });
    
    // 5. Check quiz attempts
    console.log('\n5. Quiz Attempts:');
    const attempts = await db.query(
      `SELECT qa.*, q.title as quiz_title
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.learner_id = $1`,
      [learner.id]
    );
    console.log('   Quiz attempts by learner:', attempts.rows.length);
    attempts.rows.forEach(a => {
      console.log('   -', a.quiz_title, '| Score:', a.score + '/' + a.total_marks, '| %:', a.percentage);
    });
    
    // 6. Test the actual progress query
    console.log('\n6. Testing Progress Query...');
    const progressResult = await db.query(
      `SELECT 
        m.id as module_id,
        m.name as module_name,
        COUNT(DISTINCT a.id) as total_assignments,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN a.id END) as submitted_count
       FROM learner_modules lm
       JOIN modules m ON lm.module_id = m.id
       LEFT JOIN assignments a ON a.subject_id = m.id AND a.is_published = true
       LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.learner_id = lm.learner_id
       WHERE lm.learner_id = $1 AND lm.status = 'active'
       GROUP BY m.id, m.name`,
      [learner.id]
    );
    console.log('   Progress query result:', progressResult.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  process.exit(0);
}

checkData();
