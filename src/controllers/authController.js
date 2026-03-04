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

// ============================================
// DEBUG VERSION: Register with full logging
// ============================================
const register = async (req, res) => {
  console.log('🔥 [REGISTER] ========== REGISTRATION STARTED ==========');
  console.log('🔥 [REGISTER] Request body:', { 
    email: req.body?.email,
    role: req.body?.role,
    hasPassword: !!req.body?.password,
    firstName: req.body?.firstName,
    lastName: req.body?.lastName,
    grade: req.body?.grade,
    gradeType: typeof req.body?.grade
  });
  
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
    
    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      console.log('❌ [REGISTER] Missing required fields');
      return res.status(400).json({ 
        success: false, 
        message: 'Email, password, first name, and last name are required' 
      });
    }

    console.log('🔥 [REGISTER] Checking for existing email...');
    
    // Check if email exists in users, admins, OR pending_teachers
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    console.log('🔥 [REGISTER] Users table check:', existingUser.rows.length > 0 ? 'found' : 'not found');
    
    const existingAdmin = await db.query('SELECT id FROM admins WHERE email = $1', [email]);
    console.log('🔥 [REGISTER] Admins table check:', existingAdmin.rows.length > 0 ? 'found' : 'not found');
    
    const existingPending = await db.query('SELECT id FROM pending_teachers WHERE email = $1', [email]);
    console.log('🔥 [REGISTER] Pending teachers check:', existingPending.rows.length > 0 ? 'found' : 'not found');
    
    if (existingUser.rows.length > 0 || existingAdmin.rows.length > 0 || existingPending.rows.length > 0) {
      console.log('❌ [REGISTER] Email already exists');
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered or pending approval' 
      });
    }

    console.log('🔥 [REGISTER] Hashing password...');
    // Hash password
    let salt, passwordHash;
    try {
      salt = await bcrypt.genSalt(12);
      passwordHash = await bcrypt.hash(password, salt);
      console.log('✅ [REGISTER] Password hashed successfully');
    } catch (bcryptError) {
      console.error('❌ [REGISTER] bcrypt error:', bcryptError.message);
      throw bcryptError;
    }

    // ============================================
    // TEACHER REGISTRATION - Save as pending
    // ============================================
    if (role === 'teacher') {
      console.log('🔥 [REGISTER] Processing TEACHER registration...');
      const assignments = teacherInfo?.assignments || [];
      
      await db.query(`
        INSERT INTO pending_teachers (
          email, password_hash, first_name, last_name,
          employee_number, qualification, specialization, years_experience, bio,
          assignments, status, requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW())
      `, [
        email,
        passwordHash,
        firstName,
        lastName,
        teacherInfo?.employeeNumber || `TCH${Date.now()}`,
        teacherInfo?.qualification || 'To be updated',
        teacherInfo?.specialization || 'General',
        teacherInfo?.yearsOfExperience || 0,
        teacherInfo?.bio || 'New teacher',
        JSON.stringify(assignments)
      ]);

      console.log('✅ [REGISTER] Teacher saved as pending');
      return res.status(201).json({ 
        success: true, 
        message: 'Teacher registration submitted for admin approval. You will receive an email once approved.',
        pending: true
      });
    }

    // ============================================
    // ADMIN REGISTRATION - Blocked
    // ============================================
    if (role === 'admin') {
      console.log('❌ [REGISTER] Attempted admin registration - blocked');
      return res.status(403).json({ 
        success: false, 
        message: 'Admin accounts can only be created by existing administrators.' 
      });
    }

    // ============================================
    // LEARNER REGISTRATION - Immediate approval
    // ============================================
    console.log('🔥 [REGISTER] Processing LEARNER registration...');
    const userRole = role || 'learner';
    
    if (userRole === 'learner' && !grade) {
      console.log('❌ [REGISTER] Learner registration missing grade');
      return res.status(400).json({
        success: false,
        message: 'Grade is required for learners'
      });
    }

    let gradeId = null;
    let gradeName = null;
    let gradeLevel = null;

    if (userRole === 'learner' && grade) {
      console.log('🔥 [REGISTER] Looking up grade:', JSON.stringify(grade), 'Type:', typeof grade);
      
      // Convert grade to string and trim
      const gradeString = grade.toString().trim();
      console.log('🔥 [REGISTER] Grade as string:', JSON.stringify(gradeString));
      
      // Try multiple search strategies
      let gradeResult;
      
      // Strategy 1: Direct match on name (e.g., "8" or "Grade 8")
      console.log('🔥 [REGISTER] Strategy 1: name = $1');
      gradeResult = await db.query(
        'SELECT id, name, level FROM grades WHERE name = $1',
        [gradeString]
      );
      console.log('🔥 [REGISTER] Strategy 1 result:', gradeResult.rows.length, 'rows');
      
      // Strategy 2: Match on level as string
      if (gradeResult.rows.length === 0) {
        console.log('🔥 [REGISTER] Strategy 2: CAST(level AS TEXT) = $1');
        gradeResult = await db.query(
          'SELECT id, name, level FROM grades WHERE CAST(level AS TEXT) = $1',
          [gradeString]
        );
        console.log('🔥 [REGISTER] Strategy 2 result:', gradeResult.rows.length, 'rows');
      }
      
      // Strategy 3: Case insensitive name match
      if (gradeResult.rows.length === 0) {
        console.log('🔥 [REGISTER] Strategy 3: name ILIKE $1');
        gradeResult = await db.query(
          'SELECT id, name, level FROM grades WHERE name ILIKE $1',
          [gradeString]
        );
        console.log('🔥 [REGISTER] Strategy 3 result:', gradeResult.rows.length, 'rows');
      }
      
      // Strategy 4: Match "Grade X" format
      if (gradeResult.rows.length === 0) {
        console.log('🔥 [REGISTER] Strategy 4: name = "Grade $1"');
        gradeResult = await db.query(
          'SELECT id, name, level FROM grades WHERE name = $1',
          [`Grade ${gradeString}`]
        );
        console.log('🔥 [REGISTER] Strategy 4 result:', gradeResult.rows.length, 'rows');
      }

      // Strategy 5: Match level as integer
      if (gradeResult.rows.length === 0) {
        console.log('🔥 [REGISTER] Strategy 5: level = $1 (as integer)');
        const gradeInt = parseInt(gradeString);
        if (!isNaN(gradeInt)) {
          gradeResult = await db.query(
            'SELECT id, name, level FROM grades WHERE level = $1',
            [gradeInt]
          );
          console.log('🔥 [REGISTER] Strategy 5 result:', gradeResult.rows.length, 'rows');
        }
      }

      if (gradeResult.rows.length === 0) {
        // Get available grades for error message
        const available = await db.query('SELECT name, level FROM grades ORDER BY level');
        console.log('❌ [REGISTER] Grade not found. Available grades:', available.rows);
        
        return res.status(400).json({
          success: false,
          message: `Grade "${grade}" not found. Available: ${available.rows.map(r => r.name || r.level).join(', ')}`
        });
      }
      
      gradeId = gradeResult.rows[0].id;
      gradeName = gradeResult.rows[0].name || `Grade ${gradeResult.rows[0].level}`;
      gradeLevel = gradeResult.rows[0].level;
      console.log('✅ [REGISTER] Grade found:', gradeName, 'ID:', gradeId, 'Level:', gradeLevel);
    }

    console.log('🔥 [REGISTER] Inserting user into database...');
    // Insert learner user - FIXED: only include columns that exist for learners
    let result;
    try {
      result = await db.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, role, 
          grade_id, grade, current_grade, 
          is_active
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) 
        RETURNING id, email, first_name, last_name, role, grade, current_grade`,
        [
          email, 
          passwordHash, 
          firstName, 
          lastName, 
          userRole,
          gradeId,
          gradeName,
          gradeLevel
        ]
      );
      console.log('✅ [REGISTER] User inserted, ID:', result.rows[0]?.id);
    } catch (insertError) {
      console.error('❌ [REGISTER] Database insert failed:', insertError.message);
      throw insertError;
    }

    const user = result.rows[0];
    const academicYear = new Date().getFullYear().toString();

    console.log('🔥 [REGISTER] Auto-enrolling in subjects...');
    // Auto-enroll learner - use gradeLevel (number) for subject lookup
    let enrolledCount;
    try {
      // FIXED: Use gradeLevel (the number) instead of grade (the string) for subject matching
      const gradeForSubjects = gradeLevel ? gradeLevel.toString() : grade;
      console.log('🔥 [REGISTER] Using grade for subjects:', gradeForSubjects);
      enrolledCount = await autoEnrollLearner(user.id, gradeForSubjects, academicYear);
      console.log('✅ [REGISTER] Auto-enrolled in', enrolledCount, 'subjects');
    } catch (enrollError) {
      console.error('❌ [REGISTER] Auto-enroll failed:', enrollError.message);
      // Don't fail registration if auto-enroll fails
      enrolledCount = 0;
    }
    
    console.log('🔥 [REGISTER] Creating welcome notification...');
    try {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'general')`,
        [
          user.id,
          'Welcome to E-tab!',
          `You have been automatically enrolled in ${enrolledCount} subjects for ${gradeName || grade}.`
        ]
      );
      console.log('✅ [REGISTER] Welcome notification created');
    } catch (notifError) {
      console.error('❌ [REGISTER] Notification failed:', notifError.message);
      // Don't fail registration if notification fails
    }

    console.log('🔥 [REGISTER] Generating token...');
    // Generate token
    let token;
    try {
      token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        grade: user.current_grade
      });
      console.log('✅ [REGISTER] Token generated');
    } catch (tokenError) {
      console.error('❌ [REGISTER] Token generation failed:', tokenError.message);
      throw tokenError;
    }

    console.log('✅ [REGISTER] ========== REGISTRATION SUCCESS ==========');
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
    console.error('❌ [REGISTER] ========== CRITICAL ERROR ==========');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
};

// ============================================
// SEPARATED LOGIN: loginType determines which table to check
// ============================================
const login = async (req, res) => {
  console.log('🔥 [LOGIN] ========== LOGIN STARTED ==========');
  console.log('🔥 [LOGIN] Email:', req.body?.email);
  console.log('🔥 [LOGIN] Login type:', req.body?.loginType);
  
  try {
    const { email, password, loginType } = req.body;
    
    if (!email || !password) {
      console.log('❌ [LOGIN] Missing email or password');
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    // ============================================
    // ADMIN LOGIN - Only check admins table
    // ============================================
    if (loginType === 'admin') {
      console.log('🔥 [LOGIN] Admin login - checking admins table only');
      
      const adminResult = await db.query(
        `SELECT id, email, password_hash, first_name, last_name,  
                is_active, is_super_admin, last_login
         FROM admins WHERE email = $1`,
        [email]
      );

      if (adminResult.rows.length === 0) {
        console.log('❌ [LOGIN] Admin not found');
        return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
      }

      const admin = adminResult.rows[0];

      if (!admin.is_active) {
        console.log('❌ [LOGIN] Admin account deactivated');
        return res.status(401).json({ success: false, message: 'Admin account deactivated' });
      }

      const isValid = await bcrypt.compare(password, admin.password_hash);
      if (!isValid) {
        console.log('❌ [LOGIN] Invalid admin password');
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      await db.query('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [admin.id]);

      const token = generateToken({
        userId: admin.id,
        email: admin.email,
        role: 'admin',
        isSuperAdmin: admin.is_super_admin
      });

      console.log('✅ [LOGIN] Admin login SUCCESS');
      return res.json({
        success: true,
        token,
        user: {
          id: admin.id,
          email: admin.email,
          firstName: admin.first_name,
          lastName: admin.last_name,
          role: 'admin',
          isSuperAdmin: admin.is_super_admin
        }
      });
    }

    // ============================================
    // REGULAR USER LOGIN (loginType === 'user' or undefined)
    // Only check users table - NEVER check admins table
    // ============================================
    console.log('🔥 [LOGIN] Regular login - checking users table only');
    
    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role,  
              grade, current_grade, is_active, teacher_subjects
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      console.log('🔥 [LOGIN] No user found, checking pending_teachers...');
      const pending = await db.query(
        'SELECT status FROM pending_teachers WHERE email = $1',
        [email]
      );
      
      if (pending.rows.length > 0) {
        console.log('🔥 [LOGIN] Found pending teacher');
        return res.status(401).json({ 
          success: false, 
          message: 'Your teacher registration is pending admin approval. Please wait for confirmation.' 
        });
      }
      
      console.log('❌ [LOGIN] No user found in users table');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    console.log('🔥 [LOGIN] Found user:', user.email, 'Role:', user.role);

    if (!user.is_active) {
      console.log('❌ [LOGIN] User account deactivated');
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      console.log('❌ [LOGIN] Invalid password');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      grade: user.current_grade
    });

    console.log('✅ [LOGIN] User login SUCCESS');
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
    console.error('❌ [LOGIN] ========== CRITICAL ERROR ==========');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
};

// ============================================
// FIXED: getMe now checks BOTH admins and users tables
// ============================================
const getMe = async (req, res) => {
  try {
    // Check if user is admin first
    const adminResult = await db.query(
      `SELECT id, email, first_name, last_name,  
              is_super_admin as is_super_admin, 
              is_active, created_at, last_login
       FROM admins WHERE id = $1`,
      [req.user.userId]
    );

    if (adminResult.rows.length > 0) {
      return res.json({
        success: true,
        data: {
          ...adminResult.rows[0],
          role: 'admin'
        }
      });
    }

    // Otherwise check users table
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, grade, current_grade,  
              teacher_subjects, created_at 
       FROM users WHERE id = $1`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
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