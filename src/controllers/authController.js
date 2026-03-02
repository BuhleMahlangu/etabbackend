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
    const { email, password, firstName, lastName, role, grade, subjects } = req.body;
    
    // Validation
    if ((role === 'teacher' || role === 'admin') && req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can create teacher or admin accounts' 
      });
    }

    if (role === 'learner' && !grade) {
      return res.status(400).json({
        success: false,
        message: 'Grade is required for learners'
      });
    }

    if (role === 'teacher' && (!subjects || subjects.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'At least one subject is required for teachers'
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

    // Lookup grade info from grades table
    let gradeId = null;
    let gradeName = null;
    let gradeLevel = null;
    
    if (role === 'learner' && grade) {
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
      
      gradeId = gradeResult.rows[0].id;        // UUID
      gradeName = gradeResult.rows[0].name;    // "Grade 10"
      gradeLevel = gradeResult.rows[0].level;  // INTEGER: 10
    }

    // Insert user with proper integer current_grade (gradeLevel)
    const result = await db.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, role, 
        grade_id, grade, current_grade, teacher_subjects
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING id, email, first_name, last_name, role, grade, current_grade`,
      [
        email, 
        passwordHash, 
        firstName, 
        lastName, 
        role || 'learner',
        gradeId,        // UUID -> grade_id column
        gradeName,      // "Grade 10" -> grade column
        gradeLevel,     // INTEGER (1-12) -> current_grade column
        role === 'teacher' ? subjects : null
      ]
    );

    const user = result.rows[0];

    // Auto-enroll learner in subjects
    if (role === 'learner') {
      const academicYear = new Date().getFullYear().toString();
      const enrolledCount = await autoEnrollLearner(user.id, grade, academicYear);
      
      // Create notification
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'general')`,
        [
          user.id,
          'Welcome to E-tab!',
          `You have been automatically enrolled in ${enrolledCount} subjects for ${grade}.`
        ]
      );
    }

    // Create teacher assignments
    if (role === 'teacher' && subjects) {
      const academicYear = new Date().getFullYear().toString();
      for (const subjectId of subjects) {
        await db.query(
          `INSERT INTO teacher_assignments (teacher_id, subject_id, academic_year)
           VALUES ($1, $2, $3)`,
          [user.id, subjectId, academicYear]
        );
      }
    }

    // GENERATE TOKEN FOR NEW USER
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      grade: user.current_grade  // Integer grade level in token
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
        grade: user.grade,           // "Grade 10" for display
        currentGrade: user.current_grade  // Integer: 10
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
      grade: user.current_grade  // Integer in token
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
        grade: user.grade,           // "Grade 10"
        currentGrade: user.current_grade,  // Integer: 10
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
              teacher_subjects, created_at, last_login
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
    
    // Get teaching assignments for teachers
    let teachingAssignments = [];
    if (result.rows[0].role === 'teacher') {
      const assignments = await db.query(
        `SELECT ta.*, s.name as subject_name, s.code as subject_code
         FROM teacher_assignments ta
         JOIN subjects s ON ta.subject_id = s.id
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