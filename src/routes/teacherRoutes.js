const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/auth');

// Small helper to validate UUID
function looksLikeUUID(v) {
  return typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);
}

// ============================================
// GET TEACHER DASHBOARD
// ============================================
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const teacherId = req.user.userId;

    // Verify user is teacher
    const userCheck = await db.query(
      'SELECT role, first_name, last_name FROM users WHERE id = $1::uuid',
      [teacherId]
    );
    
    if (userCheck.rows[0]?.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can access this endpoint'
      });
    }

    const academicYear = new Date().getFullYear().toString();

    // Get teacher's assigned subjects with student counts
    const subjectsResult = await db.query(`
      SELECT 
        ta.id as assignment_id,
        g.id as grade_id,
        g.name as grade_name,
        g.level as grade_level,
        m.id as subject_id,
        m.code as subject_code,
        m.name as subject_name,
        m.department,
        m.description,
        ta.is_primary,
        COUNT(DISTINCT lm.learner_id) as student_count,
        COUNT(DISTINCT mat.id) as material_count
      FROM teacher_assignments ta
      JOIN grades g ON ta.grade_id = g.id
      JOIN modules m ON ta.subject_id = m.id
      LEFT JOIN learner_modules lm ON m.id = lm.module_id 
        AND lm.grade_id = g.id 
        AND lm.status = 'active'
      LEFT JOIN materials mat ON mat.subject_id = m.id 
        AND mat.teacher_id = ta.teacher_id
      WHERE ta.teacher_id = $1::uuid
      AND ta.academic_year = $2
      AND ta.is_active = true
      GROUP BY ta.id, g.id, g.name, g.level, m.id, m.code, m.name, m.department, m.description, ta.is_primary
      ORDER BY g.level, m.department, m.name
    `, [teacherId, academicYear]);

    // Get total unique students across all subjects
    const studentsResult = await db.query(`
      SELECT COUNT(DISTINCT lm.learner_id) as total_students
      FROM teacher_assignments ta
      JOIN learner_modules lm ON ta.grade_id = lm.grade_id 
        AND ta.subject_id = lm.module_id
      WHERE ta.teacher_id = $1::uuid
      AND ta.academic_year = $2
      AND lm.status = 'active'
    `, [teacherId, academicYear]);

    // Get materials stats
    const materialsResult = await db.query(`
      SELECT 
        COUNT(*) as total_materials,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_uploads
      FROM materials
      WHERE teacher_id = $1::uuid
    `, [teacherId]);

    // Get pending assignments to grade
    const pendingResult = await db.query(`
      SELECT COUNT(*) as pending_count
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.teacher_id = $1::uuid
      AND s.status = 'submitted'
      AND s.grade IS NULL
    `, [teacherId]);

    // Get recent activity (last 5 materials uploaded)
    const recentActivity = await db.query(`
      SELECT 
        m.id,
        m.title,
        m.file_type,
        m.created_at,
        mod.name as subject_name,
        g.name as grade_name
      FROM materials m
      JOIN modules mod ON m.subject_id = mod.id
      JOIN grades g ON m.grade_id = g.id
      WHERE m.teacher_id = $1::uuid
      ORDER BY m.created_at DESC
      LIMIT 5
    `, [teacherId]);

    // Group subjects by grade
    const subjectsByGrade = subjectsResult.rows.reduce((acc, row) => {
      const gradeKey = row.grade_id;
      if (!acc[gradeKey]) {
        acc[gradeKey] = {
          gradeId: row.grade_id,
          gradeName: row.grade_name,
          gradeLevel: row.grade_level,
          subjects: []
        };
      }
      
      acc[gradeKey].subjects.push({
        assignmentId: row.assignment_id,
        subjectId: row.subject_id,
        code: row.subject_code,
        name: row.subject_name,
        department: row.department,
        description: row.description,
        isPrimary: row.is_primary,
        studentCount: parseInt(row.student_count),
        materialCount: parseInt(row.material_count)
      });
      
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      dashboard: {
        teacher: {
          firstName: userCheck.rows[0].first_name,
          lastName: userCheck.rows[0].last_name
        },
        academicYear,
        stats: {
          totalSubjects: subjectsResult.rows.length,
          totalStudents: parseInt(studentsResult.rows[0]?.total_students || 0),
          totalMaterials: parseInt(materialsResult.rows[0]?.total_materials || 0),
          recentUploads: parseInt(materialsResult.rows[0]?.recent_uploads || 0),
          pendingGrading: parseInt(pendingResult.rows[0]?.pending_count || 0)
        },
        grades: Object.values(subjectsByGrade),
        subjects: subjectsResult.rows.map(s => ({
          id: s.subject_id,
          code: s.subject_code,
          name: s.subject_name,
          department: s.department,
          grade: s.grade_name,
          gradeLevel: s.grade_level,
          isPrimary: s.is_primary,
          studentCount: parseInt(s.student_count),
          materialCount: parseInt(s.material_count)
        })),
        recentActivity: recentActivity.rows.map(a => ({
          id: a.id,
          title: a.title,
          fileType: a.file_type,
          subjectName: a.subject_name,
          gradeName: a.grade_name,
          createdAt: a.created_at
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching teacher dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard',
      error: error.message
    });
  }
});

// ============================================
// REGISTER TEACHER WITH SUBJECT ASSIGNMENTS
// ============================================
router.post('/register', authenticate, async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password,
      employeeNumber,
      qualification,
      specialization,
      yearsOfExperience,
      bio,
      assignments 
    } = req.body;

    const adminId = req.user.userId;

    // Verify admin is making the request
    const adminCheck = await db.query(
      'SELECT role FROM users WHERE id = $1::uuid',
      [adminId]
    );

    if (adminCheck.rows[0]?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can register teachers'
      });
    }

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required'
      });
    }

    // Check if email exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert teacher user
    const userResult = await db.query(`
      INSERT INTO users (
        email, password_hash, first_name, last_name, role,
        employee_number, qualification, specialization, years_experience, bio,
        is_active
      ) 
      VALUES ($1, $2, $3, $4, 'teacher', $5, $6, $7, $8, $9, true)
      RETURNING id, email, first_name, last_name
    `, [
      email, passwordHash, firstName, lastName,
      employeeNumber || `TCH${Date.now()}`,
      qualification || 'To be updated',
      specialization || 'General',
      yearsOfExperience || 0,
      bio || 'New teacher'
    ]);

    const teacher = userResult.rows[0];
    const academicYear = new Date().getFullYear().toString();

    // Process assignments - link teacher to grade subjects
    const assignmentResults = [];
    
    if (assignments && Array.isArray(assignments) && assignments.length > 0) {
      for (const assignment of assignments) {
        const { gradeId, subjectIds, isPrimary } = assignment;
        
        if (!looksLikeUUID(gradeId) || !Array.isArray(subjectIds)) {
          continue;
        }

        // Verify grade exists
        const gradeCheck = await db.query(
          'SELECT name, level FROM grades WHERE id = $1::uuid',
          [gradeId]
        );
        
        if (gradeCheck.rows.length === 0) continue;

        // Insert teacher assignments for each subject - USING subject_id
        for (const subjectId of subjectIds) {
          if (!looksLikeUUID(subjectId)) continue;

          // Verify subject belongs to this grade
          const subjectCheck = await db.query(`
            SELECT m.name, m.department
            FROM modules m
            JOIN grade_modules gm ON m.id = gm.module_id
            WHERE m.id = $1::uuid AND gm.grade_id = $2::uuid
          `, [subjectId, gradeId]);

          if (subjectCheck.rows.length > 0) {
            try {
              // Using subject_id to match database schema
              await db.query(`
                INSERT INTO teacher_assignments (
                  teacher_id, grade_id, subject_id, academic_year, is_primary, is_active
                ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, true)
                ON CONFLICT (teacher_id, subject_id, academic_year) DO UPDATE
                SET grade_id = $2::uuid, is_primary = $5, is_active = true
              `, [
                teacher.id, 
                gradeId, 
                subjectId, 
                academicYear,
                isPrimary || false
              ]);

              assignmentResults.push({
                gradeId,
                gradeName: gradeCheck.rows[0].name,
                subjectId,
                subjectName: subjectCheck.rows[0].name,
                department: subjectCheck.rows[0].department
              });
            } catch (err) {
              console.warn('Assignment insert failed:', err.message);
            }
          }
        }
      }
    }

    // Generate token for immediate login
    const token = generateToken({
      userId: teacher.id,
      email: teacher.email,
      role: 'teacher'
    });

    res.status(201).json({
      success: true,
      message: 'Teacher registered successfully',
      token,
      data: {
        id: teacher.id,
        email: teacher.email,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        role: 'teacher',
        assignments: assignmentResults,
        totalAssignments: assignmentResults.length
      }
    });

  } catch (error) {
    console.error('Teacher registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Teacher registration failed',
      error: error.message
    });
  }
});

// ============================================
// GET TEACHER'S ASSIGNED SUBJECTS
// ============================================
router.get('/my-assignments', authenticate, async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const academicYear = req.query.year || new Date().getFullYear().toString();

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

    const result = await db.query(`
      SELECT 
        ta.id as assignment_id,
        g.id as grade_id,
        g.name as grade_name,
        g.level as grade_level,
        m.id as subject_id,
        m.code as subject_code,
        m.name as subject_name,
        m.department,
        m.description,
        ta.is_primary,
        ta.academic_year,
        COUNT(DISTINCT lm.learner_id) as enrolled_learners
      FROM teacher_assignments ta
      JOIN grades g ON ta.grade_id = g.id
      JOIN modules m ON ta.subject_id = m.id
      LEFT JOIN learner_modules lm ON m.id = lm.module_id 
        AND lm.grade_id = g.id 
        AND lm.status = 'active'
      WHERE ta.teacher_id = $1::uuid
      AND ta.academic_year = $2
      GROUP BY ta.id, g.id, g.name, g.level, m.id, m.code, m.name, m.department, m.description, ta.is_primary, ta.academic_year
      ORDER BY g.level, m.department, m.name
    `, [teacherId, academicYear]);

    // Group by grade
    const grouped = result.rows.reduce((acc, row) => {
      const gradeKey = row.grade_id;
      if (!acc[gradeKey]) {
        acc[gradeKey] = {
          gradeId: row.grade_id,
          gradeName: row.grade_name,
          gradeLevel: row.grade_level,
          subjects: []
        };
      }
      
      acc[gradeKey].subjects.push({
        assignmentId: row.assignment_id,
        subjectId: row.subject_id,
        code: row.subject_code,
        name: row.subject_name,
        department: row.department,
        description: row.description,
        isPrimary: row.is_primary,
        enrolledLearners: parseInt(row.enrolled_learners)
      });
      
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      academicYear,
      totalAssignments: result.rows.length,
      grades: Object.values(grouped)
    });

  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assignments',
      error: error.message
    });
  }
});

// ============================================
// GET ALL TEACHERS (Admin only)
// ============================================
router.get('/all', authenticate, async (req, res) => {
  try {
    // Verify admin
    const adminCheck = await db.query(
      'SELECT role FROM users WHERE id = $1::uuid',
      [req.user.userId]
    );

    if (adminCheck.rows[0]?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access this endpoint'
      });
    }

    const result = await db.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.employee_number,
        u.qualification,
        u.specialization,
        u.years_experience,
        u.is_active,
        u.created_at,
        COUNT(ta.id) as total_assignments
      FROM users u
      LEFT JOIN teacher_assignments ta ON u.id = ta.teacher_id
      WHERE u.role = 'teacher'
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.employee_number,
               u.qualification, u.specialization, u.years_experience, u.is_active, u.created_at
      ORDER BY u.created_at DESC
    `);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      teachers: result.rows.map(t => ({
        id: t.id,
        email: t.email,
        firstName: t.first_name,
        lastName: t.last_name,
        employeeNumber: t.employee_number,
        qualification: t.qualification,
        specialization: t.specialization,
        yearsExperience: t.years_experience,
        isActive: t.is_active,
        totalAssignments: parseInt(t.total_assignments),
        createdAt: t.created_at
      }))
    });

  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teachers',
      error: error.message
    });
  }
});

// ============================================
// GET SUBJECTS BY GRADE (For Teacher Selection)
// ============================================
router.get('/subjects-by-grade/:gradeId', authenticate, async (req, res) => {
  try {
    const { gradeId } = req.params;

    // Verify user is teacher or admin
    const userCheck = await db.query(
      'SELECT role FROM users WHERE id = $1::uuid',
      [req.user.userId]
    );
    
    if (!['teacher', 'admin'].includes(userCheck.rows[0]?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers and admins can access this endpoint'
      });
    }

    // Get grade info
    const gradeResult = await db.query(
      'SELECT id, name, level FROM grades WHERE id = $1::uuid',
      [gradeId]
    );

    if (gradeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    const grade = gradeResult.rows[0];

    // Get all modules for this grade with learner count
    const modulesResult = await db.query(`
      SELECT 
        m.id,
        m.code,
        m.name,
        m.description,
        m.department,
        m.credits,
        gm.is_compulsory,
        COUNT(DISTINCT lm.learner_id) as learner_count
      FROM modules m
      JOIN grade_modules gm ON m.id = gm.module_id
      LEFT JOIN learner_modules lm ON m.id = lm.module_id 
        AND lm.grade_id = $1::uuid 
        AND lm.status = 'active'
      WHERE gm.grade_id = $1::uuid
      AND m.is_active = true
      GROUP BY m.id, m.code, m.name, m.description, m.department, m.credits, gm.is_compulsory
      ORDER BY gm.is_compulsory DESC, m.department, m.name
    `, [gradeId]);

    res.status(200).json({
      success: true,
      grade: {
        id: grade.id,
        name: grade.name,
        level: grade.level
      },
      subjects: modulesResult.rows.map(m => ({
        id: m.id,
        code: m.code,
        name: m.name,
        description: m.description,
        department: m.department,
        credits: m.credits,
        isCompulsory: m.is_compulsory,
        learnerCount: parseInt(m.learner_count)
      }))
    });

  } catch (error) {
    console.error('Error fetching subjects by grade:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects',
      error: error.message
    });
  }
});

module.exports = router;