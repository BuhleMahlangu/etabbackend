const db = require('../config/database');

// ============================================
// CREATE QUIZ (Teacher/Admin only)
// ============================================
const createQuiz = async (req, res) => {
  try {
    const { 
      subjectId, 
      title, 
      description, 
      timeLimit, 
      maxAttempts,
      passingScore,
      availableFrom,
      availableUntil,
      shuffleQuestions,
      showCorrectAnswers,
      applicableGrades,
      questions 
    } = req.body;
    
    const teacherId = req.user.userId;

    // Validation
    if (!subjectId || !title || !questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Subject ID, title, and at least one question are required'
      });
    }

    // Verify teacher is assigned to this subject
    if (req.user.role === 'teacher') {
      const assignment = await db.query(
        `SELECT id, grade_id FROM teacher_assignments 
         WHERE teacher_id = $1 AND subject_id = $2 AND is_active = true`,
        [teacherId, subjectId]
      );
      
      if (assignment.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this subject'
        });
      }
    }

    // Calculate total marks
    const totalMarks = questions.reduce((sum, q) => sum + (q.points || q.marks || 1), 0);

    // Get grade IDs for applicable grades
    let gradeIds = [];
    if (applicableGrades && applicableGrades.length > 0) {
      const gradeResult = await db.query(
        'SELECT id FROM grades WHERE name = ANY($1)',
        [applicableGrades]
      );
      gradeIds = gradeResult.rows.map(g => g.id);
    }

    // Create quiz
    const quizResult = await db.query(
      `INSERT INTO quizzes 
        (subject_id, teacher_id, title, description, time_limit_minutes, 
         max_attempts, passing_score, total_marks, available_from, available_until,
         shuffle_questions, show_correct_answers, applicable_grades, applicable_grade_ids, is_published, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false, 'draft')
       RETURNING *`,
      [
        subjectId, teacherId, title, description, 
        timeLimit || 30, maxAttempts || 1, passingScore || 50, totalMarks,
        availableFrom || new Date(), availableUntil || null,
        shuffleQuestions || false, showCorrectAnswers || false,
        applicableGrades || [], gradeIds
      ]
    );

    const quiz = quizResult.rows[0];

    // Create questions with correct answers
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await db.query(
        `INSERT INTO quiz_questions 
          (quiz_id, question_text, question_type, options, correct_answer, correct_answers,
           points, explanation, question_order, case_sensitive)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          quiz.id, 
          q.text || q.question_text, 
          q.type || q.question_type || 'multiple_choice', 
          JSON.stringify(q.options || []),
          q.correctAnswer || q.correct_answer ? JSON.stringify(q.correctAnswer || q.correct_answer) : null,
          q.correctAnswers || q.correct_answers ? JSON.stringify(q.correctAnswers || q.correct_answers) : null,
          q.points || q.marks || 1,
          q.explanation || null,
          i + 1,
          q.caseSensitive || q.case_sensitive || false
        ]
      );
    }

    // Create notifications for enrolled students
    await createQuizNotifications(subjectId, gradeIds, title, quiz.id);

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      data: { ...quiz, questionCount: questions.length }
    });

  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to create quiz' });
  }
};

// ============================================
// GET ALL QUIZZES
// ============================================
const getAllQuizzes = async (req, res) => {
  try {
    const { subjectId, status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT q.*, 
             u.first_name || ' ' || u.last_name as teacher_name,
             m.name as subject_name, m.code as subject_code,
             (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as question_count
      FROM quizzes q
      JOIN users u ON q.teacher_id = u.id
      JOIN modules m ON q.subject_id = m.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // For learners - only show published quizzes
    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT grade_id FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGradeId = userResult.rows[0]?.grade_id;
      
      query += ` AND q.is_published = true 
                 AND q.status = 'published'
                 AND q.subject_id IN (
                   SELECT module_id FROM learner_modules 
                   WHERE learner_id = $${++paramCount} AND status = 'active'
                 )
                 AND ($${++paramCount} = ANY(q.applicable_grade_ids) OR q.applicable_grade_ids = '{}')
                 AND (q.available_until IS NULL OR q.available_until > NOW())`;
      params.push(req.user.userId, userGradeId);
    }

    if (subjectId) {
      query += ` AND q.subject_id = $${++paramCount}`;
      params.push(subjectId);
    }

    if (status) {
      query += ` AND q.status = $${++paramCount}`;
      params.push(status);
    }

    if (req.user.role === 'teacher') {
      query += ` AND (
        q.teacher_id = $${++paramCount}
        OR q.subject_id IN (
          SELECT subject_id FROM teacher_assignments 
          WHERE teacher_id = $${paramCount} AND is_active = true
        )
      )`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY q.created_at DESC 
               LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get attempt info for learner - include ALL quizzes (available and completed)
    if (req.user.role === 'learner') {
      const quizzesWithAttempts = [];
      for (let quiz of result.rows) {
        const attemptResult = await db.query(
          `SELECT id, status, total_score, percentage_score, passed, submitted_at
           FROM quiz_attempts 
           WHERE quiz_id = $1 AND learner_id = $2 AND status IN ('submitted', 'auto_submitted', 'graded')
           ORDER BY submitted_at DESC`,
          [quiz.id, req.user.userId]
        );
        quiz.myAttempts = attemptResult.rows || [];
        quiz.attemptsUsed = attemptResult.rows.length;
        
        // Include quiz if:
        // 1. Learner has attempts remaining (can retake), OR
        // 2. Learner has completed it at least once (to view feedback)
        if (quiz.attemptsUsed < quiz.max_attempts || quiz.attemptsUsed > 0) {
          quizzesWithAttempts.push(quiz);
        }
      }
      result.rows = quizzesWithAttempts;
    }

    res.json({
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit) }
    });

  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes' });
  }
};

// ============================================
// GET QUIZ BY ID
// ============================================
const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Get quiz basic info
    const quizResult = await db.query(
      `SELECT q.*, 
              u.first_name || ' ' || u.last_name as teacher_name,
              m.name as subject_name, m.code as subject_code
       FROM quizzes q
       JOIN users u ON q.teacher_id = u.id
       JOIN modules m ON q.subject_id = m.id
       WHERE q.id = $1`,
      [id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];

    // For learners, check if they can access this quiz
    if (userRole === 'learner') {
      if (!quiz.is_published || quiz.status !== 'published') {
        return res.status(403).json({ success: false, message: 'Quiz not available' });
      }
    }

    // Get questions
    const questionsResult = await db.query(
      `SELECT id, question_text, question_type, options, points, explanation, question_order
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY question_order`,
      [id]
    );

    quiz.questions = questionsResult.rows;

    // Get learner's attempts
    if (userRole === 'learner') {
      const attemptsResult = await db.query(
        `SELECT id, status, total_score, percentage_score, passed, started_at, submitted_at, time_taken_seconds
         FROM quiz_attempts 
         WHERE quiz_id = $1 AND learner_id = $2
         ORDER BY started_at DESC`,
        [id, userId]
      );
      quiz.myAttempts = attemptsResult.rows;
      quiz.attemptsUsed = attemptsResult.rows.length;
    }

    res.json({ success: true, data: quiz });

  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quiz' });
  }
};

// ============================================
// START QUIZ ATTEMPT (Learner)
// ============================================
const startAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const learnerId = req.user.userId;

    // Check if quiz exists and is published
    const quizResult = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND is_published = true AND status = 'published'`,
      [quizId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found or not available' });
    }

    const quiz = quizResult.rows[0];

    // Check if learner is enrolled in the subject
    const enrollmentCheck = await db.query(
      `SELECT id FROM learner_modules 
       WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
      [learnerId, quiz.subject_id]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this subject' });
    }

    // Check if learner's grade is applicable
    const userResult = await db.query('SELECT grade_id FROM users WHERE id = $1', [learnerId]);
    const userGradeId = userResult.rows[0]?.grade_id;

    if (quiz.applicable_grade_ids && quiz.applicable_grade_ids.length > 0) {
      if (!quiz.applicable_grade_ids.includes(userGradeId)) {
        return res.status(403).json({ success: false, message: 'This quiz is not available for your grade' });
      }
    }

    // Check max attempts
    const attemptCount = await getAttemptCount(quizId, learnerId);
    if (attemptCount >= quiz.max_attempts) {
      return res.status(403).json({ 
        success: false, 
        message: `You have used all ${quiz.max_attempts} attempt(s)` 
      });
    }

    // Check for incomplete attempt
    const incompleteResult = await db.query(
      `SELECT id FROM quiz_attempts 
       WHERE quiz_id = $1 AND learner_id = $2 AND status = 'in_progress'`,
      [quizId, learnerId]
    );

    if (incompleteResult.rows.length > 0) {
      // Resume existing attempt
      const attemptId = incompleteResult.rows[0].id;
      const questionsResult = await db.query(
        `SELECT id, question_text, question_type, options, points, question_order
         FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_order`,
        [quizId]
      );

      return res.json({
        success: true,
        message: 'Resuming existing attempt',
        data: {
          attemptId: attemptId,
          quiz: quiz,
          questions: questionsResult.rows,
          timeRemaining: calculateTimeRemaining(quiz.time_limit_minutes, attemptId)
        }
      });
    }

    // Create new attempt
    const attemptResult = await db.query(
      `INSERT INTO quiz_attempts (quiz_id, learner_id, status, max_possible_score, started_at)
       VALUES ($1, $2, 'in_progress', $3, NOW()) RETURNING *`,
      [quizId, learnerId, quiz.total_marks]
    );

    const attempt = attemptResult.rows[0];

    // Get questions (shuffled if enabled)
    let questionsQuery = `SELECT id, question_text, question_type, options, points, question_order
                          FROM quiz_questions WHERE quiz_id = $1`;
    if (quiz.shuffle_questions) {
      questionsQuery += ` ORDER BY RANDOM()`;
    } else {
      questionsQuery += ` ORDER BY question_order`;
    }

    const questionsResult = await db.query(questionsQuery, [quizId]);

    res.status(201).json({
      success: true,
      message: 'Quiz attempt started',
      data: {
        attemptId: attempt.id,
        quiz: quiz,
        questions: questionsResult.rows,
        timeLimit: quiz.time_limit_minutes,
        timeRemaining: quiz.time_limit_minutes * 60 // in seconds
      }
    });

  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(500).json({ success: false, message: 'Failed to start quiz attempt' });
  }
};

// ============================================
// SUBMIT ANSWER (During quiz)
// ============================================
const submitAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, answer, selectedOptions } = req.body;
    const learnerId = req.user.userId;

    // Verify attempt belongs to learner and is in progress
    const attemptCheck = await db.query(
      `SELECT qa.*, q.time_limit_minutes as time_limit FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1 AND qa.learner_id = $2 AND qa.status = 'in_progress'`,
      [attemptId, learnerId]
    );

    if (attemptCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Active attempt not found' });
    }

    const attempt = attemptCheck.rows[0];

    // Check if time has expired
    const timeElapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const timeLimitSeconds = attempt.time_limit * 60;

    if (timeElapsed > timeLimitSeconds) {
      // Auto-submit the quiz
      await autoSubmitQuiz(attemptId, learnerId);
      return res.status(403).json({ 
        success: false, 
        message: 'Time expired. Quiz has been auto-submitted.' 
      });
    }

    // Get question details for auto-marking
    const questionResult = await db.query(
      `SELECT * FROM quiz_questions WHERE id = $1`,
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const question = questionResult.rows[0];

    // Auto-mark the answer
    const markingResult = markAnswer(question, answer, selectedOptions);

    // Save or update answer
    const existingAnswer = await db.query(
      `SELECT id FROM quiz_answers WHERE attempt_id = $1 AND question_id = $2`,
      [attemptId, questionId]
    );

    if (existingAnswer.rows.length > 0) {
      // Update existing answer
      await db.query(
        `UPDATE quiz_answers 
         SET answer_text = $1, selected_options = $2, is_correct = $3, points_earned = $4
         WHERE id = $5`,
        [answer || null, selectedOptions ? JSON.stringify(selectedOptions) : null, 
         markingResult.isCorrect, markingResult.pointsEarned, existingAnswer.rows[0].id]
      );
    } else {
      // Insert new answer
      await db.query(
        `INSERT INTO quiz_answers 
         (attempt_id, question_id, answer_text, selected_options, is_correct, points_earned, points_possible)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [attemptId, questionId, answer || null, selectedOptions ? JSON.stringify(selectedOptions) : null,
         markingResult.isCorrect, markingResult.pointsEarned, question.points]
      );
    }

    res.json({
      success: true,
      message: 'Answer saved',
      data: {
        isCorrect: markingResult.isCorrect,
        pointsEarned: markingResult.pointsEarned,
        correctAnswer: markingResult.correctAnswer
      }
    });

  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ success: false, message: 'Failed to save answer' });
  }
};

// ============================================
// SUBMIT QUIZ (Final submission)
// ============================================
const submitQuiz = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers } = req.body; // Optional - answers might already be saved
    const learnerId = req.user.userId;

    // Verify attempt
    const attemptResult = await db.query(
      `SELECT qa.*, q.time_limit_minutes as time_limit, q.passing_score 
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1 AND qa.learner_id = $2 AND qa.status = 'in_progress'`,
      [attemptId, learnerId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Active attempt not found' });
    }

    const attempt = attemptResult.rows[0];

    // Calculate time taken
    const timeTaken = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const timeLimitSeconds = attempt.time_limit * 60;
    const isAutoSubmitted = timeTaken > timeLimitSeconds;

    // Process any remaining answers
    if (answers && answers.length > 0) {
      for (const ans of answers) {
        // Get question details
        const questionResult = await db.query(
          `SELECT * FROM quiz_questions WHERE id = $1`,
          [ans.questionId]
        );
        
        if (questionResult.rows.length > 0) {
          const question = questionResult.rows[0];
          const markingResult = markAnswer(question, ans.answer, ans.selectedOptions);
          
          // Check if answer already exists
          const existingAnswer = await db.query(
            `SELECT id FROM quiz_answers WHERE attempt_id = $1 AND question_id = $2`,
            [attemptId, ans.questionId]
          );
          
          if (existingAnswer.rows.length > 0) {
            await db.query(
              `UPDATE quiz_answers 
               SET answer_text = $1, selected_options = $2, is_correct = $3, points_earned = $4
               WHERE id = $5`,
              [ans.answer || null, ans.selectedOptions ? JSON.stringify(ans.selectedOptions) : null, 
               markingResult.isCorrect, markingResult.pointsEarned, existingAnswer.rows[0].id]
            );
          } else {
            await db.query(
              `INSERT INTO quiz_answers 
               (attempt_id, question_id, answer_text, selected_options, is_correct, points_earned, points_possible)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [attemptId, ans.questionId, ans.answer || null, ans.selectedOptions ? JSON.stringify(ans.selectedOptions) : null,
               markingResult.isCorrect, markingResult.pointsEarned, question.points]
            );
          }
        }
      }
    }

    // Calculate final score
    const scoreResult = await db.query(
      `SELECT SUM(points_earned) as earned, SUM(points_possible) as possible
       FROM quiz_answers WHERE attempt_id = $1`,
      [attemptId]
    );

    const earned = parseInt(scoreResult.rows[0].earned) || 0;
    const possible = parseInt(scoreResult.rows[0].possible) || attempt.max_possible_score;
    const percentage = possible > 0 ? (earned / possible * 100).toFixed(2) : 0;
    const passed = percentage >= attempt.passing_score;

    // Update attempt
    await db.query(
      `UPDATE quiz_attempts 
       SET status = $1, submitted_at = NOW(), time_taken_seconds = $2,
           total_score = $3, max_possible_score = $4, percentage_score = $5, passed = $6
       WHERE id = $7`,
      [isAutoSubmitted ? 'auto_submitted' : 'submitted', timeTaken, earned, possible, percentage, passed, attemptId]
    );

    // Get detailed results
    const results = await db.query(
      `SELECT qa.*, qq.question_text, qq.correct_answer, qq.correct_answers, qq.explanation
       FROM quiz_answers qa
       JOIN quiz_questions qq ON qa.question_id = qq.id
       WHERE qa.attempt_id = $1`,
      [attemptId]
    );

    res.json({
      success: true,
      message: 'Quiz submitted successfully',
      data: {
        attemptId,
        score: earned,
        maxScore: possible,
        percentage: parseFloat(percentage),
        passed,
        timeTaken,
        isAutoSubmitted,
        results: results.rows
      }
    });

  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit quiz' });
  }
};

// ============================================
// GET STUDENT'S QUIZ RESULTS (Teacher/Admin)
// ============================================
const getStudentQuizResults = async (req, res) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.user.userId;
    const userRole = req.user.role;
    const userSchoolId = req.user.schoolId;

    // Build base query
    let query = `
      SELECT qa.*, 
             q.title as quiz_title, q.subject_id, q.passing_score,
             m.name as subject_name, m.code as subject_code,
             u.first_name || ' ' || u.last_name as teacher_name
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN modules m ON q.subject_id = m.id
      JOIN users u ON q.teacher_id = u.id
      WHERE qa.learner_id = $1 AND qa.status IN ('submitted', 'auto_submitted', 'graded')
    `;
    let params = [studentId];

    // If teacher (not admin), only show results for quizzes they created
    if (userRole === 'teacher') {
      query += ` AND q.teacher_id = $${params.length + 1}`;
      params.push(teacherId);
    }

    // Apply school filter
    if (userSchoolId) {
      query += ` AND m.school_id = '${userSchoolId}'`;
    }

    query += ` ORDER BY qa.submitted_at DESC`;

    const result = await db.query(query, params);

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get student quiz results error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student quiz results' });
  }
};

// ============================================
// GET MY QUIZ RESULTS (Learner)
// ============================================
const getMyQuizResults = async (req, res) => {
  try {
    const learnerId = req.user.userId;
    const { subjectId } = req.query;

    let query = `
      SELECT qa.*, 
             q.title as quiz_title, q.subject_id, q.passing_score,
             q.show_correct_answers,
             m.name as subject_name, m.code as subject_code,
             u.first_name || ' ' || u.last_name as teacher_name
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN modules m ON q.subject_id = m.id
      JOIN users u ON q.teacher_id = u.id
      WHERE qa.learner_id = $1 AND qa.status IN ('submitted', 'auto_submitted', 'graded')
    `;
    let params = [learnerId];

    if (subjectId) {
      query += ` AND q.subject_id = $${params.length + 1}`;
      params.push(subjectId);
    }

    query += ` ORDER BY qa.submitted_at DESC`;

    const result = await db.query(query, params);

    // Get details for each attempt
    for (let attempt of result.rows) {
      // Check if correct answers should be shown
      const showCorrectAnswers = attempt.show_correct_answers;
      
      const answersResult = await db.query(
        `SELECT qa.*, qq.question_text, qq.question_type, qq.options,
                qq.points as max_points,
                CASE WHEN $2 = true THEN qq.correct_answer ELSE NULL END as correct_answer,
                CASE WHEN $2 = true THEN qq.correct_answers ELSE NULL END as correct_answers,
                CASE WHEN $2 = true THEN qq.explanation ELSE NULL END as explanation
         FROM quiz_answers qa
         JOIN quiz_questions qq ON qa.question_id = qq.id
         WHERE qa.attempt_id = $1`,
        [attempt.id, showCorrectAnswers]
      );
      attempt.answers = answersResult.rows;
      attempt.feedbackAvailable = showCorrectAnswers;
    }

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get my results error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch results' });
  }
};

// ============================================
// GET QUIZ STATISTICS (Teacher)
// ============================================
const getQuizStatistics = async (req, res) => {
  try {
    const { quizId } = req.params;
    const teacherId = req.user.userId;

    // Verify teacher owns this quiz
    const quizCheck = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND teacher_id = $2`,
      [quizId, teacherId]
    );

    if (quizCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get statistics
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN passed THEN 1 END) as passed_count,
        AVG(percentage_score) as avg_score,
        MAX(percentage_score) as highest_score,
        MIN(percentage_score) as lowest_score
       FROM quiz_attempts 
       WHERE quiz_id = $1 AND status IN ('submitted', 'auto_submitted', 'graded')`,
      [quizId]
    );

    const stats = statsResult.rows[0];

    // Get recent attempts with learner details
    const attemptsResult = await db.query(
      `SELECT qa.*, u.first_name, u.last_name, u.email
       FROM quiz_attempts qa
       JOIN users u ON qa.learner_id = u.id
       WHERE qa.quiz_id = $1 AND qa.status IN ('submitted', 'auto_submitted', 'graded')
       ORDER BY qa.submitted_at DESC
       LIMIT 20`,
      [quizId]
    );

    res.json({
      success: true,
      data: {
        overview: {
          totalAttempts: parseInt(stats.total_attempts),
          passedCount: parseInt(stats.passed_count),
          passRate: stats.total_attempts > 0 ? (stats.passed_count / stats.total_attempts * 100).toFixed(1) : 0,
          averageScore: parseFloat(stats.avg_score).toFixed(1),
          highestScore: parseFloat(stats.highest_score).toFixed(1),
          lowestScore: parseFloat(stats.lowest_score).toFixed(1)
        },
        recentAttempts: attemptsResult.rows
      }
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};

// ============================================
// TEACHER: GET ATTEMPT DETAILS FOR REVIEW
// ============================================
const getAttemptForReview = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const teacherId = req.user.userId;

    // Get attempt with quiz info
    const attemptResult = await db.query(
      `SELECT qa.*, q.title, q.subject_id, q.teacher_id, q.passing_score,
              u.first_name || ' ' || u.last_name as learner_name
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN users u ON qa.learner_id = u.id
       WHERE qa.id = $1`,
      [attemptId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    const attempt = attemptResult.rows[0];

    // Verify teacher owns this quiz
    if (attempt.teacher_id !== teacherId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get answers
    const answersResult = await db.query(
      `SELECT qa.*, qq.question_text, qq.question_type, qq.options,
              qq.correct_answer, qq.correct_answers, qq.explanation, qq.points
       FROM quiz_answers qa
       JOIN quiz_questions qq ON qa.question_id = qq.id
       WHERE qa.attempt_id = $1
       ORDER BY qq.question_order`,
      [attemptId]
    );

    res.json({
      success: true,
      data: {
        ...attempt,
        answers: answersResult.rows
      }
    });

  } catch (error) {
    console.error('Get attempt for review error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attempt' });
  }
};

// ============================================
// TEACHER: OVERRIDE ANSWER MARK
// ============================================
const overrideAnswerMark = async (req, res) => {
  try {
    const { answerId } = req.params;
    const { isCorrect, pointsEarned, feedback } = req.body;
    const teacherId = req.user.userId;

    // Get answer with quiz info
    const answerResult = await db.query(
      `SELECT qa.*, q.teacher_id, q.id as quiz_id, qq.points as max_points
       FROM quiz_answers qa
       JOIN quiz_attempts att ON qa.attempt_id = att.id
       JOIN quizzes q ON att.quiz_id = q.id
       JOIN quiz_questions qq ON qa.question_id = qq.id
       WHERE qa.id = $1`,
      [answerId]
    );

    if (answerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    const answer = answerResult.rows[0];

    // Verify teacher owns this quiz
    if (answer.teacher_id !== teacherId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Update answer
    await db.query(
      `UPDATE quiz_answers 
       SET is_correct = $1, points_earned = $2, teacher_override = true, 
           teacher_adjusted_points = $2, teacher_feedback = $3
       WHERE id = $4`,
      [isCorrect, Math.min(pointsEarned, answer.max_points), feedback || null, answerId]
    );

    // Recalculate total score for the attempt
    const attemptId = answer.attempt_id;
    const scoreResult = await db.query(
      `SELECT SUM(points_earned) as earned, SUM(points_possible) as possible
       FROM quiz_answers WHERE attempt_id = $1`,
      [attemptId]
    );

    const earned = parseInt(scoreResult.rows[0].earned) || 0;
    const possible = parseInt(scoreResult.rows[0].possible);
    const percentage = possible > 0 ? (earned / possible * 100).toFixed(2) : 0;

    // Get quiz passing score
    const quizResult = await db.query(
      `SELECT passing_score FROM quizzes q
       JOIN quiz_attempts qa ON q.id = qa.quiz_id
       WHERE qa.id = $1`,
      [attemptId]
    );
    const passingScore = quizResult.rows[0]?.passing_score || 50;
    const passed = percentage >= passingScore;

    // Update attempt
    await db.query(
      `UPDATE quiz_attempts 
       SET total_score = $1, percentage_score = $2, passed = $3,
           teacher_reviewed = true, teacher_id = $4, status = 'graded'
       WHERE id = $5`,
      [earned, percentage, passed, teacherId, attemptId]
    );

    res.json({
      success: true,
      message: 'Answer mark updated',
      data: {
        newScore: earned,
        newPercentage: parseFloat(percentage),
        passed
      }
    });

  } catch (error) {
    console.error('Override answer error:', error);
    res.status(500).json({ success: false, message: 'Failed to update mark' });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Auto-mark an answer based on question type
// SIMPLIFIED: Now stores and compares actual TEXT values directly
function markAnswer(question, answerText, selectedOptions) {
  const questionType = question.question_type;
  let isCorrect = false;
  let pointsEarned = 0;

  // Get the stored correct answer (now stored as plain text, not index)
  // The correct_answer column stores the actual text value
  const storedCorrectAnswer = question.correct_answer || '';
  
  // Parse if it's JSON (for backward compatibility with old quizzes)
  let correctAnswerText = storedCorrectAnswer;
  try {
    const parsed = JSON.parse(storedCorrectAnswer);
    if (Array.isArray(parsed)) {
      correctAnswerText = parsed[0]; // Take first if array
    } else {
      correctAnswerText = parsed.toString();
    }
  } catch (e) {
    // Not JSON, use as-is
    correctAnswerText = storedCorrectAnswer;
  }

  // User's answer (use answerText for all types now)
  const userAnswer = (answerText || '').toString().trim();

  switch (questionType) {
    case 'multiple_choice':
    case 'true_false':
      // Direct text comparison - both stored and submitted are the actual text
      isCorrect = userAnswer === correctAnswerText.trim();
      console.log(`[MARK] ${questionType}: user="${userAnswer}" correct="${correctAnswerText.trim()}" => ${isCorrect}`);
      break;

    case 'short_answer':
    case 'fill_blank':
      // Case-insensitive comparison for text answers
      if (question.case_sensitive) {
        isCorrect = userAnswer === correctAnswerText.trim();
      } else {
        isCorrect = userAnswer.toLowerCase() === correctAnswerText.trim().toLowerCase();
      }
      console.log(`[MARK] ${questionType}: user="${userAnswer}" correct="${correctAnswerText.trim()}" caseSensitive=${question.case_sensitive} => ${isCorrect}`);
      break;

    default:
      isCorrect = false;
  }

  if (isCorrect) {
    pointsEarned = question.points || 1;
  }

  return {
    isCorrect,
    pointsEarned,
    correctAnswer: correctAnswerText
  };
}

// Get attempt count for a learner
async function getAttemptCount(quizId, learnerId) {
  const result = await db.query(
    `SELECT COUNT(*) as count FROM quiz_attempts 
     WHERE quiz_id = $1 AND learner_id = $2 AND status IN ('submitted', 'auto_submitted', 'graded')`,
    [quizId, learnerId]
  );
  return parseInt(result.rows[0].count);
}

// Calculate remaining time
function calculateTimeRemaining(timeLimitMinutes, attemptId) {
  // This would need the started_at time from the attempt
  // For now, return full time limit
  return timeLimitMinutes * 60;
}

// Auto-submit quiz when time expires
async function autoSubmitQuiz(attemptId, learnerId) {
  // Similar to submitQuiz but marked as auto-submitted
  const attemptResult = await db.query(
    `SELECT * FROM quiz_attempts WHERE id = $1 AND learner_id = $2`,
    [attemptId, learnerId]
  );

  if (attemptResult.rows.length === 0) return;

  const attempt = attemptResult.rows[0];
  const timeTaken = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);

  // Calculate score
  const scoreResult = await db.query(
    `SELECT SUM(points_earned) as earned, SUM(points_possible) as possible
     FROM quiz_answers WHERE attempt_id = $1`,
    [attemptId]
  );

  const earned = parseInt(scoreResult.rows[0].earned) || 0;
  const possible = parseInt(scoreResult.rows[0].possible) || attempt.max_possible_score;
  const percentage = possible > 0 ? (earned / possible * 100).toFixed(2) : 0;
  const passed = percentage >= 50; // Default passing score

  await db.query(
    `UPDATE quiz_attempts 
     SET status = 'auto_submitted', submitted_at = NOW(), time_taken_seconds = $1,
         total_score = $2, max_possible_score = $3, percentage_score = $4, passed = $5
     WHERE id = $6`,
    [timeTaken, earned, possible, percentage, passed, attemptId]
  );
}

// Create notifications
async function createQuizNotifications(subjectId, gradeIds, quizTitle, quizId) {
  try {
    let query = `
      SELECT DISTINCT u.id 
      FROM users u
      JOIN learner_modules lm ON u.id = lm.learner_id
      WHERE lm.module_id = $1 
      AND lm.status = 'active'
    `;
    let params = [subjectId];

    if (gradeIds && gradeIds.length > 0) {
      query += ` AND u.grade_id = ANY($2)`;
      params.push(gradeIds);
    }

    const students = await db.query(query, params);

    for (const student of students.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, related_id, created_at)
         VALUES ($1, $2, $3, 'quiz', $4, NOW())`,
        [student.id, 'New Quiz Available', `A new quiz is available: ${quizTitle}`, quizId]
      );
    }
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
}

// ============================================
// DELETE QUIZ (Teacher/Admin only)
// ============================================
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.userId;

    // Verify teacher owns this quiz
    const quizCheck = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND teacher_id = $2`,
      [id, teacherId]
    );

    if (quizCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete quiz (cascade will handle related questions and attempts)
    await db.query('DELETE FROM quizzes WHERE id = $1', [id]);

    res.json({ success: true, message: 'Quiz deleted successfully' });

  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete quiz' });
  }
};

// ============================================
// PUBLISH QUIZ (Teacher/Admin only)
// ============================================
const publishQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.userId;

    // Verify teacher owns this quiz
    const quizCheck = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND teacher_id = $2`,
      [id, teacherId]
    );

    if (quizCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Update quiz status to published
    await db.query(
      `UPDATE quizzes SET is_published = true, status = 'published' WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Quiz published successfully' });

  } catch (error) {
    console.error('Publish quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to publish quiz' });
  }
};

// ============================================
// UNPUBLISH QUIZ (Teacher/Admin only)
// ============================================
const unpublishQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.userId;

    // Verify teacher owns this quiz
    const quizCheck = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND teacher_id = $2`,
      [id, teacherId]
    );

    if (quizCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Update quiz status to draft
    await db.query(
      `UPDATE quizzes SET is_published = false, status = 'draft' WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Quiz unpublished successfully' });

  } catch (error) {
    console.error('Unpublish quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to unpublish quiz' });
  }
};

// ============================================
// TEACHER: RESET STUDENT ATTEMPT
// ============================================
const resetStudentAttempt = async (req, res) => {
  try {
    const { quizId, learnerId } = req.params;
    const teacherId = req.user.userId;

    // Verify teacher owns this quiz
    const quizCheck = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND teacher_id = $2`,
      [quizId, teacherId]
    );

    if (quizCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete all attempts for this learner on this quiz
    await db.query(
      `DELETE FROM quiz_attempts WHERE quiz_id = $1 AND learner_id = $2`,
      [quizId, learnerId]
    );

    res.json({ success: true, message: 'Student attempt reset successfully' });

  } catch (error) {
    console.error('Reset attempt error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset attempt' });
  }
};

// ============================================
// GET QUIZ ATTEMPTS (Teacher view)
// ============================================
const getQuizAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;
    const teacherId = req.user.userId;

    // Verify teacher owns this quiz
    const quizCheck = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND teacher_id = $2`,
      [quizId, teacherId]
    );

    if (quizCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const attemptsResult = await db.query(
      `SELECT qa.*, u.first_name, u.last_name, u.email
       FROM quiz_attempts qa
       JOIN users u ON qa.learner_id = u.id
       WHERE qa.quiz_id = $1
       ORDER BY qa.started_at DESC`,
      [quizId]
    );

    res.json({ success: true, data: attemptsResult.rows });

  } catch (error) {
    console.error('Get quiz attempts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attempts' });
  }
};

// ============================================
// EXTEND QUIZ DUE DATE
// ============================================
const extendDueDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDueDate, reason } = req.body;
    const teacherId = req.user.userId;

    if (!newDueDate) {
      return res.status(400).json({
        success: false,
        message: 'New due date is required'
      });
    }

    // Get current quiz
    const quizResult = await db.query(
      `SELECT q.*, m.name as subject_name, m.id as subject_id
       FROM quizzes q
       JOIN modules m ON q.subject_id = m.id
       WHERE q.id = $1`,
      [id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];

    // Verify teacher owns this quiz
    if (quiz.teacher_id !== teacherId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Store original due date if not already stored
    const originalDueDate = quiz.original_due_date || quiz.available_until;

    // Update quiz with extension
    const updateResult = await db.query(
      `UPDATE quizzes 
       SET available_until = $1,
           original_due_date = $2,
           extended_due_date = $1,
           extended_at = NOW(),
           extended_by = $3,
           extension_reason = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [newDueDate, originalDueDate, teacherId, reason || null, id]
    );

    const updatedQuiz = updateResult.rows[0];

    // Get enrolled students to notify
    const studentsResult = await db.query(
      `SELECT DISTINCT lm.learner_id 
       FROM learner_modules lm
       WHERE lm.module_id = $1 
       AND lm.status = 'active'
       AND ($2 = '{}' OR lm.grade_id = ANY($2))`,
      [quiz.subject_id, quiz.applicable_grade_ids]
    );

    const studentIds = studentsResult.rows.map(r => r.learner_id);

    // Create notifications for all enrolled students
    if (studentIds.length > 0) {
      const notificationValues = studentIds.map(studentId => {
        return `('${studentId}', 'deadline_extended', 'Quiz Deadline Extended', 
                'The deadline for "${quiz.title}" in ${quiz.subject_name} has been extended to ${new Date(newDueDate).toLocaleString()}. ${reason ? 'Reason: ' + reason : ''}', 
                false, NOW(), '${quiz.subject_id}', NULL, '${id}')`;
      }).join(', ');

      await db.query(
        `INSERT INTO notifications 
          (user_id, type, title, message, is_read, created_at, related_subject_id, related_assignment_id, related_quiz_id)
         VALUES ${notificationValues}`
      );

      // Log the extension
      await db.query(
        `INSERT INTO due_date_extension_notifications 
          (item_type, item_id, subject_id, teacher_id, original_due_date, new_due_date, reason, notified_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['quiz', id, quiz.subject_id, teacherId, originalDueDate, newDueDate, reason || null, studentIds.length]
      );
    }

    res.json({
      success: true,
      message: `Quiz due date extended successfully. ${studentIds.length} students notified.`,
      data: updatedQuiz
    });

  } catch (error) {
    console.error('Extend quiz due date error:', error);
    res.status(500).json({ success: false, message: 'Failed to extend due date' });
  }
};

module.exports = {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  deleteQuiz,
  publishQuiz,
  unpublishQuiz,
  resetStudentAttempt,
  getQuizAttempts,
  startAttempt,
  submitAnswer,
  submitQuiz,
  getMyQuizResults,
  getQuizStatistics,
  getAttemptForReview,
  overrideAnswerMark,
  getStudentQuizResults,
  extendDueDate
};
