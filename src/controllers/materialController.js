const db = require('../config/database');
const { deleteFromCloudinary } = require('../config/multer-cloudinary');

// ============================================
// GET ALL MATERIALS (with role-based filtering)
// ============================================
const getAll = async (req, res) => {
  try {
    const { subjectId, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT m.*, u.first_name || ' ' || u.last_name as uploaded_by_name,
             mod.name as subject_name, mod.code as subject_code,
             g.name as grade_name, g.level as grade_level
      FROM materials m
      JOIN users u ON m.uploaded_by = u.id
      JOIN modules mod ON m.subject_id = mod.id
      LEFT JOIN grades g ON m.grade_id = g.id
      WHERE m.is_published = true
    `;
    let params = [];
    let paramCount = 0;

    // For learners - only show materials for:
    // 1. Subjects they are enrolled in
    // 2. Their current grade
    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT current_grade FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGrade = userResult.rows[0]?.current_grade;
      
      query += ` AND m.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $${++paramCount} AND status = 'active'
      )`;
      params.push(req.user.userId);

      // Filter by grade - either grade_id matches or applicable_grades contains user's grade
      if (userGrade) {
        query += ` AND (
          m.grade_id = (SELECT id FROM grades WHERE level = $${++paramCount})
          OR $${++paramCount} = ANY(m.applicable_grades)
          OR m.applicable_grades = '{}'
        )`;
        params.push(userGrade, `Grade ${userGrade}`);
      }
    }

    // Filter by subject
    if (subjectId) {
      query += ` AND m.subject_id = $${++paramCount}`;
      params.push(subjectId);
    }

    // For teachers - show materials for their assigned subjects
    if (req.user.role === 'teacher') {
      query += ` AND m.subject_id IN (
        SELECT subject_id FROM teacher_assignments 
        WHERE teacher_id = $${++paramCount} AND is_active = true AND academic_year = '2026'
      )`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM materials m
      WHERE m.is_published = true
    `;
    let countParams = [];
    let countParamCount = 0;

    if (req.user.role === 'learner') {
      const userResult = await db.query(
        'SELECT current_grade FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGrade = userResult.rows[0]?.current_grade;
      
      countQuery += ` AND m.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $${++countParamCount} AND status = 'active'
      )`;
      countParams.push(req.user.userId);

      if (userGrade) {
        countQuery += ` AND (
          m.grade_id = (SELECT id FROM grades WHERE level = $${++countParamCount})
          OR $${++countParamCount} = ANY(m.applicable_grades)
          OR m.applicable_grades = '{}'
        )`;
        countParams.push(userGrade, `Grade ${userGrade}`);
      }
    }

    if (subjectId) {
      countQuery += ` AND m.subject_id = $${++countParamCount}`;
      countParams.push(subjectId);
    }

    if (req.user.role === 'teacher') {
      countQuery += ` AND m.subject_id IN (
        SELECT subject_id FROM teacher_assignments 
        WHERE teacher_id = $${++countParamCount} AND is_active = true AND academic_year = '2026'
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
    console.error('Get materials error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch materials' });
  }
};

// ============================================
// UPLOAD MATERIAL (Teacher only)
// ============================================
const upload = async (req, res) => {
  try {
    const { subjectId, gradeId, title, description, weekNumber, isPublished } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!subjectId || !gradeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject ID and Grade ID are required' 
      });
    }

    // Verify teacher is assigned to this subject/grade
    if (req.user.role === 'teacher') {
      const assignment = await db.query(
        `SELECT id, is_primary FROM teacher_assignments 
         WHERE teacher_id = $1 AND subject_id = $2 AND grade_id = $3 AND is_active = true`,
        [req.user.userId, subjectId, gradeId]
      );
      if (assignment.rows.length === 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not assigned to this subject/grade combination' 
        });
      }
    }

    // Get grade name for applicable_grades array
    const gradeResult = await db.query(
      'SELECT name FROM grades WHERE id = $1',
      [gradeId]
    );
    const gradeName = gradeResult.rows[0]?.name || '';

    // Store original filename from the uploaded file
    const originalFilename = req.file.originalname || req.file.filename;
    
    // Determine file type from original filename extension
    const fileExtension = originalFilename.split('.').pop().toLowerCase();
    const mimeTypeMap = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'zip': 'application/zip',
      'txt': 'text/plain'
    };
    const fileType = mimeTypeMap[fileExtension] || req.file.mimetype || 'application/octet-stream';

    const result = await db.query(
      `INSERT INTO materials (
        subject_id, grade_id, uploaded_by, title, description, file_url, file_type, 
        file_size_bytes, week_number, is_published, applicable_grades,
        cloudinary_public_id, cloudinary_resource_type, original_filename
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
      RETURNING *`,
      [
        subjectId, gradeId, req.user.userId, title, description, req.file.path, 
        fileType, req.file.size || 0, weekNumber || null, 
        isPublished !== 'false', [gradeName],
        req.file.filename, req.file.resource_type || 'raw',
        originalFilename
      ]
    );

    const material = result.rows[0];

    // Get subject name for notification
    const subjectResult = await db.query(
      'SELECT name FROM modules WHERE id = $1',
      [subjectId]
    );
    const subjectName = subjectResult.rows[0]?.name || 'Your subject';

    // Create notifications for enrolled students
    await createNotificationsForStudents(
      subjectId,
      [gradeName],
      'New Study Material',
      `New material uploaded in ${subjectName}: ${title}`,
      'material',
      subjectId
    );

    res.status(201).json({ success: true, data: material });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
};

// ============================================
// GET MATERIAL BY ID
// ============================================
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as uploaded_by_name,
              s.name as subject_name, s.code as subject_code,
              g.name as grade_name
       FROM materials m 
       JOIN users u ON m.uploaded_by = u.id 
       JOIN subjects s ON m.subject_id = s.id
       LEFT JOIN grades g ON m.grade_id = g.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    // Check access permissions
    const material = result.rows[0];
    
    if (req.user.role === 'learner') {
      // Check enrollment
      const enrollment = await db.query(
        `SELECT 1 FROM learner_modules 
         WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
        [req.user.userId, material.subject_id]
      );
      
      if (enrollment.rows.length === 0 || !material.is_published) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Check grade
      const userResult = await db.query(
        'SELECT current_grade FROM users WHERE id = $1',
        [req.user.userId]
      );
      const userGrade = userResult.rows[0]?.current_grade;
      
      if (material.applicable_grades.length > 0) {
        const gradeMatch = material.applicable_grades.some(g => 
          g.includes(userGrade) || g === `Grade ${userGrade}`
        );
        if (!gradeMatch) {
          return res.status(403).json({ success: false, message: 'Not applicable to your grade' });
        }
      }
    }

    await db.query('UPDATE materials SET view_count = view_count + 1 WHERE id = $1', [id]);
    res.json({ success: true, data: material });
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch material' });
  }
};

// ============================================
// GET MATERIALS BY SUBJECT ID (for learners viewing their enrolled subjects)
// ============================================
const getBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const learnerId = req.user.userId;

    console.log(`[getBySubject] Fetching materials for learner ${learnerId}, subject ${subjectId}`);

    // Get learner's grade info from users table
    const userResult = await db.query(
      `SELECT u.grade_id, u.current_grade, g.name as grade_name, g.level as grade_level
       FROM users u
       LEFT JOIN grades g ON u.grade_id = g.id
       WHERE u.id = $1`,
      [learnerId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const userGrade = userResult.rows[0];
    console.log(`[getBySubject] User grade info:`, userGrade);

    // Verify learner is enrolled in this subject (check learner_modules)
    const enrollmentCheck = await db.query(
      `SELECT lm.*, g.id as grade_id, g.level as grade_level, g.name as grade_name
       FROM learner_modules lm
       JOIN grades g ON lm.grade_id = g.id
       WHERE lm.learner_id = $1 
       AND lm.module_id = $2 
       AND lm.status = 'active'`,
      [learnerId, subjectId]
    );

    if (enrollmentCheck.rows.length === 0) {
      console.log(`[getBySubject] Learner ${learnerId} not enrolled in subject ${subjectId}`);
      return res.status(403).json({ 
        success: false, 
        message: 'You are not enrolled in this subject' 
      });
    }

    const enrollment = enrollmentCheck.rows[0];
    console.log(`[getBySubject] Found enrollment:`, enrollment);

    // Check what materials exist for this subject
    const allMaterialsCheck = await db.query(
      `SELECT id, title, grade_id, applicable_grades, is_published 
       FROM materials WHERE subject_id = $1`,
      [subjectId]
    );
    console.log(`[getBySubject] All materials for subject ${subjectId}:`, allMaterialsCheck.rows);

    // Get ALL published materials for this subject first (no grade filter)
    const allMaterialsResult = await db.query(
      `SELECT m.*, 
              u.first_name || ' ' || u.last_name as uploaded_by_name,
              mod.name as subject_name, 
              mod.code as subject_code,
              g.name as grade_name
       FROM materials m
       JOIN users u ON m.uploaded_by = u.id
       JOIN modules mod ON m.subject_id = mod.id
       LEFT JOIN grades g ON m.grade_id = g.id
       WHERE m.subject_id = $1
       AND m.is_published = true
       ORDER BY m.created_at DESC`,
      [subjectId]
    );
    
    console.log(`[getBySubject] Total published materials for subject: ${allMaterialsResult.rows.length}`);
    
    // Now filter by grade
    const learnerGradeId = enrollment.grade_id;
    const learnerGradeName = enrollment.grade_name;
    const learnerGradeLevel = String(enrollment.grade_level);
    
    console.log(`[getBySubject] Filtering for learner grade: id=${learnerGradeId}, name=${learnerGradeName}, level=${learnerGradeLevel}`);
    
    const filteredMaterials = allMaterialsResult.rows.filter(m => {
      const gradeMatch = m.grade_id === learnerGradeId;
      const applicableMatch = m.applicable_grades && (
        m.applicable_grades.includes(learnerGradeName) ||
        m.applicable_grades.includes(learnerGradeLevel)
      );
      const emptyApplicable = !m.applicable_grades || m.applicable_grades.length === 0;
      
      console.log(`[getBySubject] Material "${m.title}": grade_id=${m.grade_id}, applicable_grades=${JSON.stringify(m.applicable_grades)}, gradeMatch=${gradeMatch}, applicableMatch=${applicableMatch}, emptyApplicable=${emptyApplicable}`);
      
      return gradeMatch || applicableMatch || emptyApplicable;
    });
    
    console.log(`[getBySubject] Found ${filteredMaterials.length} materials after filtering`);

    res.json({
      success: true,
      data: filteredMaterials,
      enrollment: {
        grade: enrollment.grade_name,
        grade_id: enrollment.grade_id,
        academic_year: new Date().getFullYear().toString()
      }
    });
  } catch (error) {
    console.error('Get materials by subject error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch materials for this subject' 
    });
  }
};

// ============================================
// GET MY MATERIALS (for students)
// ============================================
const getMyMaterials = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get user's grade
    const userResult = await db.query(
      'SELECT current_grade FROM users WHERE id = $1',
      [userId]
    );
    const userGrade = userResult.rows[0]?.current_grade;

    const query = `
      SELECT m.*, u.first_name || ' ' || u.last_name as uploaded_by_name,
             s.name as subject_name, s.code as subject_code,
             g.name as grade_name
      FROM materials m
      JOIN users u ON m.uploaded_by = u.id
      JOIN subjects s ON m.subject_id = s.id
      LEFT JOIN grades g ON m.grade_id = g.id
      WHERE m.is_published = true
      AND m.subject_id IN (
        SELECT subject_id FROM enrollments 
        WHERE learner_id = $1 AND status = 'active'
      )
      AND (
        m.grade_id = (SELECT id FROM grades WHERE level = $2)
        OR $3 = ANY(m.applicable_grades)
        OR m.applicable_grades = '{}'
      )
      ORDER BY m.created_at DESC
      LIMIT $4 OFFSET $5
    `;

    const result = await db.query(query, [
      userId,
      userGrade,
      `Grade ${userGrade}`,
      limit,
      offset
    ]);

    // Get count
    const countResult = await db.query(`
      SELECT COUNT(*) FROM materials m
      WHERE m.is_published = true
      AND m.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $1 AND status = 'active'
      )
      AND (
        m.grade_id = (SELECT id FROM grades WHERE level = $2)
        OR $3 = ANY(m.applicable_grades)
        OR m.applicable_grades = '{}'
      )
    `, [userId, userGrade, `Grade ${userGrade}`]);

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
    console.error('Get my materials error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch materials' });
  }
};

// ============================================
// UPDATE MATERIAL
// ============================================
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, weekNumber, isPublished } = req.body;

    const existing = await db.query('SELECT uploaded_by, subject_id FROM materials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    // Check permissions
    if (req.user.role === 'teacher') {
      const assignment = await db.query(
        'SELECT 1 FROM teacher_assignments WHERE teacher_id = $1 AND subject_id = $2 AND is_active = true',
        [req.user.userId, existing.rows[0].subject_id]
      );
      if (assignment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
      }
    } else if (req.user.role !== 'admin' && existing.rows[0].uploaded_by !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await db.query(
      `UPDATE materials SET title = $1, description = $2, week_number = $3, 
       is_published = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`,
      [title, description, weekNumber, isPublished, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// ============================================
// DELETE MATERIAL
// ============================================
const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query(
      'SELECT uploaded_by, subject_id, cloudinary_public_id, cloudinary_resource_type FROM materials WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    // Check permissions
    if (req.user.role === 'teacher') {
      const assignment = await db.query(
        'SELECT 1 FROM teacher_assignments WHERE teacher_id = $1 AND subject_id = $2 AND is_active = true',
        [req.user.userId, existing.rows[0].subject_id]
      );
      if (assignment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
      }
    } else if (req.user.role !== 'admin' && existing.rows[0].uploaded_by !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await deleteFromCloudinary(
      existing.rows[0].cloudinary_public_id,
      existing.rows[0].cloudinary_resource_type
    );

    await db.query('DELETE FROM materials WHERE id = $1', [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Delete failed' });
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
      JOIN learner_modules lm ON u.id = lm.learner_id
      WHERE lm.module_id = $1 
      AND lm.status = 'active'
    `;
    let params = [subjectId];

    if (applicableGrades && applicableGrades.length > 0) {
      query += ` AND lm.grade_id IN (SELECT id FROM grades WHERE name = ANY($2))`;
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

// ============================================
// GET MATERIAL STATS
// ============================================
const getStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get total materials for this learner
    const totalResult = await db.query(`
      SELECT COUNT(*) FROM materials m
      WHERE m.is_published = true
      AND m.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $1 AND status = 'active'
      )
    `, [userId]);
    
    // Get recent materials (last 7 days)
    const recentResult = await db.query(`
      SELECT COUNT(*) FROM materials m
      WHERE m.is_published = true
      AND m.created_at >= NOW() - INTERVAL '7 days'
      AND m.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $1 AND status = 'active'
      )
    `, [userId]);
    
    // Get materials by subject
    const bySubjectResult = await db.query(`
      SELECT m.subject_id, mod.name as subject_name, COUNT(*) as count
      FROM materials m
      JOIN modules mod ON m.subject_id = mod.id
      WHERE m.is_published = true
      AND m.subject_id IN (
        SELECT module_id FROM learner_modules 
        WHERE learner_id = $1 AND status = 'active'
      )
      GROUP BY m.subject_id, mod.name
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].count),
        recent: parseInt(recentResult.rows[0].count),
        bySubject: bySubjectResult.rows
      }
    });
  } catch (error) {
    console.error('Get material stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

// ============================================
// DOWNLOAD MATERIAL - Track download and return file info
// ============================================
const download = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get material with original filename
    const result = await db.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as uploaded_by_name,
              mod.name as subject_name
       FROM materials m 
       JOIN users u ON m.uploaded_by = u.id 
       JOIN modules mod ON m.subject_id = mod.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    const material = result.rows[0];

    // Check access permissions for learners
    if (req.user.role === 'learner') {
      const enrollment = await db.query(
        `SELECT 1 FROM learner_modules 
         WHERE learner_id = $1 AND module_id = $2 AND status = 'active'`,
        [req.user.userId, material.subject_id]
      );
      
      if (enrollment.rows.length === 0 || !material.is_published) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Increment download count
    await db.query('UPDATE materials SET download_count = download_count + 1 WHERE id = $1', [id]);

    // Determine the filename to use
    const originalFilename = material.original_filename || material.title;
    const filename = originalFilename.includes('.') 
      ? originalFilename 
      : `${originalFilename}.${material.file_type?.split('/')[1] || 'pdf'}`;

    // Return file info - use original Cloudinary URL
    res.json({
      success: true,
      data: {
        fileUrl: material.file_url,
        originalFilename: filename,
        fileType: material.file_type,
        title: material.title
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, message: 'Download failed' });
  }
};

module.exports = { 
  getAll, 
  upload, 
  getById, 
  getBySubject,
  getMyMaterials,
  getStats,
  download,
  update, 
  delete: deleteMaterial 
};
