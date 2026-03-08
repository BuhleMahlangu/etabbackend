const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { validateTeacherLearnerAccess, getTeacherLearners, canTeachLearner } = require('../middleware/teacherLearnerMiddleware');
const db = require('../config/database');

// ============================================
// GET ALL LEARNERS FOR CURRENT TEACHER
// ============================================
router.get('/my-learners', authenticate, async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const { gradeId, subjectId, search, page, limit } = req.query;

    // Verify user is teacher
    const userCheck = await db.query(
      'SELECT role FROM users WHERE id = $1::uuid',
      [teacherId]
    );

    if (userCheck.rows[0]?.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can access this endpoint'
      });
    }

    const result = await getTeacherLearners(teacherId, {
      gradeId,
      subjectId,
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    // Group by grade for easier frontend consumption
    const groupedByGrade = result.learners.reduce((acc, learner) => {
      const gradeKey = learner.grade_id;
      if (!acc[gradeKey]) {
        acc[gradeKey] = {
          gradeId: learner.grade_id,
          gradeName: learner.grade_name,
          gradeLevel: learner.grade_level,
          subjects: {}
        };
      }

      const subjectKey = learner.subject_id;
      if (!acc[gradeKey].subjects[subjectKey]) {
        acc[gradeKey].subjects[subjectKey] = {
          subjectId: learner.subject_id,
          subjectCode: learner.subject_code,
          subjectName: learner.subject_name,
          department: learner.department,
          learners: []
        };
      }

      acc[gradeKey].subjects[subjectKey].learners.push({
        learnerId: learner.learner_id,
        firstName: learner.first_name,
        lastName: learner.last_name,
        email: learner.email,
        isPrimaryTeacher: learner.is_primary_teacher
      });

      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        learners: result.learners,
        groupedByGrade: Object.values(groupedByGrade).map(grade => ({
          ...grade,
          subjects: Object.values(grade.subjects)
        })),
        pagination: result.pagination
      }
    });

  } catch (error) {
    console.error('Error fetching teacher learners:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching learners',
      error: error.message
    });
  }
});

// ============================================
// GET LEARNERS FOR A SPECIFIC GRADE/SUBJECT
// ============================================
router.get('/grade/:gradeId/subject/:subjectId/learners', 
  authenticate, 
  validateTeacherLearnerAccess,
  async (req, res) => {
    try {
      const teacherId = req.user.userId;
      const { gradeId, subjectId } = req.params;
      const { search, page, limit } = req.query;

      const result = await getTeacherLearners(teacherId, {
        gradeId,
        subjectId,
        search,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      });

      res.status(200).json({
        success: true,
        data: {
          gradeId,
          subjectId,
          learners: result.learners.map(l => ({
            learnerId: l.learner_id,
            firstName: l.first_name,
            lastName: l.last_name,
            email: l.email,
            isPrimaryTeacher: l.is_primary_teacher
          })),
          pagination: result.pagination
        }
      });

    } catch (error) {
      console.error('Error fetching grade/subject learners:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching learners',
        error: error.message
      });
    }
  }
);

// ============================================
// CHECK IF TEACHER CAN TEACH SPECIFIC LEARNER
// ============================================
router.get('/can-teach/:learnerId', authenticate, async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const { learnerId } = req.params;
    const { subjectId } = req.query;

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: 'subjectId query parameter is required'
      });
    }

    const canTeach = await canTeachLearner(teacherId, learnerId, subjectId);

    res.status(200).json({
      success: true,
      data: {
        canTeach,
        learnerId,
        subjectId
      }
    });

  } catch (error) {
    console.error('Error checking teach permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking permission',
      error: error.message
    });
  }
});

// ============================================
// GET LEARNER DETAILS (WITH VALIDATION)
// ============================================
router.get('/learner/:learnerId', 
  authenticate, 
  validateTeacherLearnerAccess,
  async (req, res) => {
    try {
      const { learnerId } = req.params;
      const teacherId = req.user.userId;
      const academicYear = new Date().getFullYear().toString();

      // Get learner details with subjects they share with this teacher
      const result = await db.query(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.created_at,
          g.id as grade_id,
          g.name as grade_name,
          g.level as grade_level,
          m.id as subject_id,
          m.code as subject_code,
          m.name as subject_name,
          m.department,
          ta.is_primary as is_primary_teacher,
          lm.enrollment_date
        FROM users u
        JOIN learner_modules lm ON u.id = lm.learner_id
        JOIN grades g ON lm.grade_id = g.id
        JOIN modules m ON lm.module_id = m.id
        JOIN teacher_assignments ta ON lm.grade_id = ta.grade_id 
          AND lm.module_id = ta.subject_id
        WHERE u.id = $1::uuid
        AND ta.teacher_id = $2::uuid
        AND ta.academic_year = $3
        AND ta.is_active = true
        AND lm.status = 'active'
        AND u.role = 'learner'
        ORDER BY m.department, m.name
      `, [learnerId, teacherId, academicYear]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Learner not found or not in your classes'
        });
      }

      // Group by learner
      const learner = {
        id: result.rows[0].id,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
        email: result.rows[0].email,
        enrollmentDate: result.rows[0].enrollment_date,
        grade: {
          id: result.rows[0].grade_id,
          name: result.rows[0].grade_name,
          level: result.rows[0].grade_level
        },
        subjects: result.rows.map(row => ({
          id: row.subject_id,
          code: row.subject_code,
          name: row.subject_name,
          department: row.department,
          isPrimaryTeacher: row.is_primary_teacher
        }))
      };

      res.status(200).json({
        success: true,
        data: learner
      });

    } catch (error) {
      console.error('Error fetching learner details:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching learner details',
        error: error.message
      });
    }
  }
);

module.exports = router;