const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/auth');
const db = require('../config/database');

// Get subjects for a specific grade
const getSubjectsForGrade = async (grade) => {
  const result = await db.query(
    'SELECT * FROM subjects WHERE $1 = ANY(applicable_grades) AND is_active = true',
    [grade]
  );
  return result.rows;
};

// Auto-enroll learner in grade subjects
const autoEnrollLearner = async (learnerId, grade, academicYear) => {
  const subjects = await getSubjectsForGrade(grade);
  
  for (const subject of subjects) {
    // Check if already enrolled
    const existing = await db.query(
      'SELECT id FROM enrollments WHERE learner_id = $1 AND subject_id = $2 AND academic_year = $3',
      [learnerId, subject.id, academicYear]
    );
    
    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO enrollments (learner_id, subject_id, grade, academic_year, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [learnerId, subject.id, grade, academicYear]
      );
    }
  }
  
  return subjects.length;
};

const register = async (req, res) => {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      role, 
      grade, 
      subjects,
      teacherInfo
    } = req.body;
    
    // ============================================
    // FIXED: Block teacher/admin registration through auth route
    // Teachers must use /api/teachers/register (which has proper admin auth)
    // ============================================
    if (role === 'teacher' || role === 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can create teacher or admin accounts. Please use /api/teachers/register endpoint.' 
      });
    }

    // Only allow learner registration through this endpoint
    const userRole = role || 'learner';
    
    if (userRole === 'learner' && !grade) {
      return res.status(400).json({
        success: false,
        message: 'Grade is required for learners'
      });
    }

    // Check if email exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    let gradeId = null;
    let gradeName = null;
    let gradeLevel = null;

    // Lookup grade info for learners
    if (userRole === 'learner' && grade) {
      const gradeResult = await db.query(
        'SELECT id, name, level FROM grades WHERE name = $1',
        [grade]
      );
      
      if (gradeResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid grade selected'
        });
      }
      
      gradeId = gradeResult.rows[0].id;
      gradeName = gradeResult.rows[0].name;
      gradeLevel = gradeResult.rows[0].level;
    }

    // Insert user - ONLY learners through this route
    const result = await db.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, role, 
        grade_id, grade, current_grade, 
        employee_number, qualification, specialization, years_experience, bio,
        is_active
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true) 
      RETURNING id, email, first_name, last_name, role, grade, current_grade`,
      [
        email, 
        passwordHash, 
        firstName, 
        lastName, 
        userRole,
        gradeId,
        gradeName,
        gradeLevel,
        null, // employee_number - not for learners
        null, // qualification - not for learners
        null, // specialization - not for learners
        0,    // years_experience - not for learners
        null  // bio - not for learners
      ]
    );

    const user = result.rows[0];
    const academicYear = new Date().getFullYear().toString();

    // Handle learner auto-enrollment
    const enrolledCount = await autoEnrollLearner(user.id, grade, academicYear);
    
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, 'general')`,
      [
        user.id,
        'Welcome to E-tab!',
        `You have been automatically enrolled in ${enrolledCount} subjects for ${grade}.`
      ]
    );

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      grade: user.current_grade
    });

    res.status(201).json({ 
      success: true, 
      message: 'Account created successfully',
      token,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        grade: user.grade,
        currentGrade: user.current_grade
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, 
              grade, current_grade, is_active, teacher_subjects
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      grade: user.current_grade
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        grade: user.grade,
        currentGrade: user.current_grade,
        teacherSubjects: user.teacher_subjects
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, grade, current_grade, 
              teacher_subjects, created_at 
       FROM users WHERE id = $1`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get enrolled subjects for learners
    let enrolledSubjects = [];
    if (result.rows[0].role === 'learner') {
      const enrollments = await db.query(
        `SELECT e.*, s.name as subject_name, s.code as subject_code
         FROM enrollments e
         JOIN subjects s ON e.subject_id = s.id
         WHERE e.learner_id = $1 AND e.academic_year = $2`,
        [req.user.userId, new Date().getFullYear().toString()]
      );
      enrolledSubjects = enrollments.rows;
    }
    
    // Get teaching assignments for teachers - using subject_id
    let teachingAssignments = [];
    if (result.rows[0].role === 'teacher') {
      const assignments = await db.query(
        `SELECT ta.*, m.name as subject_name, m.code as subject_code, g.name as grade_name
         FROM teacher_assignments ta
         JOIN modules m ON ta.subject_id = m.id
         JOIN grades g ON ta.grade_id = g.id
         WHERE ta.teacher_id = $1 AND ta.academic_year = $2`,
        [req.user.userId, new Date().getFullYear().toString()]
      );
      teachingAssignments = assignments.rows;
    }

    res.json({ 
      success: true, 
      data: {
        ...result.rows[0],
        enrolledSubjects,
        teachingAssignments
      }
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

const logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
};

module.exports = { register, login, getMe, logout, getSubjectsForGrade, autoEnrollLearner };