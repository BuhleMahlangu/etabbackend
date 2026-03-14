const db = require('../config/database');

// ============================================
// GET LEARNER UPCOMING DEADLINES
// Combines assignments and quizzes with due dates
// ============================================
const getLearnerDeadlines = async (req, res) => {
  try {
    const learnerId = req.user.userId;
    
    // Get learner's enrolled subjects and grade
    const enrollmentResult = await db.query(
      `SELECT module_id, grade_id FROM learner_modules 
       WHERE learner_id = $1 AND status = 'active'`,
      [learnerId]
    );
    
    const subjectIds = enrollmentResult.rows.map(r => r.module_id);
    const gradeId = enrollmentResult.rows[0]?.grade_id;
    
    if (subjectIds.length === 0) {
      return res.json({
        success: true,
        data: {
          assignments: [],
          quizzes: [],
          allDeadlines: []
        }
      });
    }
    
    // Get upcoming assignments
    const assignmentsQuery = `
      SELECT 
        a.id,
        a.title,
        a.description,
        a.due_date,
        a.max_marks,
        a.subject_id,
        m.name as subject_name,
        m.code as subject_code,
        s.id as submission_id,
        s.status as submission_status,
        s.submitted_at,
        CASE 
          WHEN s.id IS NOT NULL THEN 'submitted'
          WHEN a.due_date < NOW() THEN 'overdue'
          WHEN a.due_date < NOW() + INTERVAL '24 hours' THEN 'due-soon'
          ELSE 'upcoming'
        END as urgency_status,
        EXTRACT(EPOCH FROM (a.due_date - NOW())) / 3600 as hours_remaining
      FROM assignments a
      JOIN modules m ON a.subject_id = m.id
      LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.learner_id = $1
      WHERE a.is_published = true 
        AND a.status = 'published'
        AND a.due_date >= NOW() - INTERVAL '7 days'
        AND a.subject_id = ANY($2)
        AND ($3 = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
      ORDER BY a.due_date ASC
    `;
    
    const assignmentsResult = await db.query(assignmentsQuery, [learnerId, subjectIds, gradeId]);
    
    // Get upcoming quizzes
    const quizzesQuery = `
      SELECT 
        q.id,
        q.title,
        q.description,
        q.available_until as due_date,
        q.total_marks,
        q.time_limit_minutes,
        q.subject_id,
        m.name as subject_name,
        m.code as subject_code,
        qa.id as attempt_id,
        qa.status as attempt_status,
        CASE 
          WHEN qa.id IS NOT NULL AND qa.status = 'completed' THEN 'completed'
          WHEN q.available_until < NOW() THEN 'expired'
          WHEN q.available_until < NOW() + INTERVAL '24 hours' THEN 'due-soon'
          ELSE 'upcoming'
        END as urgency_status,
        EXTRACT(EPOCH FROM (q.available_until - NOW())) / 3600 as hours_remaining
      FROM quizzes q
      JOIN modules m ON q.subject_id = m.id
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.learner_id = $1
      WHERE q.is_published = true
        AND q.available_from <= NOW()
        AND q.available_until >= NOW() - INTERVAL '7 days'
        AND q.subject_id = ANY($2)
        AND ($3 = ANY(q.applicable_grade_ids) OR q.applicable_grade_ids = '{}')
      ORDER BY q.available_until ASC
    `;
    
    const quizzesResult = await db.query(quizzesQuery, [learnerId, subjectIds, gradeId]);
    
    // Format assignments
    const assignments = assignmentsResult.rows.map(a => ({
      id: a.id,
      type: 'assignment',
      title: a.title,
      description: a.description,
      dueDate: a.due_date,
      subjectName: a.subject_name,
      subjectCode: a.subject_code,
      maxMarks: parseFloat(a.max_marks),
      status: a.submission_id ? 'completed' : a.urgency_status,
      hoursRemaining: Math.round(a.hours_remaining),
      isSubmitted: !!a.submission_id,
      submittedAt: a.submitted_at
    }));
    
    // Format quizzes
    const quizzes = quizzesResult.rows.map(q => ({
      id: q.id,
      type: 'quiz',
      title: q.title,
      description: q.description,
      dueDate: q.due_date,
      subjectName: q.subject_name,
      subjectCode: q.subject_code,
      maxMarks: parseFloat(q.total_marks),
      timeLimit: q.time_limit_minutes,
      status: q.urgency_status,
      hoursRemaining: Math.round(q.hours_remaining),
      isCompleted: q.attempt_status === 'completed'
    }));
    
    // Combine and sort by due date
    const allDeadlines = [...assignments, ...quizzes]
      .filter(d => d.status !== 'completed')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    // Get counts by status
    const counts = {
      overdue: allDeadlines.filter(d => d.status === 'overdue').length,
      dueSoon: allDeadlines.filter(d => d.status === 'due-soon').length,
      upcoming: allDeadlines.filter(d => d.status === 'upcoming').length,
      total: allDeadlines.length
    };
    
    res.json({
      success: true,
      data: {
        assignments,
        quizzes,
        allDeadlines,
        counts
      }
    });
    
  } catch (error) {
    console.error('Get learner deadlines error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get deadlines: ' + error.message 
    });
  }
};

module.exports = {
  getLearnerDeadlines
};
