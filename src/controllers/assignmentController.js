const db = require('../config/database');
const https = require('https');

// ============================================
// CREATE ASSIGNMENT (Teacher/Admin only)
// ============================================
const createAssignment = async (req, res) => {
  try {
    const {
      subjectId,
      title,
      description,
      instructions,
      maxMarks,
      passingMarks,
      dueDate,
      availableFrom,
      allowLateSubmission,
      latePenaltyPercent,
      submissionType,
      maxFileSizeMb,
      allowedFileTypes,
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
        `SELECT id FROM teacher_assignments 
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

    // Create assignment
    const result = await db.query(
      `INSERT INTO assignments 
        (subject_id, teacher_id, title, description, instructions, max_marks, passing_marks,
         due_date, available_from, allow_late_submission, late_penalty_percent,
         submission_type, max_file_size_mb, allowed_file_types, applicable_grades, applicable_grade_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        subjectId, teacherId, title, description, instructions,
        maxMarks || 100, passingMarks || 50, dueDate, availableFrom || new Date(),
        allowLateSubmission || false, latePenaltyPercent || 0,
        submissionType || 'file', maxFileSizeMb || 10,
        allowedFileTypes || [], applicableGrades || [], gradeIds
      ]
    );

    const assignment = result.rows[0];

    // Get subject name for notification
    const subjectResult = await db.query(
      'SELECT name FROM modules WHERE id = $1',
      [subjectId]
    );
    const subjectName = subjectResult.rows[0]?.name || 'Your subject';

    // Create notifications for enrolled students
    await createAssignmentNotifications(
      subjectId,
      gradeIds,
      'New Assignment',
      `New assignment in ${subjectName}: ${title}. Due: ${new Date(dueDate).toLocaleDateString()}`,
      assignment.id
    );

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: assignment
    });

  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to create assignment' });
  }
};

// ============================================
// GET ALL ASSIGNMENTS (with filtering)
// ============================================
const getAllAssignments = async (req, res) => {
  try {
    const { subjectId, status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, 
             u.first_name || ' ' || u.last_name as teacher_name,
             m.name as subject_name, m.code as subject_code,
             (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as submission_count,
             (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'graded') as graded_count
      FROM assignments a
      JOIN users u ON a.teacher_id = u.id
      JOIN modules m ON a.subject_id = m.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // For learners - only show published assignments for their enrolled subjects AND grades (same school)
    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT grade_id, school_id FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGradeId = userResult.rows[0]?.grade_id;
      const userSchoolId = userResult.rows[0]?.school_id;
      
      query += ` AND a.is_published = true 
                 AND a.status = 'published'
                 AND a.subject_id IN (
                   SELECT lm.module_id 
                   FROM learner_modules lm
                   JOIN modules m ON lm.module_id = m.id
                   WHERE lm.learner_id = $${++paramCount} 
                   AND lm.status = 'active'
                   AND m.school_id = $${++paramCount}
                 )
                 AND ($${++paramCount} = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
                 AND (a.available_from IS NULL OR a.available_from <= NOW())`;
      params.push(req.user.userId, userSchoolId, userGradeId);
    }

    // Filter by subject
    if (subjectId) {
      query += ` AND a.subject_id = $${++paramCount}`;
      params.push(subjectId);
    }

    // Filter by status
    if (status) {
      query += ` AND a.status = $${++paramCount}`;
      params.push(status);
    }

    // For teachers - only show their own assignments
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

    query += ` ORDER BY a.due_date ASC 
               LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM assignments a WHERE 1=1`;
    let countParams = [];
    let countParamCount = 0;

    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT grade_id, school_id FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGradeId = userResult.rows[0]?.grade_id;
      const userSchoolId = userResult.rows[0]?.school_id;
      
      countQuery += ` AND a.is_published = true 
                      AND a.status = 'published'
                      AND a.subject_id IN (
                        SELECT lm.module_id 
                        FROM learner_modules lm
                        JOIN modules m ON lm.module_id = m.id
                        WHERE lm.learner_id = $${++countParamCount} 
                        AND lm.status = 'active'
                        AND m.school_id = $${++countParamCount}
                      )
                      AND ($${++countParamCount} = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
                      AND (a.available_from IS NULL OR a.available_from <= NOW())`;
      countParams.push(req.user.userId, userSchoolId, userGradeId);
    }

    if (subjectId) {
      countQuery += ` AND a.subject_id = $${++countParamCount}`;
      countParams.push(subjectId);
    }

    if (status) {
      countQuery += ` AND a.status = $${++countParamCount}`;
      countParams.push(status);
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
    console.error('Get assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
  }
};

// ============================================
// GET ASSIGNMENT BY ID
// ============================================
const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const userSchoolId = req.user.schoolId;

    const result = await db.query(
      `SELECT a.*, 
              u.first_name || ' ' || u.last_name as teacher_name,
              m.name as subject_name, m.code as subject_code,
              m.school_id as subject_school_id
       FROM assignments a
       JOIN users u ON a.teacher_id = u.id
       JOIN modules m ON a.subject_id = m.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const assignment = result.rows[0];

    // Verify assignment belongs to user's school (for all users)
    if (userSchoolId && assignment.subject_school_id !== userSchoolId) {
      return res.status(403).json({ success: false, message: 'Assignment not available for your school' });
    }

    // Check access for learners
    if (userRole === 'learner') {
      if (!assignment.is_published || assignment.status !== 'published') {
        return res.status(403).json({ success: false, message: 'Assignment not available' });
      }

      const enrollment = await db.query(
        `SELECT grade_id FROM learner_modules 
         WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
        [userId, assignment.subject_id]
      );
      
      if (enrollment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not enrolled in this subject' });
      }

      const learnerGradeId = enrollment.rows[0].grade_id;
      if (assignment.applicable_grade_ids?.length > 0 && 
          !assignment.applicable_grade_ids.includes(learnerGradeId)) {
        return res.status(403).json({ success: false, message: 'Assignment not available for your grade' });
      }

      // Get learner's submission
      const submissionResult = await db.query(
        `SELECT * FROM assignment_submissions 
         WHERE assignment_id = $1 AND learner_id = $2`,
        [id, userId]
      );

      assignment.mySubmission = submissionResult.rows[0] || null;
    }

    res.json({ success: true, data: assignment });

  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignment' });
  }
};

// ============================================
// UPDATE ASSIGNMENT
// ============================================
const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    // Check ownership
    const existing = await db.query(
      'SELECT teacher_id FROM assignments WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (!['admin', 'school_admin'].includes(req.user.role) && existing.rows[0].teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get grade IDs if applicableGrades changed
    let gradeIds = null;
    if (updateFields.applicableGrades) {
      const gradeResult = await db.query(
        'SELECT id FROM grades WHERE name = ANY($1)',
        [updateFields.applicableGrades]
      );
      gradeIds = gradeResult.rows.map(g => g.id);
    }

    const result = await db.query(
      `UPDATE assignments 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           instructions = COALESCE($3, instructions),
           max_marks = COALESCE($4, max_marks),
           passing_marks = COALESCE($5, passing_marks),
           due_date = COALESCE($6, due_date),
           allow_late_submission = COALESCE($7, allow_late_submission),
           late_penalty_percent = COALESCE($8, late_penalty_percent),
           submission_type = COALESCE($9, submission_type),
           is_published = COALESCE($10, is_published),
           status = COALESCE($11, status),
           applicable_grades = COALESCE($12, applicable_grades),
           applicable_grade_ids = COALESCE($13, applicable_grade_ids),
           updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        updateFields.title, updateFields.description, updateFields.instructions,
        updateFields.maxMarks, updateFields.passingMarks, updateFields.dueDate,
        updateFields.allowLateSubmission, updateFields.latePenaltyPercent,
        updateFields.submissionType, updateFields.isPublished, updateFields.status,
        updateFields.applicableGrades, gradeIds, id
      ]
    );

    res.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to update assignment' });
  }
};

// ============================================
// DELETE ASSIGNMENT
// ============================================
const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query(
      'SELECT teacher_id FROM assignments WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (!['admin', 'school_admin'].includes(req.user.role) && existing.rows[0].teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query('DELETE FROM assignments WHERE id = $1', [id]);

    res.json({ success: true, message: 'Assignment deleted' });

  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete assignment' });
  }
};

// ============================================
// SUBMIT ASSIGNMENT (Learner)
// ============================================
const submitAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const learnerId = req.user.userId;
    
    console.log('[submitAssignment] Starting submission for assignment:', assignmentId);
    console.log('[submitAssignment] Learner:', learnerId);
    console.log('[submitAssignment] Body:', req.body);
    console.log('[submitAssignment] File:', req.file);

    // Get data from body (handles both JSON and FormData)
    const submissionText = req.body.submissionText || req.body.text || null;
    const submissionUrl = req.body.submissionUrl || req.body.url || null;
    const file = req.file;

    // Get assignment details
    const assignmentResult = await db.query(
      `SELECT a.*, m.name as subject_name
       FROM assignments a
       JOIN modules m ON a.subject_id = m.id
       WHERE a.id = $1 AND a.is_published = true AND a.status = 'published'`,
      [assignmentId]
    );

    if (assignmentResult.rows.length === 0) {
      console.log('[submitAssignment] Assignment not found');
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const assignment = assignmentResult.rows[0];
    console.log('[submitAssignment] Found assignment:', assignment.title);

    // Check enrollment
    const enrollment = await db.query(
      `SELECT grade_id FROM learner_modules 
       WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
      [learnerId, assignment.subject_id]
    );

    if (enrollment.rows.length === 0) {
      console.log('[submitAssignment] Not enrolled');
      return res.status(403).json({ success: false, message: 'Not enrolled in this subject' });
    }

    // Check if already submitted
    const existingSubmission = await db.query(
      'SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND learner_id = $2',
      [assignmentId, learnerId]
    );

    if (existingSubmission.rows.length > 0) {
      console.log('[submitAssignment] Already submitted');
      return res.status(400).json({ success: false, message: 'Already submitted' });
    }

    // Check due date
    const now = new Date();
    const dueDate = new Date(assignment.due_date);
    const isLate = now > dueDate;

    if (isLate && !assignment.allow_late_submission) {
      console.log('[submitAssignment] Deadline passed');
      return res.status(403).json({ success: false, message: 'Submission deadline has passed' });
    }

    // Handle file upload data
    let fileUrl = null;
    let fileName = null;
    let originalFilename = null;
    let fileType = null;
    let fileSize = 0;
    
    if (file) {
      console.log('[submitAssignment] File object keys:', Object.keys(file));
      console.log('[submitAssignment] File details:', {
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path ? 'present' : 'missing',
        format: file.format,
        public_id: file.public_id
      });
      
      fileUrl = file.path || file.secure_url || null;
      originalFilename = file.originalname || file.original_name || 'submission';
      fileName = file.filename || file.public_id || null;
      fileType = file.mimetype || file.format || null;
      fileSize = file.size || 0;
      
      // Extract extension for file type detection
      const fileExtension = originalFilename.split('.').pop().toLowerCase();
      if (!fileType && fileExtension) {
        const mimeTypeMap = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'txt': 'text/plain',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'mp4': 'video/mp4',
          'mp3': 'audio/mpeg',
          'zip': 'application/zip'
        };
        fileType = mimeTypeMap[fileExtension] || 'application/octet-stream';
      }
    }

    console.log('[submitAssignment] Inserting submission:', {
      text: submissionText ? 'yes' : 'no',
      url: submissionUrl ? 'yes' : 'no',
      file: fileUrl ? 'yes' : 'no',
      originalFilename: originalFilename
    });

    // Create submission
    const result = await db.query(
      `INSERT INTO assignment_submissions 
        (assignment_id, learner_id, submission_text, submission_url, file_url, file_name, original_filename, file_type, file_size, is_late, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'submitted')
       RETURNING *`,
      [
        assignmentId, learnerId, submissionText, submissionUrl,
        fileUrl, fileName, originalFilename, fileType, fileSize, isLate
      ]
    );

    console.log('[submitAssignment] Submission successful');

    res.status(201).json({
      success: true,
      message: isLate ? 'Assignment submitted (late)' : 'Assignment submitted',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('[submitAssignment] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit assignment: ' + error.message });
  }
};

// ============================================
// GET MY ASSIGNMENTS (Learner) - School Aware
// ============================================
const getMyAssignments = async (req, res) => {
  try {
    const learnerId = req.user.userId;
    const { status } = req.query;

    // Get user's grade and school
    const userResult = await db.query(
      'SELECT grade_id, school_id FROM users WHERE id = $1',
      [learnerId]
    );
    const userGradeId = userResult.rows[0]?.grade_id;
    const userSchoolId = userResult.rows[0]?.school_id;

    let query = `
      SELECT a.*, 
             m.name as subject_name, m.code as subject_code,
             s.id as submission_id,
             s.status as submission_status,
             s.marks_obtained,
             s.submitted_at,
             s.is_late,
             CASE 
               WHEN s.id IS NOT NULL THEN 'submitted'
               WHEN a.due_date < NOW() THEN 'overdue'
               ELSE 'pending'
             END as learner_status
      FROM assignments a
      JOIN modules m ON a.subject_id = m.id
      LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.learner_id = $1
      WHERE a.is_published = true 
      AND a.status = 'published'
      AND a.subject_id IN (
        SELECT lm.module_id 
        FROM learner_modules lm
        JOIN modules mod ON lm.module_id = mod.id
        WHERE lm.learner_id = $1 
        AND lm.status = 'active'
        AND mod.school_id = $2
      )
      AND ($3 = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
      AND (a.available_from IS NULL OR a.available_from <= NOW())
    `;
    let params = [learnerId, userSchoolId, userGradeId];

    // Filter by status
    if (status === 'pending') {
      query += ` AND s.id IS NULL AND a.due_date >= NOW()`;
    } else if (status === 'submitted') {
      query += ` AND s.id IS NOT NULL`;
    } else if (status === 'overdue') {
      query += ` AND s.id IS NULL AND a.due_date < NOW()`;
    }

    query += ` ORDER BY a.due_date ASC`;

    const result = await db.query(query, params);

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
  }
};

// ============================================
// GET UPCOMING DEADLINES (for learner dashboard) - School Aware
// ============================================
const getUpcomingDeadlines = async (req, res) => {
  try {
    const learnerId = req.user.userId;
    const limit = req.query.limit || 5;

    // Get user's grade and school
    const userResult = await db.query(
      'SELECT grade_id, school_id FROM users WHERE id = $1',
      [learnerId]
    );
    const userGradeId = userResult.rows[0]?.grade_id;
    const userSchoolId = userResult.rows[0]?.school_id;

    const query = `
      SELECT a.id, a.title, a.due_date, a.max_marks,
             m.name as subject_name, m.code as subject_code,
             s.status as submission_status,
             'assignment' as type
      FROM assignments a
      JOIN modules m ON a.subject_id = m.id
      LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.learner_id = $1
      WHERE a.is_published = true 
      AND a.status = 'published'
      AND a.subject_id IN (
        SELECT lm.module_id 
        FROM learner_modules lm
        JOIN modules mod ON lm.module_id = mod.id
        WHERE lm.learner_id = $1 
        AND lm.status = 'active'
        AND mod.school_id = $2
      )
      AND ($3 = ANY(a.applicable_grade_ids) OR a.applicable_grade_ids = '{}')
      AND a.due_date >= NOW()
      AND s.id IS NULL
      ORDER BY a.due_date ASC
      LIMIT $4
    `;

    const result = await db.query(query, [learnerId, userSchoolId, userGradeId, limit]);

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get upcoming deadlines error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deadlines' });
  }
};

// ============================================
// GET SUBMISSIONS FOR ASSIGNMENT (Teacher)
// ============================================
const getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const teacherId = req.user.userId;
    const userSchoolId = req.user.schoolId;

    // Verify teacher owns the assignment (and it's in their school)
    const assignmentCheck = await db.query(
      `SELECT a.teacher_id, m.school_id 
       FROM assignments a
       JOIN modules m ON a.subject_id = m.id
       WHERE a.id = $1`,
      [assignmentId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Verify school access
    if (userSchoolId && assignmentCheck.rows[0].school_id !== userSchoolId) {
      return res.status(403).json({ success: false, message: 'Assignment not available for your school' });
    }

    if (!['admin', 'school_admin'].includes(req.user.role) && assignmentCheck.rows[0].teacher_id !== teacherId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await db.query(
      `SELECT s.*, 
              u.first_name, u.last_name, u.email
       FROM assignment_submissions s
       JOIN users u ON s.learner_id = u.id
       WHERE s.assignment_id = $1
       ORDER BY s.submitted_at DESC`,
      [assignmentId]
    );

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
};

// ============================================
// GRADE SUBMISSION (Teacher)
// ============================================
const gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { marksObtained, feedback } = req.body;
    const teacherId = req.user.userId;

    // Verify teacher owns the assignment
    const submissionCheck = await db.query(
      `SELECT s.*, a.teacher_id, a.max_marks, a.late_penalty_percent, a.title as assignment_title,
              u.email as learner_email, u.first_name, u.last_name
       FROM assignment_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       JOIN users u ON s.learner_id = u.id
       WHERE s.id = $1`,
      [submissionId]
    );

    if (submissionCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const submission = submissionCheck.rows[0];

    if (!['admin', 'school_admin'].includes(req.user.role) && submission.teacher_id !== teacherId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Apply late penalty if applicable
    let finalMarks = marksObtained;
    if (submission.is_late && submission.late_penalty_percent > 0) {
      const penalty = (marksObtained * submission.late_penalty_percent) / 100;
      finalMarks = Math.max(0, marksObtained - penalty);
    }

    const result = await db.query(
      `UPDATE assignment_submissions 
       SET marks_obtained = $1,
           feedback = $2,
           status = 'graded',
           graded_at = NOW(),
           graded_by = $3
       WHERE id = $4
       RETURNING *`,
      [finalMarks, feedback, teacherId, submissionId]
    );

    // Create notification for learner
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, related_id, created_at)
       VALUES ($1, $2, $3, 'assignment_graded', $4, NOW())`,
      [
        submission.learner_id,
        'Assignment Graded',
        `Your submission for "${submission.assignment_title}" has been graded. Marks: ${finalMarks}/${submission.max_marks}`,
        submission.assignment_id
      ]
    );

    res.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to grade submission' });
  }
};

// ============================================
// DOWNLOAD SUBMISSION FILE (Teacher)
// ============================================
const downloadSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const teacherId = req.user.userId;
    const userSchoolId = req.user.schoolId;

    console.log('[downloadSubmission] Download request for submission:', submissionId);

    // Get submission with file info and verify teacher owns the assignment
    const submissionCheck = await db.query(
      `SELECT s.*, a.teacher_id, a.title as assignment_title,
              m.school_id, m.name as subject_name,
              u.first_name, u.last_name
       FROM assignment_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       JOIN modules m ON a.subject_id = m.id
       JOIN users u ON s.learner_id = u.id
       WHERE s.id = $1`,
      [submissionId]
    );

    if (submissionCheck.rows.length === 0) {
      console.log('[downloadSubmission] Submission not found');
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const submission = submissionCheck.rows[0];

    // Verify school access
    if (userSchoolId && submission.school_id !== userSchoolId) {
      console.log('[downloadSubmission] School mismatch');
      return res.status(403).json({ success: false, message: 'Submission not available for your school' });
    }

    // Verify teacher owns the assignment or is admin
    if (!['admin', 'school_admin'].includes(req.user.role) && submission.teacher_id !== teacherId) {
      console.log('[downloadSubmission] Not authorized');
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Check if file exists
    if (!submission.file_url) {
      console.log('[downloadSubmission] No file attached to submission');
      return res.status(404).json({ success: false, message: 'No file attached to this submission' });
    }

    console.log('[downloadSubmission] Fetching file from:', submission.file_url);

    // Fetch the file from Cloudinary using built-in https
    const fileUrl = new URL(submission.file_url);
    const fileBuffer = await new Promise((resolve, reject) => {
      https.get(fileUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch file: ${response.statusCode}`));
          return;
        }
        
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });

    // Determine filename
    const originalFilename = submission.original_filename || submission.file_name;
    
    console.log('[downloadSubmission] Filename sources:', {
      original_filename: submission.original_filename,
      file_name: submission.file_name,
      file_type: submission.file_type,
      file_url: submission.file_url ? 'present' : 'missing'
    });
    
    let downloadFilename;
    
    if (originalFilename && originalFilename.includes('.')) {
      downloadFilename = originalFilename;
    } else if (submission.file_type) {
      const ext = submission.file_type.split('/')[1] || 'file';
      downloadFilename = `${originalFilename || 'submission'}.${ext}`;
    } else {
      // Try to extract extension from file_url as last resort
      const urlParts = submission.file_url ? submission.file_url.split('.') : [];
      const urlExt = urlParts.length > 1 ? urlParts[urlParts.length - 1] : null;
      if (urlExt && urlExt.length <= 5) {
        downloadFilename = `${originalFilename || 'submission'}.${urlExt}`;
      } else {
        downloadFilename = originalFilename || 'submission';
      }
    }

    // Create descriptive filename for teacher
    const studentName = `${submission.first_name || ''}_${submission.last_name || ''}`.trim().replace(/\s+/g, '_');
    const assignmentName = (submission.assignment_title || 'assignment').replace(/\s+/g, '_');
    
    // Clean the filename but preserve the extension
    const lastDotIndex = downloadFilename.lastIndexOf('.');
    let baseName, fileExt;
    if (lastDotIndex > 0) {
      baseName = downloadFilename.substring(0, lastDotIndex);
      fileExt = downloadFilename.substring(lastDotIndex + 1);
    } else {
      baseName = downloadFilename;
      fileExt = submission.file_type ? submission.file_type.split('/')[1] : 'file';
    }
    
    // Clean base name (remove special chars but keep it readable)
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_');
    const cleanExt = fileExt.replace(/[^a-zA-Z0-9]/g, '');
    const finalFilename = `${cleanBaseName}.${cleanExt}`;
    
    // Build descriptive filename: Student_Assignment_Filename.ext
    const descriptiveFilename = `${studentName}_${assignmentName}_${finalFilename}`;
    
    // Encode for Content-Disposition header (handle special chars properly)
    const encodedFilename = encodeURIComponent(descriptiveFilename);

    console.log('[downloadSubmission] Serving file:', descriptiveFilename);

    // Set headers for download
    res.setHeader('Content-Type', submission.file_type || 'application/octet-stream');
    // Use simple filename format - ASCII only to avoid encoding issues
    const safeFilename = descriptiveFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    // Send the file
    res.send(fileBuffer);

  } catch (error) {
    console.error('[downloadSubmission] Error:', error);
    console.error('[downloadSubmission] Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to download submission: ' + error.message });
  }
};

// ============================================
// HELPER: Create notifications for assignment
// ============================================
const createAssignmentNotifications = async (subjectId, gradeIds, title, message, assignmentId) => {
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
      query += ` AND lm.grade_id = ANY($2)`;
      params.push(gradeIds);
    }

    const students = await db.query(query, params);

    for (const student of students.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, related_id, created_at)
         VALUES ($1, $2, $3, 'assignment', $4, NOW())`,
        [student.id, title, message, assignmentId]
      );
    }

    console.log(`✅ Created ${students.rows.length} assignment notifications`);

  } catch (error) {
    console.error('Error creating assignment notifications:', error);
  }
};

// ============================================
// EXTEND ASSIGNMENT DUE DATE
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

    // Get current assignment
    const assignmentResult = await db.query(
      `SELECT a.*, m.name as subject_name, m.id as subject_id
       FROM assignments a
       JOIN modules m ON a.subject_id = m.id
       WHERE a.id = $1`,
      [id]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const assignment = assignmentResult.rows[0];

    // Verify teacher owns this assignment
    if (assignment.teacher_id !== teacherId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Store original due date if not already stored
    const originalDueDate = assignment.original_due_date || assignment.due_date;

    // Update assignment with extension
    const updateResult = await db.query(
      `UPDATE assignments 
       SET due_date = $1,
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

    const updatedAssignment = updateResult.rows[0];

    // Get enrolled students to notify
    const studentsResult = await db.query(
      `SELECT DISTINCT lm.learner_id 
       FROM learner_modules lm
       WHERE lm.module_id = $1 
       AND lm.status = 'active'
       AND ($2 = '{}' OR lm.grade_id = ANY($2))`,
      [assignment.subject_id, assignment.applicable_grade_ids]
    );

    const studentIds = studentsResult.rows.map(r => r.learner_id);

    // Create notifications for all enrolled students
    if (studentIds.length > 0) {
      const notificationValues = studentIds.map(studentId => {
        return `('${studentId}', 'deadline_extended', 'Assignment Deadline Extended', 
                'The deadline for "${assignment.title}" in ${assignment.subject_name} has been extended to ${new Date(newDueDate).toLocaleString()}. ${reason ? 'Reason: ' + reason : ''}', 
                false, NOW(), '${assignment.subject_id}', '${id}')`;
      }).join(', ');

      await db.query(
        `INSERT INTO notifications 
          (user_id, type, title, message, is_read, created_at, related_subject_id, related_assignment_id)
         VALUES ${notificationValues}`
      );

      // Log the extension
      await db.query(
        `INSERT INTO due_date_extension_notifications 
          (item_type, item_id, subject_id, teacher_id, original_due_date, new_due_date, reason, notified_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['assignment', id, assignment.subject_id, teacherId, originalDueDate, newDueDate, reason || null, studentIds.length]
      );
    }

    res.json({
      success: true,
      message: `Due date extended successfully. ${studentIds.length} students notified.`,
      data: updatedAssignment
    });

  } catch (error) {
    console.error('Extend due date error:', error);
    res.status(500).json({ success: false, message: 'Failed to extend due date' });
  }
};

module.exports = {
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  getMyAssignments,
  getUpcomingDeadlines,
  getAssignmentSubmissions,
  gradeSubmission,
  downloadSubmission,
  extendDueDate
};
