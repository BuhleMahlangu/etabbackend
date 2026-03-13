const db = require('../config/database');

// ============================================
// CREATE ANNOUNCEMENT (Teacher/Admin only)
// ============================================
const createAnnouncement = async (req, res) => {
  try {
    const { subjectId, title, content, applicableGrades, isPinned } = req.body;
    const teacherId = req.user.userId;

    // Validation
    if (!subjectId || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Subject ID, title, and content are required'
      });
    }

    // Verify teacher is assigned to this subject (check teacher_assignments)
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

    // Get grade IDs for applicable grades
    let gradeIds = [];
    if (applicableGrades && applicableGrades.length > 0) {
      const gradeResult = await db.query(
        'SELECT id FROM grades WHERE name = ANY($1)',
        [applicableGrades]
      );
      gradeIds = gradeResult.rows.map(g => g.id);
    }

    // Create announcement
    const result = await db.query(
      `INSERT INTO announcements 
        (subject_id, teacher_id, title, content, applicable_grades, applicable_grade_ids, is_pinned, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [
        subjectId,
        teacherId,
        title,
        content,
        applicableGrades || [],
        gradeIds,
        isPinned || false
      ]
    );

    const announcement = result.rows[0];

    // Get subject details for notification
    const subjectResult = await db.query(
      'SELECT name, code FROM modules WHERE id = $1',
      [subjectId]
    );
    const subjectName = subjectResult.rows[0]?.name || 'Your subject';

    // Create notifications for enrolled students
    await createNotificationsForStudents(
      subjectId,
      gradeIds,
      'New Announcement',
      `New announcement in ${subjectName}: ${title}`,
      'announcement',
      announcement.id
    );

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });

  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

// ============================================
// GET ALL ANNOUNCEMENTS (with filtering)
// ============================================
const getAllAnnouncements = async (req, res) => {
  try {
    const { subjectId, gradeId, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, 
             u.first_name || ' ' || u.last_name as teacher_name,
             m.name as subject_name, m.code as subject_code
      FROM announcements a
      JOIN users u ON a.teacher_id = u.id
      JOIN modules m ON a.subject_id = m.id
      WHERE a.is_active = true
    `;
    let params = [];
    let paramCount = 0;

    // For learners - only show announcements for their enrolled subjects AND grade
    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT grade_id FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGradeId = userResult.rows[0]?.grade_id;
      
      query += ` AND (
        a.subject_id IN (
          SELECT module_id FROM learner_modules 
          WHERE learner_id = $${++paramCount} AND status = 'active'
        )
        AND ($${++paramCount} = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
      )`;
      params.push(req.user.userId, userGradeId);
    }

    // Filter by subject
    if (subjectId) {
      query += ` AND a.subject_id = $${++paramCount}`;
      params.push(subjectId);
    }

    // Filter by grade (for teachers/admins)
    if (gradeId && req.user.role !== 'learner') {
      query += ` AND $${++paramCount} = ANY(a.applicable_grade_ids)`;
      params.push(gradeId);
    }

    // For teachers - only show their own announcements or for their assigned subjects
    if (req.user.role === 'teacher') {
      query += ` AND (
        a.teacher_id = $${++paramCount}
        OR a.subject_id IN (
          SELECT subject_id FROM teacher_assignments 
          WHERE teacher_id = $${paramCount} AND is_active = true
        )
      )`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY a.is_pinned DESC, a.created_at DESC 
               LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM announcements a
      WHERE a.is_active = true
    `;
    let countParams = [];
    let countParamCount = 0;

    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT grade_id FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGradeId = userResult.rows[0]?.grade_id;
      
      countQuery += ` AND (
        a.subject_id IN (
          SELECT module_id FROM learner_modules 
          WHERE learner_id = $${++countParamCount} AND status = 'active'
        )
        AND ($${++countParamCount} = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
      )`;
      countParams.push(req.user.userId, userGradeId);
    }

    if (subjectId) {
      countQuery += ` AND a.subject_id = $${++countParamCount}`;
      countParams.push(subjectId);
    }

    if (req.user.role === 'teacher') {
      countQuery += ` AND (
        a.teacher_id = $${++countParamCount}
        OR a.subject_id IN (
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
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
};

// ============================================
// GET ANNOUNCEMENT BY ID
// ============================================
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT a.*, 
              u.first_name || ' ' || u.last_name as teacher_name,
              m.name as subject_name, m.code as subject_code
       FROM announcements a
       JOIN users u ON a.teacher_id = u.id
       JOIN modules m ON a.subject_id = m.id
       WHERE a.id = $1 AND a.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const announcement = result.rows[0];

    // Check access for learners
    if (req.user.role === 'learner') {
      const enrollment = await db.query(
        `SELECT 1 FROM learner_modules 
         WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
        [req.user.userId, announcement.subject_id]
      );
      
      if (enrollment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Check grade
      const userResult = await db.query(
        'SELECT grade_id FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGradeId = userResult.rows[0]?.grade_id;
      
      if (announcement.applicable_grade_ids.length > 0 && 
          !announcement.applicable_grade_ids.includes(userGradeId)) {
        return res.status(403).json({ success: false, message: 'Not applicable to your grade' });
      }
    }

    // Increment view count
    await db.query('UPDATE announcements SET view_count = view_count + 1 WHERE id = $1', [id]);

    res.json({ success: true, data: announcement });

  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcement' });
  }
};

// ============================================
// UPDATE ANNOUNCEMENT
// ============================================
const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, applicableGrades, isPinned, isActive } = req.body;

    // Check ownership
    const existing = await db.query(
      'SELECT teacher_id, subject_id FROM announcements WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
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
      `UPDATE announcements 
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           applicable_grades = COALESCE($3, applicable_grades),
           applicable_grade_ids = COALESCE($7, applicable_grade_ids),
           is_pinned = COALESCE($4, is_pinned),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [title, content, applicableGrades, isPinned, isActive, id, gradeIds]
    );

    res.json({
      success: true,
      message: 'Announcement updated',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
};

// ============================================
// DELETE ANNOUNCEMENT
// ============================================
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await db.query(
      'SELECT teacher_id FROM announcements WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    // Only owner or admin can delete
    if (req.user.role !== 'admin' && existing.rows[0].teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query('DELETE FROM announcements WHERE id = $1', [id]);

    res.json({ success: true, message: 'Announcement deleted' });

  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete announcement' });
  }
};

// ============================================
// GET MY ANNOUNCEMENTS (for learners)
// ============================================
const getMyAnnouncements = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get user's grade
    const userResult = await db.query(
      'SELECT grade_id FROM users WHERE id = $1',
      [userId]
    );
    const userGradeId = userResult.rows[0]?.grade_id;

    const query = `
      SELECT a.*, 
             u.first_name || ' ' || u.last_name as teacher_name,
             m.name as subject_name, m.code as subject_code
      FROM announcements a
      JOIN users u ON a.teacher_id = u.id
      JOIN modules m ON a.subject_id = m.id
      WHERE a.is_active = true
      AND a.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $1 AND status = 'active'
      )
      AND ($2 = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
      ORDER BY a.is_pinned DESC, a.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await db.query(query, [
      userId,
      userGradeId,
      limit,
      offset
    ]);

    // Get count
    const countResult = await db.query(`
      SELECT COUNT(*) FROM announcements a
      WHERE a.is_active = true
      AND a.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $1 AND status = 'active'
      )
      AND ($2 = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
    `, [userId, userGradeId]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });

  } catch (error) {
    console.error('Get my announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
};

// ============================================
// GET RECENT ANNOUNCEMENTS (for dashboard)
// ============================================
const getRecentAnnouncements = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = req.query.limit || 5;

    // Get user's grade
    const userResult = await db.query(
      'SELECT grade_id FROM users WHERE id = $1',
      [userId]
    );
    const userGradeId = userResult.rows[0]?.grade_id;

    const query = `
      SELECT a.*, 
             u.first_name || ' ' || u.last_name as teacher_name,
             m.name as subject_name, m.code as subject_code
      FROM announcements a
      JOIN users u ON a.teacher_id = u.id
      JOIN modules m ON a.subject_id = m.id
      WHERE a.is_active = true
      AND a.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $1 AND status = 'active'
      )
      AND ($2 = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
      ORDER BY a.is_pinned DESC, a.created_at DESC
      LIMIT $3
    `;

    const result = await db.query(query, [userId, userGradeId, limit]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get recent announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
};

// ============================================
// HELPER: Create notifications for students
// ============================================
const createNotificationsForStudents = async (
  subjectId,
  gradeIds,
  title,
  message,
  type,
  relatedId
) => {
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
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [student.id, title, message, type, relatedId]
      );
    }

    console.log(`✅ Created ${students.rows.length} notifications for ${type}`);

  } catch (error) {
    console.error('Error creating notifications:', error);
    // Don't throw - notification failure shouldn't break the main operation
  }
};

module.exports = {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  getMyAnnouncements,
  getRecentAnnouncements,
  createNotificationsForStudents
};
