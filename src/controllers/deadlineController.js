const db = require('../config/database');

// ============================================
// CREATE DEADLINE (Teacher/Admin only)
// ============================================
const createDeadline = async (req, res) => {
  try {
    const { 
      subjectId, 
      gradeId,
      title, 
      description, 
      dueDate, 
      maxMarks, 
      weightPercentage,
      applicableGrades 
    } = req.body;
    
    const teacherId = req.user.userId;

    // Validation
    if (!subjectId || !title || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Subject ID, title, and due date are required'
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

    // Get grade name for applicable_grades
    let gradeName = '';
    if (gradeId) {
      const gradeResult = await db.query(
        'SELECT name FROM grades WHERE id = $1',
        [gradeId]
      );
      gradeName = gradeResult.rows[0]?.name || '';
    }

    const result = await db.query(
      `INSERT INTO deadlines (
        subject_id, teacher_id, grade_id, title, description, 
        due_date, max_marks, weight_percentage, applicable_grades
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        subjectId,
        teacherId,
        gradeId || null,
        title,
        description || '',
        dueDate,
        maxMarks || 100,
        weightPercentage || 0,
        applicableGrades || (gradeName ? [gradeName] : [])
      ]
    );

    const deadline = result.rows[0];

    // Get subject name for notification
    const subjectResult = await db.query(
      'SELECT name FROM subjects WHERE id = $1',
      [subjectId]
    );
    const subjectName = subjectResult.rows[0]?.name || 'Your subject';

    // Create notifications for enrolled students
    await createNotificationsForStudents(
      subjectId,
      applicableGrades || [gradeName],
      'New Deadline',
      `New deadline in ${subjectName}: ${title} (Due: ${new Date(dueDate).toLocaleDateString()})`,
      'deadline',
      subjectId
    );

    res.status(201).json({
      success: true,
      message: 'Deadline created successfully',
      data: deadline
    });

  } catch (error) {
    console.error('Create deadline error:', error);
    res.status(500).json({ success: false, message: 'Failed to create deadline' });
  }
};

// ============================================
// GET ALL DEADLINES (with role-based filtering)
// ============================================
const getAllDeadlines = async (req, res) => {
  try {
    const { subjectId, status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT d.*, 
             u.first_name || ' ' || u.last_name as teacher_name,
             s.name as subject_name, s.code as subject_code,
             g.name as grade_name
      FROM deadlines d
      JOIN users u ON d.teacher_id = u.id
      JOIN subjects s ON d.subject_id = s.id
      LEFT JOIN grades g ON d.grade_id = g.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // For learners - only show deadlines for:
    // 1. Subjects they are enrolled in
    // 2. Their current grade
    // 3. Not yet passed
    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT current_grade FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGrade = userResult.rows[0]?.current_grade;
      
      query += ` AND d.subject_id IN (
        SELECT subject_id FROM enrollments 
        WHERE learner_id = $${++paramCount} AND status = 'active'
      )`;
      params.push(req.user.userId);

      // Filter by grade
      if (userGrade) {
        query += ` AND (
          d.grade_id = (SELECT id FROM grades WHERE level = $${++paramCount})
          OR $${++paramCount} = ANY(d.applicable_grades)
          OR d.applicable_grades = '{}'
        )`;
        params.push(userGrade, `Grade ${userGrade}`);
      }

      // Only show upcoming deadlines
      if (status === 'upcoming') {
        query += ` AND d.due_date > NOW()`;
      }
    }

    // Filter by subject
    if (subjectId) {
      query += ` AND d.subject_id = $${++paramCount}`;
      params.push(subjectId);
    }

    // For teachers - show deadlines for their assigned subjects
    if (req.user.role === 'teacher') {
      query += ` AND d.subject_id IN (
        SELECT subject_id FROM teacher_assignments 
        WHERE teacher_id = $${++paramCount} AND is_active = true
      )`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY d.due_date ASC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM deadlines d
      WHERE 1=1
    `;
    let countParams = [];
    let countParamCount = 0;

    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT current_grade FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGrade = userResult.rows[0]?.current_grade;
      
      countQuery += ` AND d.subject_id IN (
        SELECT subject_id FROM enrollments 
        WHERE learner_id = $${++countParamCount} AND status = 'active'
      )`;
      countParams.push(req.user.userId);

      if (userGrade) {
        countQuery += ` AND (
          d.grade_id = (SELECT id FROM grades WHERE level = $${++countParamCount})
          OR $${++countParamCount} = ANY(d.applicable_grades)
          OR d.applicable_grades = '{}'
        )`;
        countParams.push(userGrade, `Grade ${userGrade}`);
      }
    }

    if (subjectId) {
      countQuery += ` AND d.subject_id = $${++countParamCount}`;
      countParams.push(subjectId);
    }

    if (req.user.role === 'teacher') {
      countQuery += ` AND d.subject_id IN (
        SELECT subject_id FROM teacher_assignments 
        WHERE teacher_id = $${++countParamCount} AND is_active = true
      )`;
      countParams.push(req.user.userId);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add status to each deadline
    const deadlinesWithStatus = result.rows.map(d => ({
      ...d,
      status: new Date(d.due_date) > new Date() ? 'upcoming' : 'passed',
      daysRemaining: Math.ceil((new Date(d.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      success: true,
      data: deadlinesWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get deadlines error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deadlines' });
  }
};

// ============================================
// GET DEADLINE BY ID
// ============================================
const getDeadlineById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT d.*, 
              u.first_name || ' ' || u.last_name as teacher_name,
              s.name as subject_name, s.code as subject_code,
              g.name as grade_name
       FROM deadlines d
       JOIN users u ON d.teacher_id = u.id
       JOIN subjects s ON d.subject_id = s.id
       LEFT JOIN grades g ON d.grade_id = g.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deadline not found' });
    }

    const deadline = result.rows[0];

    // Check access for learners
    if (req.user.role === 'learner') {
      const enrollment = await db.query(
        `SELECT 1 FROM enrollments 
         WHERE learner_id = $1 AND subject_id = $2 AND status = 'active'`,
        [req.user.userId, deadline.subject_id]
      );
      
      if (enrollment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Check grade
      const userResult = await db.query(
        'SELECT current_grade FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGrade = userResult.rows[0]?.current_grade;
      
      if (deadline.applicable_grades.length > 0) {
        const gradeMatch = deadline.applicable_grades.some(g => 
          g.includes(userGrade) || g === `Grade ${userGrade}`
        );
        if (!gradeMatch) {
          return res.status(403).json({ success: false, message: 'Not applicable to your grade' });
        }
      }
    }

    // Add computed fields
    const deadlineWithMeta = {
      ...deadline,
      status: new Date(deadline.due_date) > new Date() ? 'upcoming' : 'passed',
      daysRemaining: Math.ceil((new Date(deadline.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    };

    res.json({ success: true, data: deadlineWithMeta });

  } catch (error) {
    console.error('Get deadline error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deadline' });
  }
};

// ============================================
// UPDATE DEADLINE
// ============================================
const updateDeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, maxMarks, weightPercentage } = req.body;

    // Check ownership
    const existing = await db.query(
      'SELECT teacher_id, subject_id FROM deadlines WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deadline not found' });
    }

    // Only owner or admin can update
    if (req.user.role !== 'admin' && existing.rows[0].teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await db.query(
      `UPDATE deadlines 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           due_date = COALESCE($3, due_date),
           max_marks = COALESCE($4, max_marks),
           weight_percentage = COALESCE($5, weight_percentage)
       WHERE id = $6
       RETURNING *`,
      [title, description, dueDate, maxMarks, weightPercentage, id]
    );

    res.json({
      success: true,
      message: 'Deadline updated',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update deadline error:', error);
    res.status(500).json({ success: false, message: 'Failed to update deadline' });
  }
};

// ============================================
// DELETE DEADLINE
// ============================================
const deleteDeadline = async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await db.query(
      'SELECT teacher_id FROM deadlines WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deadline not found' });
    }

    // Only owner or admin can delete
    if (req.user.role !== 'admin' && existing.rows[0].teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query('DELETE FROM deadlines WHERE id = $1', [id]);

    res.json({ success: true, message: 'Deadline deleted' });

  } catch (error) {
    console.error('Delete deadline error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete deadline' });
  }
};

// ============================================
// GET MY DEADLINES (for students)
// ============================================
const getMyDeadlines = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get user's grade
    const userResult = await db.query(
      'SELECT current_grade FROM users WHERE id = $1',
      [userId]
    );
    const userGrade = userResult.rows[0]?.current_grade;

    let query = `
      SELECT d.*, 
             u.first_name || ' ' || u.last_name as teacher_name,
             s.name as subject_name, s.code as subject_code,
             g.name as grade_name
      FROM deadlines d
      JOIN users u ON d.teacher_id = u.id
      JOIN subjects s ON d.subject_id = s.id
      LEFT JOIN grades g ON d.grade_id = g.id
      WHERE d.subject_id IN (
        SELECT subject_id FROM enrollments 
        WHERE learner_id = $1 AND status = 'active'
      )
      AND (
        d.grade_id = (SELECT id FROM grades WHERE level = $2)
        OR $3 = ANY(d.applicable_grades)
        OR d.applicable_grades = '{}'
      )
    `;
    let params = [userId, userGrade, `Grade ${userGrade}`];

    // Filter by status
    if (status === 'upcoming') {
      query += ` AND d.due_date > NOW()`;
    } else if (status === 'passed') {
      query += ` AND d.due_date <= NOW()`;
    }

    query += ` ORDER BY d.due_date ASC LIMIT $4 OFFSET $5`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get count
    let countQuery = `
      SELECT COUNT(*) FROM deadlines d
      WHERE d.subject_id IN (
        SELECT subject_id FROM enrollments 
        WHERE learner_id = $1 AND status = 'active'
      )
      AND (
        d.grade_id = (SELECT id FROM grades WHERE level = $2)
        OR $3 = ANY(d.applicable_grades)
        OR d.applicable_grades = '{}'
      )
    `;
    let countParams = [userId, userGrade, `Grade ${userGrade}`];

    if (status === 'upcoming') {
      countQuery += ` AND d.due_date > NOW()`;
    } else if (status === 'passed') {
      countQuery += ` AND d.due_date <= NOW()`;
    }

    const countResult = await db.query(countQuery, countParams);

    // Add computed fields
    const deadlinesWithMeta = result.rows.map(d => ({
      ...d,
      status: new Date(d.due_date) > new Date() ? 'upcoming' : 'passed',
      daysRemaining: Math.ceil((new Date(d.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      success: true,
      data: deadlinesWithMeta,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });

  } catch (error) {
    console.error('Get my deadlines error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deadlines' });
  }
};

// ============================================
// GET DEADLINES BY SUBJECT
// ============================================
const getDeadlinesBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Check if user has access to this subject
    if (req.user.role === 'learner') {
      const enrollment = await db.query(
        `SELECT 1 FROM enrollments 
         WHERE learner_id = $1 AND subject_id = $2 AND status = 'active'`,
        [req.user.userId, subjectId]
      );
      
      if (enrollment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not enrolled in this subject' });
      }
    } else if (req.user.role === 'teacher') {
      const assignment = await db.query(
        `SELECT 1 FROM teacher_assignments 
         WHERE teacher_id = $1 AND subject_id = $2 AND is_active = true`,
        [req.user.userId, subjectId]
      );
      
      if (assignment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not assigned to this subject' });
      }
    }

    const result = await db.query(
      `SELECT d.*, 
              u.first_name || ' ' || u.last_name as teacher_name,
              s.name as subject_name
       FROM deadlines d
       JOIN users u ON d.teacher_id = u.id
       JOIN subjects s ON d.subject_id = s.id
       WHERE d.subject_id = $1
       ORDER BY d.due_date ASC
       LIMIT $2 OFFSET $3`,
      [subjectId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM deadlines WHERE subject_id = $1',
      [subjectId]
    );

    const deadlinesWithMeta = result.rows.map(d => ({
      ...d,
      status: new Date(d.due_date) > new Date() ? 'upcoming' : 'passed',
      daysRemaining: Math.ceil((new Date(d.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      success: true,
      data: deadlinesWithMeta,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });

  } catch (error) {
    console.error('Get deadlines by subject error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deadlines' });
  }
};

// ============================================
// HELPER: Create notifications for students
// ============================================
const createNotificationsForStudents = async (
  subjectId,
  applicableGrades,
  title,
  message,
  type,
  relatedSubjectId
) => {
  try {
    // Find enrolled students for this subject and grade
    let query = `
      SELECT DISTINCT u.id 
      FROM users u
      JOIN enrollments e ON u.id = e.learner_id
      WHERE e.subject_id = $1 
      AND e.status = 'active'
    `;
    let params = [subjectId];

    if (applicableGrades && applicableGrades.length > 0) {
      query += ` AND e.grade = ANY($2)`;
      params.push(applicableGrades);
    }

    const students = await db.query(query, params);

    // Create notification for each student
    for (const student of students.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, related_subject_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [student.id, title, message, type, relatedSubjectId]
      );
    }

    console.log(`✅ Created ${students.rows.length} notifications for ${type}`);

  } catch (error) {
    console.error('Error creating notifications:', error);
  }
};

// Legacy function for backward compatibility
const getForLearner = async (req, res) => {
  try {
    const { learnerId } = req.params;
    
    const result = await db.query(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d
      JOIN subjects s ON d.subject_id = s.id
      WHERE d.subject_id IN (
        SELECT subject_id FROM enrollments 
        WHERE learner_id = $1 AND status = 'active'
      )
      AND d.due_date > NOW()
      ORDER BY d.due_date ASC
    `, [learnerId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get deadlines for learner error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deadlines' });
  }
};

module.exports = {
  createDeadline,
  getAllDeadlines,
  getDeadlineById,
  updateDeadline,
  deleteDeadline,
  getMyDeadlines,
  getDeadlinesBySubject,
  getForLearner
};
