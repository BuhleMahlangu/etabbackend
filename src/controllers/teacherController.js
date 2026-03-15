const db = require('../config/database');

// ============================================
// GET TEACHER'S STUDENTS
// ============================================
const getMyStudents = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    // Get teacher's subject assignments
    const assignmentsQuery = `
      SELECT ta.subject_id, ta.grade_id, m.name as subject_name, g.name as grade_name
      FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      JOIN grades g ON ta.grade_id = g.id
      WHERE ta.teacher_id = $1 AND ta.is_active = true
    `;
    const assignments = await db.query(assignmentsQuery, [teacherId]);

    if (assignments.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No subject assignments found'
      });
    }

    // Get all students enrolled in these subjects
    const subjectIds = assignments.rows.map(a => a.subject_id);

    // Simpler query without json_agg
    const studentsQuery = `
      SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.grade_id,
        g.name as grade_name,
        lm.enrolled_at,
        lm.completion_percentage as overall_progress
      FROM users u
      JOIN learner_modules lm ON u.id = lm.learner_id
      JOIN grades g ON u.grade_id = g.id
      WHERE lm.module_id = ANY($1)
        AND lm.status = 'active'
        AND u.role = 'learner'
      ORDER BY u.last_name, u.first_name
    `;

    const students = await db.query(studentsQuery, [subjectIds]);

    // Get enrolled subjects for each student separately
    for (let student of students.rows) {
      const subjectsQuery = `
        SELECT m.id as subject_id, m.name as subject_name, m.code as subject_code
        FROM learner_modules lm
        JOIN modules m ON lm.module_id = m.id
        WHERE lm.learner_id = $1 
          AND lm.status = 'active'
          AND m.id = ANY($2)
      `;
      const subjectsResult = await db.query(subjectsQuery, [student.id, subjectIds]);
      student.enrolled_subjects = subjectsResult.rows;
    }

    res.json({
      success: true,
      data: students.rows
    });

  } catch (error) {
    console.error('Get my students error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch students: ' + error.message 
    });
  }
};

// ============================================
// GET TEACHER'S ASSIGNMENTS (SUBJECTS THEY TEACH)
// ============================================
const getMyAssignments = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    const query = `
      SELECT 
        g.id as grade_id,
        g.name as grade_name,
        m.id as subject_id,
        m.name as subject_name,
        m.code as subject_code,
        ta.is_primary
      FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      JOIN grades g ON ta.grade_id = g.id
      WHERE ta.teacher_id = $1 
        AND ta.is_active = true
      ORDER BY g.level, m.name
    `;

    const result = await db.query(query, [teacherId]);

    // Group by grade
    const grouped = result.rows.reduce((acc, row) => {
      const existing = acc.find(g => g.gradeId === row.grade_id);
      const subject = {
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        subjectCode: row.subject_code,
        isPrimary: row.is_primary
      };
      
      if (existing) {
        existing.subjects.push(subject);
      } else {
        acc.push({
          gradeId: row.grade_id,
          gradeName: row.grade_name,
          subjects: [subject]
        });
      }
      return acc;
    }, []);

    res.json({
      success: true,
      grades: grouped
    });

  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
  }
};

// ============================================
// GET TEACHER DASHBOARD STATS
// ============================================
const getDashboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    // Get total students taught
    const studentsQuery = `
      SELECT COUNT(DISTINCT lm.learner_id)
      FROM teacher_assignments ta
      JOIN learner_modules lm ON ta.subject_id = lm.module_id
      WHERE ta.teacher_id = $1 AND ta.is_active = true
        AND lm.status = 'active'
    `;
    const studentsResult = await db.query(studentsQuery, [teacherId]);

    // Get total subjects
    const subjectsQuery = `
      SELECT COUNT(*) FROM teacher_assignments
      WHERE teacher_id = $1 AND is_active = true
    `;
    const subjectsResult = await db.query(subjectsQuery, [teacherId]);

    // Get recent assignments
    const assignmentsQuery = `
      SELECT COUNT(*) FROM assignments
      WHERE teacher_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    `;
    const assignmentsResult = await db.query(assignmentsQuery, [teacherId]);

    // Get pending submissions to grade
    const pendingQuery = `
      SELECT COUNT(*) FROM assignment_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.teacher_id = $1 AND s.status = 'submitted'
    `;
    const pendingResult = await db.query(pendingQuery, [teacherId]);

    res.json({
      success: true,
      stats: {
        totalStudents: parseInt(studentsResult.rows[0].count),
        totalSubjects: parseInt(subjectsResult.rows[0].count),
        recentAssignments: parseInt(assignmentsResult.rows[0].count),
        pendingSubmissions: parseInt(pendingResult.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
};

module.exports = {
  getMyStudents,
  getMyAssignments,
  getDashboard
};
