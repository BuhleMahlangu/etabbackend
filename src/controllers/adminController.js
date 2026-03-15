const bcrypt = require('bcryptjs');
const db = require('../config/database');

// ============================================
// GET DASHBOARD STATS
// ============================================
const getDashboardStats = async (req, res) => {
  try {
    console.log('🔥 [ADMIN] Fetching dashboard stats');

    const pendingCount = await db.query(
      "SELECT COUNT(*) FROM pending_teachers WHERE status = 'pending'"
    );

    const teachersCount = await db.query(
      "SELECT COUNT(*) FROM users WHERE role = 'teacher'"
    );

    const learnersCount = await db.query(
      "SELECT COUNT(*) FROM users WHERE role = 'learner'"
    );

    const recentPending = await db.query(`
      SELECT COUNT(*) FROM pending_teachers 
      WHERE status = 'pending' 
      AND requested_at > NOW() - INTERVAL '7 days'
    `);

    const adminsCount = await db.query(
      "SELECT COUNT(*) FROM admins"
    );

    res.json({
      success: true,
      data: {
        pendingTeachers: parseInt(pendingCount.rows[0].count),
        totalTeachers: parseInt(teachersCount.rows[0].count),
        totalLearners: parseInt(learnersCount.rows[0].count),
        totalAdmins: parseInt(adminsCount.rows[0].count),
        recentPending: parseInt(recentPending.rows[0].count)
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

// ============================================
// GET ALL PENDING TEACHER REGISTRATIONS
// ============================================
const getPendingTeachers = async (req, res) => {
  try {
    console.log('🔥 [ADMIN] Fetching pending teachers');

    const result = await db.query(`
      SELECT 
        id, email, first_name, last_name, employee_number,
        qualification, specialization, years_experience, bio,
        assignments, status, requested_at
      FROM pending_teachers
      WHERE status = 'pending'
      ORDER BY requested_at DESC
    `);

    console.log(`✅ [ADMIN] Found ${result.rows.length} pending teachers`);

    res.json({
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
        bio: t.bio,
        assignments: typeof t.assignments === 'string' ? JSON.parse(t.assignments) : t.assignments,
        status: t.status,
        requestedAt: t.requested_at
      }))
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching pending teachers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending teachers' });
  }
};

// ============================================
// GET ALL TEACHERS (approved + pending)
// ============================================
const getAllTeachers = async (req, res) => {
  try {
    console.log('🔥 [ADMIN] Fetching all teachers');

    // Get approved teachers - ONLY columns that exist in users table
    const approvedResult = await db.query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, 
        u.is_active, u.created_at, u.last_login,
        u.grade, u.current_grade,
        'approved' as status,
        COALESCE(
          json_agg(
            json_build_object(
              'gradeId', ta.grade_id,
              'subjectId', ta.subject_id,
              'isPrimary', ta.is_primary
            )
          ) FILTER (WHERE ta.id IS NOT NULL),
          '[]'
        ) as assignments
      FROM users u
      LEFT JOIN teacher_assignments ta ON ta.teacher_id = u.id 
        AND ta.academic_year = $1
      WHERE u.role = 'teacher'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `, ['2026']);

    // Get pending teachers (has all the extra fields)
    const pendingResult = await db.query(`
      SELECT 
        id, email, first_name, last_name, employee_number,
        qualification, specialization, years_experience, bio,
        requested_at as created_at, NULL as last_login,
        status, assignments
      FROM pending_teachers 
      ORDER BY requested_at DESC
    `);

    const allTeachers = [
      ...approvedResult.rows.map(t => ({
        ...t,
        type: 'approved',
        firstName: t.first_name,
        lastName: t.last_name,
        assignments: typeof t.assignments === 'string' ? JSON.parse(t.assignments) : t.assignments
      })),
      ...pendingResult.rows.map(t => ({
        ...t,
        type: 'pending',
        firstName: t.first_name,
        lastName: t.last_name,
        employeeNumber: t.employee_number,
        qualification: t.qualification,
        specialization: t.specialization,
        yearsExperience: t.years_experience,
        bio: t.bio,
        isActive: null,
        assignments: typeof t.assignments === 'string' ? JSON.parse(t.assignments) : t.assignments
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`✅ [ADMIN] Found ${allTeachers.length} total teachers`);

    res.json({
      success: true,
      count: allTeachers.length,
      teachers: allTeachers
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching all teachers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch teachers' });
  }
};

// ============================================
// APPROVE A TEACHER - AUTO-CREATES ASSIGNMENTS (FIXED)
// ============================================
const approveTeacher = async (req, res) => {
  try {
    const { pendingId } = req.params;
    const adminId = req.user.userId;

    console.log('🔥 [ADMIN] Approving teacher:', pendingId);

    const pending = await db.query(
      'SELECT * FROM pending_teachers WHERE id = $1 AND status = $2',
      [pendingId, 'pending']
    );

    if (pending.rows.length === 0) {
      console.log('❌ [ADMIN] Pending teacher not found:', pendingId);
      return res.status(404).json({ success: false, message: 'Pending teacher not found or already processed' });
    }

    const teacher = pending.rows[0];
    const academicYear = '2026'; // Use your academic year

    await db.query('BEGIN');

    try {
      // ============================================
      // FIX: Simplified insert - let database handle id, timestamps
      // ============================================
      
      console.log('🔥 [ADMIN] Creating user for teacher:', teacher.email);
      
      const insertQuery = `
        INSERT INTO users (
          email, password_hash, first_name, last_name, 
          role, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
        RETURNING id, email, first_name, last_name, role, is_active
      `;
      
      const insertValues = [
        teacher.email,
        teacher.password_hash,
        teacher.first_name,
        teacher.last_name,
        'teacher'
      ];

      console.log('🔥 [ADMIN] Insert query:', insertQuery);
      console.log('🔥 [ADMIN] Email being inserted:', teacher.email);

      const userResult = await db.query(insertQuery, insertValues);
      const newTeacher = userResult.rows[0];
      console.log('✅ [ADMIN] Created user account:', newTeacher.id);

      // Parse assignments from JSON
      const assignments = typeof teacher.assignments === 'string' 
        ? JSON.parse(teacher.assignments) 
        : teacher.assignments || [];

      let assignmentCount = 0;

      // Loop through each grade assignment
      for (const assignment of assignments) {
        const { gradeId, subjectIds, isPrimary } = assignment;
        
        if (!gradeId || !subjectIds || !Array.isArray(subjectIds)) {
          console.log('⚠️ [ADMIN] Skipping invalid assignment:', assignment);
          continue;
        }

        // Insert each subject for this grade
        for (const subjectId of subjectIds) {
          if (!subjectId) continue;

          try {
            await db.query(`
              INSERT INTO teacher_assignments (
                id, teacher_id, grade_id, subject_id, academic_year, is_primary, is_active, assigned_at
              ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4, $5, true, NOW())
            `, [
              newTeacher.id,
              gradeId,
              subjectId,
              academicYear,
              isPrimary || false
            ]);
            assignmentCount++;
            console.log(`✅ [ADMIN] Created assignment: grade=${gradeId}, subject=${subjectId}`);
          } catch (insertErr) {
            // If duplicate, just log and continue
            if (insertErr.code === '23505') {
              console.log(`⚠️ [ADMIN] Assignment already exists for subject ${subjectId}`);
            } else {
              console.log(`⚠️ [ADMIN] Failed to insert: ${insertErr.message}`);
            }
          }
        }
      }
      
      console.log(`✅ [ADMIN] Created ${assignmentCount} assignments`);

      // Update pending status
      await db.query(`
        UPDATE pending_teachers 
        SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
        WHERE id = $2
      `, [adminId, pendingId]);

      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Teacher approved successfully',
        teacher: {
          id: newTeacher.id,
          email: newTeacher.email,
          firstName: newTeacher.first_name,
          lastName: newTeacher.last_name,
          assignmentsCreated: assignmentCount
        }
      });

    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error approving teacher:', error);
    res.status(500).json({ success: false, message: 'Failed to approve teacher', error: error.message });
  }
};

// ============================================
// REJECT A TEACHER
// ============================================
const rejectTeacher = async (req, res) => {
  try {
    const { pendingId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.userId;

    console.log('🔥 [ADMIN] Rejecting teacher:', pendingId);

    const result = await db.query(`
      UPDATE pending_teachers 
      SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1, rejection_reason = $2
      WHERE id = $3 AND status = 'pending'
      RETURNING id, email
    `, [adminId, reason || 'No reason provided', pendingId]);

    if (result.rows.length === 0) {
      console.log('❌ [ADMIN] Pending teacher not found:', pendingId);
      return res.status(404).json({ success: false, message: 'Pending teacher not found or already processed' });
    }

    console.log('✅ [ADMIN] Teacher rejected:', result.rows[0].email);

    res.json({
      success: true,
      message: 'Teacher registration rejected'
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error rejecting teacher:', error);
    res.status(500).json({ success: false, message: 'Failed to reject teacher' });
  }
};

// ============================================
// CHECK TEACHER STATUS (public - for login page)
// ============================================
const checkTeacherStatus = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    console.log('🔥 [STATUS] Checking status for:', email);

    const pendingResult = await db.query(`
      SELECT email, first_name, last_name, status, 
        requested_at, reviewed_at, rejection_reason
      FROM pending_teachers 
      WHERE email = $1
      ORDER BY requested_at DESC
      LIMIT 1
    `, [email.toLowerCase().trim()]);

    if (pendingResult.rows.length > 0) {
      const pending = pendingResult.rows[0];
      let message = '';
      
      if (pending.status === 'pending') {
        message = 'Your registration is pending admin approval. Please check back later.';
      } else if (pending.status === 'approved') {
        message = 'Your registration has been approved! You can now log in.';
      } else if (pending.status === 'rejected') {
        message = `Your registration was rejected. Reason: ${pending.rejection_reason || 'Not specified'}`;
      }

      return res.json({
        success: true,
        found: true,
        status: pending.status,
        data: {
          email: pending.email,
          firstName: pending.first_name,
          lastName: pending.last_name,
          requestedAt: pending.requested_at,
          reviewedAt: pending.reviewed_at,
          message
        }
      });
    }

    const userResult = await db.query(`
      SELECT id, email, first_name, last_name, is_active
      FROM users 
      WHERE email = $1 AND role = 'teacher'
    `, [email.toLowerCase().trim()]);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      return res.json({
        success: true,
        found: true,
        status: 'approved',
        data: {
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          isActive: user.is_active,
          message: user.is_active
            ? 'Your account is active. You can log in now.'
            : 'Your account has been deactivated. Please contact support.'
        }
      });
    }

    res.json({
      success: true,
      found: false,
      message: 'No registration found with this email. Please register first.'
    });

  } catch (error) {
    console.error('❌ [STATUS] Error checking status:', error);
    res.status(500).json({ success: false, message: 'Failed to check status' });
  }
};

// ============================================
// GET ALL ADMINS
// ============================================
const getAllAdmins = async (req, res) => {
  try {
    console.log('🔥 [ADMIN] Fetching all admins');

    const result = await db.query(`
      SELECT id, email, first_name, last_name, is_active, created_at, last_login
      FROM admins
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      admins: result.rows.map(a => ({
        id: a.id,
        email: a.email,
        firstName: a.first_name,
        lastName: a.last_name,
        isActive: a.is_active,
        createdAt: a.created_at,
        lastLogin: a.last_login
      }))
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching admins:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
};

// ============================================
// CREATE NEW ADMIN
// ============================================
const createAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    console.log('🔥 [ADMIN] Creating new admin:', email);

    const existingAdmin = await db.query('SELECT id FROM admins WHERE email = $1', [email]);
    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered as admin' });
    }

    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered as user' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(`
      INSERT INTO admins (email, password_hash, first_name, last_name, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, email, first_name, last_name, created_at
    `, [email, passwordHash, firstName, lastName]);

    console.log('✅ [ADMIN] Created admin:', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
        createdAt: result.rows[0].created_at
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error creating admin:', error);
    res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
};

// ============================================
// DEACTIVATE/ACTIVATE ADMIN
// ============================================
const toggleAdminStatus = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { isActive } = req.body;
    const currentAdminId = req.user.userId;

    if (adminId === currentAdminId) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    const result = await db.query(`
      UPDATE admins 
      SET is_active = $1
      WHERE id = $2
      RETURNING id, email, is_active
    `, [isActive, adminId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    res.json({
      success: true,
      message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
      admin: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error toggling admin status:', error);
    res.status(500).json({ success: false, message: 'Failed to update admin status' });
  }
};

// ============================================
// GET ALL USERS
// ============================================
const getAllUsers = async (req, res) => {
  try {
    const users = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.created_at, u.grade_id, g.name as grade_name
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      ORDER BY u.created_at DESC
    `);
    
    res.json({ success: true, data: users.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// ============================================
// UPDATE USER STATUS
// ============================================
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, id]);
    res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

// ============================================
// DELETE USER
// ============================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// ============================================
// GET ALL SUBJECTS
// ============================================
const getAllSubjects = async (req, res) => {
  try {
    console.log('[ADMIN] getAllSubjects called');
    
    const subjects = await db.query(`
      SELECT m.id, m.name, m.code, m.description, m.is_active, m.created_at,
             (SELECT COUNT(*) FROM learner_modules WHERE module_id = m.id) as student_count,
             (SELECT COUNT(*) FROM materials WHERE subject_id = m.id) as material_count
      FROM modules m
      ORDER BY m.name
    `);
    
    console.log('[ADMIN] Subjects fetched:', subjects.rows.length);
    res.json({ success: true, data: subjects.rows });
  } catch (error) {
    console.error('[ADMIN] Error fetching subjects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects: ' + error.message });
  }
};

// ============================================
// GET ALL GRADES
// ============================================
const getAllGrades = async (req, res) => {
  try {
    const grades = await db.query('SELECT * FROM grades ORDER BY level');
    res.json({ success: true, data: grades.rows });
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch grades' });
  }
};

// ============================================
// UPDATE SUBJECT STATUS
// ============================================
const updateSubjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    await db.query('UPDATE modules SET is_active = $1 WHERE id = $2', [isActive, id]);
    res.json({ success: true, message: 'Subject status updated' });
  } catch (error) {
    console.error('Error updating subject status:', error);
    res.status(500).json({ success: false, message: 'Failed to update subject status' });
  }
};

// ============================================
// DELETE SUBJECT
// ============================================
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM modules WHERE id = $1', [id]);
    res.json({ success: true, message: 'Subject deleted' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ success: false, message: 'Failed to delete subject' });
  }
};

// ============================================
// GET USER BY ID
// ============================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try users table first
    let result = await db.query(
      `SELECT id, email, first_name, last_name, role, is_active, created_at, last_login 
       FROM users WHERE id = $1`,
      [id]
    );
    
    // If not found, try admins table
    if (result.rows.length === 0) {
      result = await db.query(
        `SELECT id, email, first_name, last_name, 'admin' as role, is_active, created_at, last_login 
         FROM admins WHERE id = $1`,
        [id]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

// ============================================
// UPDATE USER
// ============================================
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, isActive } = req.body;
    
    // Check if user exists in users table
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update user
    await db.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, email = $3, role = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6`,
      [firstName, lastName, email, role, isActive, id]
    );
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

// ============================================
// CREATE SUBJECT
// ============================================
const createSubject = async (req, res) => {
  try {
    const { name, code, description, department, credits } = req.body;
    
    const result = await db.query(
      `INSERT INTO modules (name, code, description, department, credits, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING *`,
      [name, code, description, department || 'General', credits || 1]
    );
    
    res.status(201).json({ success: true, message: 'Subject created', data: result.rows[0] });
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ success: false, message: 'Failed to create subject' });
  }
};

// ============================================
// UPDATE SUBJECT
// ============================================
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, department, credits, isActive } = req.body;
    
    await db.query(
      `UPDATE modules 
       SET name = $1, code = $2, description = $3, department = $4, credits = $5, is_active = $6
       WHERE id = $7`,
      [name, code, description, department, credits, isActive, id]
    );
    
    res.json({ success: true, message: 'Subject updated successfully' });
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ success: false, message: 'Failed to update subject: ' + error.message });
  }
};

// ============================================
// GET SUBJECT BY ID
// ============================================
const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT m.*, 
              (SELECT COUNT(*) FROM learner_modules WHERE module_id = m.id) as student_count,
              (SELECT COUNT(*) FROM materials WHERE subject_id = m.id) as material_count
       FROM modules m WHERE m.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subject' });
  }
};

module.exports = {
  getDashboardStats,
  getPendingTeachers,
  getAllTeachers,
  approveTeacher,
  rejectTeacher,
  checkTeacherStatus,
  getAllAdmins,
  createAdmin,
  toggleAdminStatus,
  getAllUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  getAllGrades,
  updateSubjectStatus,
  deleteSubject
};