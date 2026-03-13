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
      applicableGrades, // NEW: Grade targeting
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
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

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

    // Create questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await db.query(
        `INSERT INTO quiz_questions 
          (quiz_id, question_text, question_type, options, correct_answer, 
           marks, explanation, question_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          quiz.id, q.text, q.type || 'multiple_choice', 
          JSON.stringify(q.options || []), 
          JSON.stringify(q.correctAnswer),
          q.marks || 1, q.explanation || null, i + 1
        ]
      );
    }

    // Create notifications for enrolled students in applicable grades
    await createQuizNotifications(
      subjectId,
      gradeIds,
      title,
      quiz.id
    );

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
// GET ALL QUIZZES (with filtering)
// ============================================
const getAllQuizzes = async (req, res) => {
  try {
    const { subjectId, status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT q.*, 
             u.first_name || ' ' || u.last_name as teacher_name,
             m.name as subject_name, m.code as subject_code,
             (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as question_count,
             (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count
      FROM quizzes q
      JOIN users u ON q.teacher_id = u.id
      JOIN modules m ON q.subject_id = m.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // For learners - only show published quizzes for their enrolled subjects AND grades
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

    // Filter by subject
    if (subjectId) {
      query += ` AND q.subject_id = $${++paramCount}`;
      params.push(subjectId);
    }

    // Filter by status
    if (status) {
      query += ` AND q.status = $${++paramCount}`;
      params.push(status);
    }

    // For teachers - only show their own quizzes or for their assigned subjects
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

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM quizzes q WHERE 1=1`;
    let countParams = [];
    let countParamCount = 0;

    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT grade_id FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGradeId = userResult.rows[0]?.grade_id;
      
      countQuery += ` AND q.is_published = true 
                      AND q.status = 'published'
                      AND q.subject_id IN (
                        SELECT module_id FROM learner_modules 
                        WHERE learner_id = $${++countParamCount} AND status = 'active'
                      )
                      AND ($${++countParamCount} = ANY(q.applicable_grade_ids) OR q.applicable_grade_ids = '{}')
                      AND (q.available_until IS NULL OR q.available_until > NOW())`;
      countParams.push(req.user.userId, userGradeId);
    }

    if (subjectId) {
      countQuery += ` AND q.subject_id = $${++countParamCount}`;
      countParams.push(subjectId);
    }

    if (status) {
      countQuery += ` AND q.status = $${++countParamCount}`;
      countParams.push(status);
    }

    if (req.user.role === 'teacher') {
      countQuery += ` AND (
        q.teacher_id = $${++countParamCount}
        OR q.subject_id IN (
          SELECT subject_id FROM teacher_assignments 
          WHERE teacher_id = $${countParamCount} AND is_active = true
        )
      )`;
      countParams.push(req.user.userId);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes' });
  }
};

// ============================================
// GET QUIZ BY ID (with questions for teachers)
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

    // Check access for learners
    if (userRole === 'learner') {
      if (!quiz.is_published || quiz.status !== 'published') {
        return res.status(403).json({ success: false, message: 'Quiz not available' });
      }

      // Check enrollment
      const enrollment = await db.query(
        `SELECT grade_id FROM learner_modules 
         WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
        [userId, quiz.subject_id]
      );
      
      if (enrollment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'You are not enrolled in this subject' });
      }

      // Check grade
      const learnerGradeId = enrollment.rows[0].grade_id;
      if (quiz.applicable_grade_ids?.length > 0 && 
          !quiz.applicable_grade_ids.includes(learnerGradeId)) {
        return res.status(403).json({ success: false, message: 'This quiz is not available for your grade' });
      }

      // Check availability
      const now = new Date();
      if (quiz.available_from && new Date(quiz.available_from) > now) {
        return res.status(403).json({ success: false, message: 'Quiz not yet available' });
      }
      if (quiz.available_until && new Date(quiz.available_until) < now) {
        return res.status(403).json({ success: false, message: 'Quiz has expired' });
      }
    }

    // Get questions (without correct answers for learners taking the quiz)
    let questionsQuery = `
      SELECT id, question_text, question_type, options, marks, explanation, question_order
      FROM quiz_questions 
      WHERE quiz_id = $1
      ORDER BY question_order
    `;
    
    // Include correct answers for teachers or if showCorrectAnswers is enabled
    if (userRole === 'teacher' || userRole === 'admin' || quiz.show_correct_answers) {
      questionsQuery = `
        SELECT id, question_text, question_type, options, correct_answer, marks, explanation, question_order
        FROM quiz_questions 
        WHERE quiz_id = $1
        ORDER BY question_order
      `;
    }

    const questionsResult = await db.query(questionsQuery, [id]);

    // Get learner's attempts (for learners)
    let attempts = [];
    if (userRole === 'learner') {
      const attemptsResult = await db.query(
        `SELECT * FROM quiz_attempts 
         WHERE quiz_id = $1 AND learner_id = $2 
         ORDER BY started_at DESC`,
        [id, userId]
      );
      attempts = attemptsResult.rows;
    }

    res.json({
      success: true,
      data: {
        ...quiz,
        questions: questionsResult.rows,
        myAttempts: attempts
      }
    });

  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quiz' });
  }
};

// ============================================
// UPDATE QUIZ
// ============================================
const updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, timeLimit, maxAttempts, passingScore,
      availableFrom, availableUntil, shuffleQuestions, 
      showCorrectAnswers, applicableGrades, isPublished, status 
    } = req.body;

    // Check ownership
    const existing = await db.query(
      'SELECT teacher_id FROM quizzes WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Only owner or admin can update
    if (req.user.role !== 'admin' && existing.rows[0].teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get grade IDs if applicableGrades changed
    let gradeIds = null;
    if (applicableGrades) {
      const gradeResult = await db.query(
        'SELECT id FROM grades WHERE name = ANY($1)',
        [applicableGrades]
      );
      gradeIds = gradeResult.rows.map(g => g.id);
    }

    const result = await db.query(
      `UPDATE quizzes 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           time_limit_minutes = COALESCE($3, time_limit_minutes),
           max_attempts = COALESCE($4, max_attempts),
           passing_score = COALESCE($5, passing_score),
           available_from = COALESCE($6, available_from),
           available_until = COALESCE($7, available_until),
           shuffle_questions = COALESCE($8, shuffle_questions),
           show_correct_answers = COALESCE($9, show_correct_answers),
           applicable_grades = COALESCE($13, applicable_grades),
           applicable_grade_ids = COALESCE($14, applicable_grade_ids),
           is_published = COALESCE($10, is_published),
           status = COALESCE($11, status),
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [title, description, timeLimit, maxAttempts, passingScore,
       availableFrom, availableUntil, shuffleQuestions, showCorrectAnswers,
       isPublished, status, id, applicableGrades, gradeIds]
    );

    res.json({
      success: true,
      message: 'Quiz updated',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to update quiz' });
  }
};

// ============================================
// DELETE QUIZ
// ============================================
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await db.query(
      'SELECT teacher_id FROM quizzes WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Only owner or admin can delete
    if (req.user.role !== 'admin' && existing.rows[0].teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete related records first
    await db.query('DELETE FROM quiz_attempts WHERE quiz_id = $1', [id]);
    await db.query('DELETE FROM quiz_questions WHERE quiz_id = $1', [id]);
    await db.query('DELETE FROM quizzes WHERE id = $1', [id]);

    res.json({ success: true, message: 'Quiz deleted' });

  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete quiz' });
  }
};

// ============================================
// ADD QUESTION TO QUIZ
// ============================================
const addQuestion = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { text, type, options, correctAnswer, marks, explanation } = req.body;

    // Verify ownership
    const quiz = await db.query(
      'SELECT teacher_id, subject_id FROM quizzes WHERE id = $1',
      [quizId]
    );

    if (quiz.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (req.user.role !== 'admin' && quiz.rows[0].teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get next question order
    const orderResult = await db.query(
      'SELECT COALESCE(MAX(question_order), 0) + 1 as next_order FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );
    const nextOrder = orderResult.rows[0].next_order;

    const result = await db.query(
      `INSERT INTO quiz_questions 
        (quiz_id, question_text, question_type, options, correct_answer, marks, explanation, question_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [quizId, text, type || 'multiple_choice', JSON.stringify(options || []),
       JSON.stringify(correctAnswer), marks || 1, explanation, nextOrder]
    );

    // Update quiz total marks
    await db.query(
      `UPDATE quizzes 
       SET total_marks = (SELECT COALESCE(SUM(marks), 0) FROM quiz_questions WHERE quiz_id = $1)
       WHERE id = $1`,
      [quizId]
    );

    res.status(201).json({
      success: true,
      message: 'Question added',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ success: false, message: 'Failed to add question' });
  }
};

// ============================================
// START QUIZ ATTEMPT (Learner)
// ============================================
const startAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const learnerId = req.user.userId;

    // Get quiz info with grade check
    const quizResult = await db.query(
      `SELECT q.*, m.name as subject_name
       FROM quizzes q
       JOIN modules m ON q.subject_id = m.id
       WHERE q.id = $1 AND q.is_published = true AND q.status = 'published'`,
      [quizId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found or not available' });
    }

    const quiz = quizResult.rows[0];

    // Check enrollment AND grade
    const enrollment = await db.query(
      `SELECT grade_id FROM learner_modules 
       WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
      [learnerId, quiz.subject_id]
    );

    if (enrollment.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not enrolled in this subject' });
    }

    // Check if quiz is for this grade
    const learnerGradeId = enrollment.rows[0].grade_id;
    if (quiz.applicable_grade_ids?.length > 0 && 
        !quiz.applicable_grade_ids.includes(learnerGradeId)) {
      return res.status(403).json({ success: false, message: 'This quiz is not available for your grade' });
    }

    // Check availability
    const now = new Date();
    if (quiz.available_from && new Date(quiz.available_from) > now) {
      return res.status(403).json({ success: false, message: 'Quiz not yet available' });
    }
    if (quiz.available_until && new Date(quiz.available_until) < now) {
      return res.status(403).json({ success: false, message: 'Quiz has expired' });
    }

    // Check attempt limit
    const attemptsResult = await db.query(
      `SELECT COUNT(*) as count FROM quiz_attempts 
       WHERE quiz_id = $1 AND learner_id = $2 AND status != 'abandoned'`,
      [quizId, learnerId]
    );
    const attemptCount = parseInt(attemptsResult.rows[0].count);

    if (attemptCount >= quiz.max_attempts) {
      return res.status(403).json({ 
        success: false, 
        message: `Maximum ${quiz.max_attempts} attempt(s) allowed` 
      });
    }

    // Check for in-progress attempt
    const inProgressResult = await db.query(
      `SELECT * FROM quiz_attempts 
       WHERE quiz_id = $1 AND learner_id = $2 AND status = 'in_progress'`,
      [quizId, learnerId]
    );

    if (inProgressResult.rows.length > 0) {
      // Resume existing attempt
      const attempt = inProgressResult.rows[0];
      
      // Check if time expired
      const startTime = new Date(attempt.started_at);
      const timeElapsed = (now - startTime) / 1000 / 60; // minutes
      
      if (timeElapsed > quiz.time_limit_minutes) {
        // Auto-submit as abandoned
        await db.query(
          `UPDATE quiz_attempts 
           SET status = 'abandoned', completed_at = NOW()
           WHERE id = $1`,
          [attempt.id]
        );
      } else {
        // Return existing attempt
        const questionsResult = await db.query(
          `SELECT id, question_text, question_type, options, marks, question_order
           FROM quiz_questions 
           WHERE quiz_id = $1
           ORDER BY question_order`,
          [quizId]
        );

        return res.json({
          success: true,
          message: 'Resuming attempt',
          data: {
            attemptId: attempt.id,
            quiz: quiz,
            questions: questionsResult.rows,
            answers: attempt.answers || {},
            timeRemaining: Math.ceil(quiz.time_limit_minutes - timeElapsed)
          }
        });
      }
    }

    // Create new attempt
    const attemptResult = await db.query(
      `INSERT INTO quiz_attempts (quiz_id, learner_id, status, started_at, answers)
       VALUES ($1, $2, 'in_progress', NOW(), '{}')
       RETURNING *`,
      [quizId, learnerId]
    );

    const attempt = attemptResult.rows[0];

    // Get questions (without correct answers)
    const questionsResult = await db.query(
      `SELECT id, question_text, question_type, options, marks, question_order
       FROM quiz_questions 
       WHERE quiz_id = $1
       ORDER BY question_order`,
      [quizId]
    );

    res.status(201).json({
      success: true,
      message: 'Attempt started',
      data: {
        attemptId: attempt.id,
        quiz: quiz,
        questions: questionsResult.rows,
        timeRemaining: quiz.time_limit_minutes
      }
    });

  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(500).json({ success: false, message: 'Failed to start quiz' });
  }
};

// ============================================
// SAVE ANSWER (Auto-save during quiz)
// ============================================
const saveAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, answer } = req.body;
    const learnerId = req.user.userId;

    // Verify attempt belongs to learner and is in progress
    const attemptResult = await db.query(
      `SELECT qa.*, q.time_limit_minutes 
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1 AND qa.learner_id = $2 AND qa.status = 'in_progress'`,
      [attemptId, learnerId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attempt not found or already completed' });
    }

    const attempt = attemptResult.rows[0];

    // Check time limit
    const startTime = new Date(attempt.started_at);
    const timeElapsed = (new Date() - startTime) / 1000 / 60;
    
    if (timeElapsed > attempt.time_limit_minutes) {
      return res.status(403).json({ success: false, message: 'Time limit exceeded' });
    }

    // Update answers
    const answers = { ...attempt.answers, [questionId]: answer };
    
    await db.query(
      `UPDATE quiz_attempts SET answers = $1 WHERE id = $2`,
      [JSON.stringify(answers), attemptId]
    );

    res.json({ success: true, message: 'Answer saved' });

  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({ success: false, message: 'Failed to save answer' });
  }
};

// ============================================
// SUBMIT QUIZ
// ============================================
const submitQuiz = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers } = req.body;
    const learnerId = req.user.userId;

    // Get attempt with quiz info
    const attemptResult = await db.query(
      `SELECT qa.*, q.passing_score, q.total_marks, q.show_correct_answers
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1 AND qa.learner_id = $2`,
      [attemptId, learnerId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    const attempt = attemptResult.rows[0];

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Attempt already completed' });
    }

    // Get questions with correct answers
    const questionsResult = await db.query(
      `SELECT id, correct_answer, marks FROM quiz_questions WHERE quiz_id = $1`,
      [attempt.quiz_id]
    );

    // Calculate score
    let totalScore = 0;
    const finalAnswers = answers || attempt.answers || {};
    const questionResults = [];

    for (const question of questionsResult.rows) {
      const userAnswer = finalAnswers[question.id];
      const correctAnswer = question.correct_answer;
      let isCorrect = false;
      let marksObtained = 0;

      if (userAnswer !== undefined && userAnswer !== null) {
        // Compare answers (handle different types)
        if (Array.isArray(correctAnswer)) {
          isCorrect = JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort());
        } else {
          isCorrect = String(userAnswer) === String(correctAnswer);
        }

        if (isCorrect) {
          marksObtained = question.marks;
          totalScore += marksObtained;
        }
      }

      questionResults.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: attempt.show_correct_answers ? correctAnswer : null,
        isCorrect,
        marksObtained,
        maxMarks: question.marks
      });
    }

    const percentage = (totalScore / attempt.total_marks) * 100;
    const passed = percentage >= attempt.passing_score;

    // Update attempt
    await db.query(
      `UPDATE quiz_attempts 
       SET status = 'completed',
           completed_at = NOW(),
           answers = $1,
           score = $2,
           percentage = $3,
           passed = $4
       WHERE id = $5`,
      [JSON.stringify(finalAnswers), totalScore, percentage, passed, attemptId]
    );

    // Create notification for learner
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, related_id, created_at)
       VALUES ($1, $2, $3, 'quiz_result', $4, NOW())`,
      [
        learnerId,
        passed ? 'Quiz Passed!' : 'Quiz Results',
        `You scored ${percentage.toFixed(1)}% on the quiz`,
        attempt.quiz_id
      ]
    );

    res.json({
      success: true,
      message: 'Quiz submitted',
      data: {
        attemptId,
        score: totalScore,
        totalMarks: attempt.total_marks,
        percentage: percentage.toFixed(1),
        passed,
        questionResults: attempt.show_correct_answers ? questionResults : questionResults.map(r => ({
          ...r,
          correctAnswer: null
        }))
      }
    });

  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit quiz' });
  }
};

// ============================================
// GET MY QUIZ RESULTS (Learner)
// ============================================
const getMyQuizResults = async (req, res) => {
  try {
    const learnerId = req.user.userId;
    const { quizId } = req.params;

    const result = await db.query(
      `SELECT qa.*, q.title as quiz_title, q.passing_score, q.total_marks
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.learner_id = $1 AND qa.quiz_id = $2 AND qa.status = 'completed'
       ORDER BY qa.completed_at DESC`,
      [learnerId, quizId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get quiz results error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch results' });
  }
};

// ============================================
// GET QUIZ STATISTICS (Teacher)
// ============================================
const getQuizStatistics = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Verify access
    const quiz = await db.query(
      'SELECT teacher_id FROM quizzes WHERE id = $1',
      [quizId]
    );

    if (quiz.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (userRole !== 'admin' && quiz.rows[0].teacher_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get statistics
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_attempts,
        COUNT(CASE WHEN passed = true THEN 1 END) as passed_count,
        AVG(percentage) as average_score,
        MAX(percentage) as highest_score,
        MIN(percentage) as lowest_score
       FROM quiz_attempts
       WHERE quiz_id = $1 AND status = 'completed'`,
      [quizId]
    );

    const stats = statsResult.rows[0];

    // Get recent attempts
    const attemptsResult = await db.query(
      `SELECT qa.*, u.first_name, u.last_name, u.email
       FROM quiz_attempts qa
       JOIN users u ON qa.learner_id = u.id
       WHERE qa.quiz_id = $1 AND qa.status = 'completed'
       ORDER BY qa.completed_at DESC
       LIMIT 20`,
      [quizId]
    );

    res.json({
      success: true,
      data: {
        statistics: {
          ...stats,
          passRate: stats.total_attempts > 0 
            ? ((stats.passed_count / stats.total_attempts) * 100).toFixed(1)
            : 0
        },
        recentAttempts: attemptsResult.rows
      }
    });

  } catch (error) {
    console.error('Get quiz statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};

// ============================================
// HELPER: Create notifications for quiz
// ============================================
const createQuizNotifications = async (subjectId, gradeIds, quizTitle, quizId) => {
  try {
    // Find enrolled students for this subject and grade
    let query = `
      SELECT DISTINCT u.id 
      FROM users u
      JOIN learner_modules lm ON u.id = lm.learner_id
      WHERE lm.module_id = $1 
      AND lm.status = 'active'
    `;
    let params = [subjectId];

    if (gradeIds && gradeIds.length > 0) {
      query += ` AND lm.grade_id = ANY($2)`;
      params.push(gradeIds);
    }

    const students = await db.query(query, params);

    // Create notification for each student
    for (const student of students.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, related_id, created_at)
         VALUES ($1, $2, $3, 'quiz', $4, NOW())`,
        [student.id, 'New Quiz Available', `A new quiz is available: ${quizTitle}`, quizId]
      );
    }

    console.log(`✅ Created ${students.rows.length} quiz notifications`);

  } catch (error) {
    console.error('Error creating quiz notifications:', error);
  }
};

module.exports = {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  startAttempt,
  saveAnswer,
  submitQuiz,
  getMyQuizResults,
  getQuizStatistics
};
