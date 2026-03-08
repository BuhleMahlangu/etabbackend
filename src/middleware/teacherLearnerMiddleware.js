const db = require('../config/database');

/**
 * Middleware to ensure teachers can only access learners in their assigned grades/subjects
 * This validates that the teacher has an active assignment for the learner's grade AND subject
 */
const validateTeacherLearnerAccess = async (req, res, next) => {
  try {
    const teacherId = req.user.userId;
    const { learnerId, gradeId, subjectId } = req.params;
    
    // If no specific learner/grade/subject requested, skip validation
    if (!learnerId && !gradeId && !subjectId) {
      return next();
    }

    const academicYear = new Date().getFullYear().toString();

    // Build query based on what's provided
    let query = `
      SELECT 1 
      FROM teacher_assignments ta
      WHERE ta.teacher_id = $1::uuid
      AND ta.academic_year = $2
      AND ta.is_active = true
    `;
    
    const params = [teacherId, academicYear];

    // If specific subject requested, check teacher teaches it
    if (subjectId) {
      query += ` AND ta.subject_id = $${params.length + 1}::uuid`;
      params.push(subjectId);
    }

    // If specific grade requested, check teacher teaches in it
    if (gradeId) {
      query += ` AND ta.grade_id = $${params.length + 1}::uuid`;
      params.push(gradeId);
    }

    // If learnerId provided, verify learner is in teacher's grade AND taking teacher's subject
    if (learnerId) {
      query = `
        SELECT 1 
        FROM teacher_assignments ta
        JOIN learner_modules lm ON ta.grade_id = lm.grade_id 
          AND ta.subject_id = lm.module_id
        WHERE ta.teacher_id = $1::uuid
        AND ta.academic_year = $2
        AND ta.is_active = true
        AND lm.learner_id = $3::uuid
        AND lm.status = 'active'
      `;
      params.push(learnerId);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not assigned to teach this learner/grade/subject'
      });
    }

    next();
  } catch (error) {
    console.error('Error in teacher-learner access validation:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating access permissions'
    });
  }
};

/**
 * Get all learners that a teacher is eligible to teach
 * (learners in teacher's grades who are taking teacher's subjects)
 */
const getTeacherLearners = async (teacherId, options = {}) => {
  const { gradeId, subjectId, search, page = 1, limit = 20 } = options;
  const academicYear = new Date().getFullYear().toString();
  
  let query = `
    SELECT DISTINCT
      u.id as learner_id,
      u.first_name,
      u.last_name,
      u.email,
      g.id as grade_id,
      g.name as grade_name,
      g.level as grade_level,
      m.id as subject_id,
      m.code as subject_code,
      m.name as subject_name,
      m.department,
      ta.is_primary as is_primary_teacher
    FROM teacher_assignments ta
    JOIN grades g ON ta.grade_id = g.id
    JOIN modules m ON ta.subject_id = m.id
    JOIN learner_modules lm ON ta.grade_id = lm.grade_id 
      AND ta.subject_id = lm.module_id
    JOIN users u ON lm.learner_id = u.id
    WHERE ta.teacher_id = $1::uuid
    AND ta.academic_year = $2
    AND ta.is_active = true
    AND lm.status = 'active'
    AND u.role = 'learner'
    AND u.is_active = true
  `;
  
  const params = [teacherId, academicYear];
  let paramCount = 2;

  if (gradeId) {
    query += ` AND g.id = $${++paramCount}::uuid`;
    params.push(gradeId);
  }

  if (subjectId) {
    query += ` AND m.id = $${++paramCount}::uuid`;
    params.push(subjectId);
  }

  if (search) {
    query += ` AND (
      u.first_name ILIKE $${++paramCount} 
      OR u.last_name ILIKE $${paramCount}
      OR u.email ILIKE $${paramCount}
    )`;
    params.push(`%${search}%`);
  }

  // Get total count for pagination
  const countResult = await db.query(
    `SELECT COUNT(*) FROM (${query}) as count_query`,
    params
  );
  const totalCount = parseInt(countResult.rows[0].count);

  // Add pagination
  query += ` ORDER BY g.level, m.department, u.last_name, u.first_name`;
  query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
  params.push(limit, (page - 1) * limit);

  const result = await db.query(query, params);

  return {
    learners: result.rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

/**
 * Check if teacher can teach a specific learner in a specific subject
 */
const canTeachLearner = async (teacherId, learnerId, subjectId) => {
  const academicYear = new Date().getFullYear().toString();
  
  const result = await db.query(`
    SELECT 1 
    FROM teacher_assignments ta
    JOIN learner_modules lm ON ta.grade_id = lm.grade_id 
      AND ta.subject_id = lm.module_id
    WHERE ta.teacher_id = $1::uuid
    AND ta.academic_year = $2
    AND ta.is_active = true
    AND ta.subject_id = $3::uuid
    AND lm.learner_id = $4::uuid
    AND lm.status = 'active'
    LIMIT 1
  `, [teacherId, academicYear, subjectId, learnerId]);

  return result.rows.length > 0;
};

module.exports = {
  validateTeacherLearnerAccess,
  getTeacherLearners,
  canTeachLearner
};