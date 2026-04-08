const db = require('../config/database');

// ============================================
// GET TEACHER'S STUDENTS (School-scoped)
// ============================================
const getMyStudents = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const userSchoolId = req.user.schoolId;

    // Get teacher's subject assignments (school-filtered)
    let assignmentsQuery = `
      SELECT ta.subject_id, ta.grade_id, m.name as subject_name, g.name as grade_name
      FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      JOIN grades g ON ta.grade_id = g.id
      WHERE ta.teacher_id = $1 AND ta.is_active = true
    `;
    
    // Apply school filter if teacher has school_id
    if (userSchoolId) {
      assignmentsQuery += ` AND m.school_id = '${userSchoolId}'`;
    }
    
    const assignments = await db.query(assignmentsQuery, [teacherId]);

    if (assignments.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No subject assignments found'
      });
    }

    // Get all students enrolled in these subjects (school-filtered)
    const subjectIds = assignments.rows.map(a => a.subject_id);

    // Students query with school filter via module
    let studentsQuery = `
      SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.grade_id,
        u.school_id,
        g.name as grade_name,
        lm.enrolled_at,
        lm.completion_percentage as overall_progress
      FROM users u
      JOIN learner_modules lm ON u.id = lm.learner_id
      JOIN grades g ON u.grade_id = g.id
      JOIN modules m ON lm.module_id = m.id
      WHERE lm.module_id = ANY($1)
        AND lm.status = 'active'
        AND u.role = 'learner'
    `;
    
    // Apply school filter
    if (userSchoolId) {
      studentsQuery += ` AND m.school_id = '${userSchoolId}' AND u.school_id = '${userSchoolId}'`;
    }
    
    studentsQuery += ` ORDER BY u.last_name, u.first_name`;

    const students = await db.query(studentsQuery, [subjectIds]);

    // Get enrolled subjects and calculate real progress for each student
    for (let student of students.rows) {
      let subjectsQuery = `
        SELECT m.id as subject_id, m.name as subject_name, m.code as subject_code
        FROM learner_modules lm
        JOIN modules m ON lm.module_id = m.id
        WHERE lm.learner_id = $1 
          AND lm.status = 'active'
          AND m.id = ANY($2)
      `;
      // Apply school filter
      if (userSchoolId) {
        subjectsQuery += ` AND m.school_id = '${userSchoolId}'`;
      }
      
      const subjectsResult = await db.query(subjectsQuery, [student.id, subjectIds]);
      student.enrolled_subjects = subjectsResult.rows;
      
      // Calculate real overall progress for this student
      const enrolledSubjectIds = subjectsResult.rows.map(s => s.subject_id);
      
      if (enrolledSubjectIds.length > 0) {
        // Get assignments progress
        const assignmentsResult = await db.query(
          `SELECT COUNT(DISTINCT a.id) as total,
                  COUNT(DISTINCT CASE WHEN s.status IN ('submitted', 'graded') THEN s.id END) as completed
           FROM assignments a
           LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.learner_id = $1
           WHERE a.subject_id = ANY($2) AND a.is_published = true AND a.status = 'published'`,
          [student.id, enrolledSubjectIds]
        );
        
        // Get quizzes progress
        const quizzesResult = await db.query(
          `SELECT COUNT(DISTINCT q.id) as total,
                  COUNT(DISTINCT CASE WHEN qa.status IN ('submitted', 'auto_submitted', 'graded') THEN qa.id END) as completed
           FROM quizzes q
           LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.learner_id = $1
           WHERE q.subject_id = ANY($2) AND q.is_published = true AND q.status = 'published'`,
          [student.id, enrolledSubjectIds]
        );
        
        const assignmentsTotal = parseInt(assignmentsResult.rows[0]?.total) || 0;
        const assignmentsCompleted = parseInt(assignmentsResult.rows[0]?.completed) || 0;
        
        const quizzesTotal = parseInt(quizzesResult.rows[0]?.total) || 0;
        const quizzesCompleted = parseInt(quizzesResult.rows[0]?.completed) || 0;
        
        const totalItems = assignmentsTotal + quizzesTotal;
        const completedItems = assignmentsCompleted + quizzesCompleted;
        
        student.overall_progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        
        // Add breakdown for detail view
        student.progress_breakdown = {
          assignments: { total: assignmentsTotal, completed: assignmentsCompleted },
          quizzes: { total: quizzesTotal, completed: quizzesCompleted }
        };
      } else {
        student.overall_progress = 0;
      }
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
// GET TEACHER'S ASSIGNMENTS (SUBJECTS THEY TEACH) - School-scoped
// ============================================
const getMyAssignments = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const userSchoolId = req.user.schoolId;

    let query = `
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
    `;
    
    // Apply school filter if teacher has school_id
    if (userSchoolId) {
      query += ` AND m.school_id = '${userSchoolId}'`;
    }
    
    query += ` ORDER BY g.level, m.name`;

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
// GET TEACHER DASHBOARD STATS (School-scoped)
// ============================================
const getDashboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const userSchoolId = req.user.schoolId;

    // Get total students taught (school-filtered via modules)
    let studentsQuery = `
      SELECT COUNT(DISTINCT lm.learner_id)
      FROM teacher_assignments ta
      JOIN learner_modules lm ON ta.subject_id = lm.module_id
      JOIN modules m ON ta.subject_id = m.id
      WHERE ta.teacher_id = $1 AND ta.is_active = true
        AND lm.status = 'active'
    `;
    
    if (userSchoolId) {
      studentsQuery += ` AND m.school_id = '${userSchoolId}'`;
    }
    
    const studentsResult = await db.query(studentsQuery, [teacherId]);

    // Get total subjects (school-filtered)
    let subjectsQuery = `
      SELECT COUNT(*) FROM teacher_assignments ta
      JOIN modules m ON ta.subject_id = m.id
      WHERE ta.teacher_id = $1 AND ta.is_active = true
    `;
    
    if (userSchoolId) {
      subjectsQuery += ` AND m.school_id = '${userSchoolId}'`;
    }
    
    const subjectsResult = await db.query(subjectsQuery, [teacherId]);

    // Get recent assignments (school-filtered via assignments join to modules)
    let assignmentsQuery = `
      SELECT COUNT(*) FROM assignments a
      JOIN modules m ON a.subject_id = m.id
      WHERE a.teacher_id = $1 AND a.created_at >= NOW() - INTERVAL '30 days'
    `;
    
    if (userSchoolId) {
      assignmentsQuery += ` AND m.school_id = '${userSchoolId}'`;
    }
    
    const assignmentsResult = await db.query(assignmentsQuery, [teacherId]);

    // Get pending submissions to grade (school-filtered)
    let pendingQuery = `
      SELECT COUNT(*) FROM assignment_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN modules m ON a.subject_id = m.id
      WHERE a.teacher_id = $1 AND s.status = 'submitted'
    `;
    
    if (userSchoolId) {
      pendingQuery += ` AND m.school_id = '${userSchoolId}'`;
    }
    
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
