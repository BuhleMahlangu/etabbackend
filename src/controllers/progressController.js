const db = require('../config/database');

// ============================================
// GET LEARNER PROGRESS OVERVIEW
// ============================================
const getLearnerProgress = async (req, res) => {
  try {
    const learnerId = req.user.userId;

    // Get learner's enrolled modules with progress
    const modulesQuery = `
      SELECT 
        m.id as module_id,
        m.name as module_name,
        m.code as module_code,
        lm.enrolled_at,
        lm.completion_percentage,
        lm.status as enrollment_status
      FROM learner_modules lm
      JOIN modules m ON lm.module_id = m.id
      WHERE lm.learner_id = $1 AND lm.status = 'active'
    `;
    const modulesResult = await db.query(modulesQuery, [learnerId]);

    // Get learner's enrolled subject IDs and grade
    const enrollmentResult = await db.query(
      'SELECT module_id, grade_id FROM learner_modules WHERE learner_id = $1 AND status = $2',
      [learnerId, 'active']
    );
    const subjectIds = enrollmentResult.rows.map(r => r.module_id);
    const userGradeId = enrollmentResult.rows[0]?.grade_id;
    
    console.log('[Progress] Learner:', learnerId);
    console.log('[Progress] Enrolled subjects:', subjectIds);
    console.log('[Progress] Grade ID:', userGradeId);

    // Get all assignments progress per subject (for enrolled subjects only, grade filter removed for debugging)
    let assignmentsResult = { rows: [] };
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
      assignmentsResult = await db.query(assignmentsQuery, [learnerId, subjectIds]);
      console.log('[Progress] Assignments found:', assignmentsResult.rows);
    }

    // Get quiz progress per subject (for enrolled subjects only)
    let quizzesResult = { rows: [] };
    if (subjectIds.length > 0) {
      const quizzesQuery = `
        SELECT 
          q.subject_id,
          COUNT(DISTINCT q.id) as total_quizzes,
          COUNT(DISTINCT CASE WHEN qa.id IS NOT NULL THEN q.id END) as attempted_count,
          COUNT(DISTINCT CASE WHEN qa.status IN ('submitted', 'auto_submitted', 'graded', 'completed') THEN q.id END) as completed_count,
          COALESCE(AVG(CASE WHEN qa.status IN ('submitted', 'auto_submitted', 'graded', 'completed') THEN qa.percentage_score END), 0) as average_percentage,
          COALESCE(SUM(CASE WHEN qa.passed = true THEN 1 ELSE 0 END), 0) as passed_count
        FROM quizzes q
        LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.learner_id = $1
        WHERE q.is_published = true
        AND q.subject_id = ANY($2)
        GROUP BY q.subject_id
      `;
      quizzesResult = await db.query(quizzesQuery, [learnerId, subjectIds]);
      console.log('[Progress] Quizzes found:', quizzesResult.rows);
    }

    // Calculate overall statistics
    const overallStats = {
      totalSubjects: modulesResult.rows.length,
      totalAssignments: 0,
      submittedAssignments: 0,
      gradedAssignments: 0,
      assignmentAverage: 0,
      totalQuizzes: 0,
      completedQuizzes: 0,
      quizAverage: 0,
      overallGrade: 'N/A',
      overallPercentage: 0
    };

    // Build subject-wise progress
    const subjectProgress = modulesResult.rows.map(module => {
      const assignmentData = assignmentsResult.rows.find(a => a.subject_id === module.module_id) || {
        total_assignments: 0,
        submitted_count: 0,
        graded_count: 0,
        total_marks_obtained: 0,
        total_max_marks: 0
      };

      const quizData = quizzesResult.rows.find(q => q.subject_id === module.module_id) || {
        total_quizzes: 0,
        attempted_count: 0,
        completed_count: 0,
        average_percentage: 0,
        passed_count: 0
      };

      // Calculate assignment percentage
      const assignmentPercentage = assignmentData.total_max_marks > 0
        ? (assignmentData.total_marks_obtained / assignmentData.total_max_marks) * 100
        : 0;

      // Calculate quiz percentage
      const quizPercentage = parseFloat(quizData.average_percentage) || 0;

      // Calculate subject overall (50% assignments, 50% quizzes)
      const subjectOverall = quizData.total_quizzes > 0 && assignmentData.total_assignments > 0
        ? (assignmentPercentage * 0.5) + (quizPercentage * 0.5)
        : (quizData.total_quizzes > 0 ? quizPercentage : assignmentPercentage);

      // Update overall stats
      overallStats.totalAssignments += parseInt(assignmentData.total_assignments);
      overallStats.submittedAssignments += parseInt(assignmentData.submitted_count);
      overallStats.gradedAssignments += parseInt(assignmentData.graded_count);
      overallStats.totalQuizzes += parseInt(quizData.total_quizzes);
      overallStats.completedQuizzes += parseInt(quizData.completed_count);

      return {
        subjectId: module.module_id,
        subjectName: module.module_name,
        subjectCode: module.module_code,
        enrollmentDate: module.enrolled_at,
        completionPercentage: module.completion_percentage,
        assignments: {
          total: parseInt(assignmentData.total_assignments),
          submitted: parseInt(assignmentData.submitted_count),
          graded: parseInt(assignmentData.graded_count),
          marksObtained: parseFloat(assignmentData.total_marks_obtained),
          maxMarks: parseFloat(assignmentData.total_max_marks),
          percentage: Math.round(assignmentPercentage * 10) / 10,
          pending: parseInt(assignmentData.total_assignments) - parseInt(assignmentData.submitted_count)
        },
        quizzes: {
          total: parseInt(quizData.total_quizzes),
          attempted: parseInt(quizData.attempted_count),
          completed: parseInt(quizData.completed_count),
          passed: parseInt(quizData.passed_count),
          averagePercentage: Math.round(quizPercentage * 10) / 10
        },
        overallPercentage: Math.round(subjectOverall * 10) / 10,
        letterGrade: calculateLetterGrade(subjectOverall)
      };
    });

    // Calculate overall averages
    const totalAssignmentMax = subjectProgress.reduce((sum, s) => sum + s.assignments.maxMarks, 0);
    const totalAssignmentObtained = subjectProgress.reduce((sum, s) => sum + s.assignments.marksObtained, 0);
    overallStats.assignmentAverage = totalAssignmentMax > 0 
      ? Math.round((totalAssignmentObtained / totalAssignmentMax) * 100 * 10) / 10 
      : 0;

    const quizPercentages = quizzesResult.rows.filter(q => parseFloat(q.average_percentage) > 0).map(q => parseFloat(q.average_percentage));
    overallStats.quizAverage = quizPercentages.length > 0
      ? Math.round(quizPercentages.reduce((a, b) => a + b, 0) / quizPercentages.length * 10) / 10
      : 0;

    console.log('[Progress] Calculation:', {
      totalAssignments: overallStats.totalAssignments,
      assignmentAverage: overallStats.assignmentAverage,
      totalQuizzes: overallStats.totalQuizzes,
      quizAverage: overallStats.quizAverage,
      quizPercentages
    });

    // Calculate overall percentage (weighted)
    if (overallStats.totalAssignments > 0 && overallStats.totalQuizzes > 0) {
      overallStats.overallPercentage = Math.round((overallStats.assignmentAverage * 0.5 + overallStats.quizAverage * 0.5) * 10) / 10;
    } else if (overallStats.totalAssignments > 0) {
      overallStats.overallPercentage = overallStats.assignmentAverage;
    } else if (overallStats.totalQuizzes > 0) {
      overallStats.overallPercentage = overallStats.quizAverage;
    }

    // Calculate grade AFTER calculating overallPercentage
    overallStats.overallGrade = calculateLetterGrade(overallStats.overallPercentage);

    console.log('[Progress] Final:', {
      overallPercentage: overallStats.overallPercentage,
      overallGrade: overallStats.overallGrade
    });

    // Get recent activity
    const recentActivity = await getRecentActivity(learnerId);

    res.json({
      success: true,
      data: {
        overall: overallStats,
        subjects: subjectProgress,
        recentActivity
      }
    });

  } catch (error) {
    console.error('[Progress] ERROR:', error.message);
    console.error('[Progress] Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to get progress: ' + error.message });
  }
};

// ============================================
// GET SUBJECT DETAILED PROGRESS
// ============================================
const getSubjectProgress = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const learnerId = req.user.userId;

    // Get subject info
    const subjectResult = await db.query(
      'SELECT id, name, code FROM modules WHERE id = $1',
      [subjectId]
    );

    if (subjectResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const subject = subjectResult.rows[0];

    // Get all assignments with submissions
    const assignmentsQuery = `
      SELECT 
        a.id,
        a.title,
        a.max_marks,
        a.due_date,
        s.id as submission_id,
        s.status as submission_status,
        s.marks_obtained,
        s.submitted_at,
        s.is_late,
        s.feedback,
        s.graded_at
      FROM assignments a
      LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.learner_id = $1
      WHERE a.subject_id = $2 AND a.is_published = true AND a.status = 'published'
      ORDER BY a.due_date DESC
    `;
    const assignmentsResult = await db.query(assignmentsQuery, [learnerId, subjectId]);

    // Get all quizzes with attempts
    const quizzesQuery = `
      SELECT 
        q.id,
        q.title,
        q.total_marks,
        q.passing_score,
        qa.id as attempt_id,
        qa.status as attempt_status,
        qa.total_score as score,
        qa.percentage_score as percentage,
        qa.passed,
        qa.started_at,
        qa.submitted_at as completed_at
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.learner_id = $1
      WHERE q.subject_id = $2 AND q.is_published = true
      ORDER BY q.created_at DESC
    `;
    const quizzesResult = await db.query(quizzesQuery, [learnerId, subjectId]);

    // Calculate assignment stats
    const assignmentStats = {
      total: assignmentsResult.rows.length,
      submitted: assignmentsResult.rows.filter(a => a.submission_id).length,
      graded: assignmentsResult.rows.filter(a => a.submission_status === 'graded').length,
      late: assignmentsResult.rows.filter(a => a.is_late).length,
      totalMarks: assignmentsResult.rows
        .filter(a => a.submission_status === 'graded')
        .reduce((sum, a) => sum + parseFloat(a.max_marks), 0),
      obtainedMarks: assignmentsResult.rows
        .filter(a => a.submission_status === 'graded')
        .reduce((sum, a) => sum + (parseFloat(a.marks_obtained) || 0), 0)
    };
    assignmentStats.percentage = assignmentStats.totalMarks > 0
      ? Math.round((assignmentStats.obtainedMarks / assignmentStats.totalMarks) * 100 * 10) / 10
      : 0;

    // Calculate quiz stats
    const completedQuizzes = quizzesResult.rows.filter(q => ['submitted', 'auto_submitted', 'graded', 'completed'].includes(q.attempt_status));
    const quizPercentages = completedQuizzes
      .filter(q => q.percentage !== null && q.percentage !== undefined)
      .map(q => parseFloat(q.percentage) || 0);
    
    const quizStats = {
      total: quizzesResult.rows.length,
      attempted: quizzesResult.rows.filter(q => q.attempt_id).length,
      completed: completedQuizzes.length,
      passed: quizzesResult.rows.filter(q => q.passed).length,
      averagePercentage: quizPercentages.length > 0
        ? Math.round((quizPercentages.reduce((a, b) => a + b, 0) / quizPercentages.length) * 10) / 10
        : 0
    };

    // Overall subject grade
    const overallPercentage = quizStats.total > 0 && assignmentStats.total > 0
      ? (assignmentStats.percentage * 0.5) + (quizStats.averagePercentage * 0.5)
      : (quizStats.total > 0 ? quizStats.averagePercentage : assignmentStats.percentage);

    res.json({
      success: true,
      data: {
        subject: {
          id: subject.id,
          name: subject.name,
          code: subject.code
        },
        summary: {
          assignmentPercentage: assignmentStats.percentage,
          quizAveragePercentage: quizStats.averagePercentage,
          overallPercentage: Math.round(overallPercentage * 10) / 10,
          letterGrade: calculateLetterGrade(overallPercentage),
          status: overallPercentage >= 50 ? 'Passing' : 'At Risk'
        },
        assignments: {
          stats: assignmentStats,
          items: assignmentsResult.rows.map(a => ({
            id: a.id,
            title: a.title,
            maxMarks: parseFloat(a.max_marks),
            dueDate: a.due_date,
            submission: a.submission_id ? {
              id: a.submission_id,
              status: a.submission_status,
              marksObtained: parseFloat(a.marks_obtained) || null,
              percentage: a.marks_obtained && a.max_marks 
                ? Math.round((a.marks_obtained / a.max_marks) * 100 * 10) / 10 
                : null,
              submittedAt: a.submitted_at,
              isLate: a.is_late,
              feedback: a.feedback,
              gradedAt: a.graded_at
            } : null
          }))
        },
        quizzes: {
          stats: quizStats,
          items: quizzesResult.rows.map(q => ({
            id: q.id,
            title: q.title,
            totalMarks: parseFloat(q.total_marks),
            passingScore: parseFloat(q.passing_score),
            attempt: q.attempt_id ? {
              id: q.attempt_id,
              status: q.attempt_status,
              score: parseFloat(q.score) || null,
              percentage: parseFloat(q.percentage) || null,
              passed: q.passed,
              startedAt: q.started_at,
              completedAt: q.completed_at
            } : null
          }))
        }
      }
    });

  } catch (error) {
    console.error('Get subject progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to get subject progress' });
  }
};

// ============================================
// GET PROGRESS OVER TIME (Chart Data)
// ============================================
const getProgressHistory = async (req, res) => {
  try {
    const learnerId = req.user.userId;
    const { months = 6 } = req.query;

    // Get assignment grades over time
    const assignmentHistoryQuery = `
      SELECT 
        DATE_TRUNC('month', s.graded_at) as month,
        COUNT(*) as count,
        AVG((s.marks_obtained / a.max_marks) * 100) as average_percentage
      FROM assignment_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.learner_id = $1 
        AND s.status = 'graded'
        AND s.graded_at >= NOW() - INTERVAL '${months} months'
      GROUP BY DATE_TRUNC('month', s.graded_at)
      ORDER BY month
    `;
    const assignmentHistory = await db.query(assignmentHistoryQuery, [learnerId]);

    // Get quiz scores over time
    const quizHistoryQuery = `
      SELECT 
        DATE_TRUNC('month', submitted_at) as month,
        COUNT(*) as count,
        AVG(percentage_score) as average_percentage
      FROM quiz_attempts
      WHERE learner_id = $1 
        AND status IN ('submitted', 'auto_submitted', 'graded', 'completed')
        AND submitted_at >= NOW() - INTERVAL '${months} months'
      GROUP BY DATE_TRUNC('month', submitted_at)
      ORDER BY month
    `;
    const quizHistory = await db.query(quizHistoryQuery, [learnerId]);

    res.json({
      success: true,
      data: {
        assignments: assignmentHistory.rows,
        quizzes: quizHistory.rows
      }
    });

  } catch (error) {
    console.error('Get progress history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get progress history' });
  }
};

// ============================================
// HELPER: Get Recent Activity
// ============================================
const getRecentActivity = async (learnerId) => {
  // Recent graded assignments
  const recentAssignments = await db.query(`
    SELECT 
      'assignment_graded' as type,
      a.title as title,
      s.marks_obtained,
      a.max_marks,
      s.graded_at as activity_date,
      m.name as subject_name
    FROM assignment_submissions s
    JOIN assignments a ON s.assignment_id = a.id
    JOIN modules m ON a.subject_id = m.id
    WHERE s.learner_id = $1 AND s.status = 'graded'
    ORDER BY s.graded_at DESC
    LIMIT 5
  `, [learnerId]);

  // Recent quiz completions
  const recentQuizzes = await db.query(`
    SELECT 
      'quiz_completed' as type,
      q.title as title,
      qa.total_score as score,
      q.total_marks as max_marks,
      qa.percentage_score as percentage,
      qa.passed,
      qa.submitted_at as activity_date,
      m.name as subject_name
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    JOIN modules m ON q.subject_id = m.id
    WHERE qa.learner_id = $1 AND qa.status IN ('submitted', 'auto_submitted', 'graded', 'completed')
    ORDER BY qa.submitted_at DESC
    LIMIT 5
  `, [learnerId]);

  // Combine and sort
  const allActivity = [
    ...recentAssignments.rows.map(a => ({ ...a, icon: 'assignment' })),
    ...recentQuizzes.rows.map(q => ({ ...q, icon: 'quiz' }))
  ];

  return allActivity
    .sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date))
    .slice(0, 5);
};

// ============================================
// HELPER: Calculate Letter Grade
// ============================================
const calculateLetterGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
};

module.exports = {
  getLearnerProgress,
  getSubjectProgress,
  getProgressHistory
};
