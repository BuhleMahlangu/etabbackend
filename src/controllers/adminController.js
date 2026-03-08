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
    `, [new Date().getFullYear().toString()]);

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
// APPROVE A TEACHER - WITH VALIDATION
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
    const academicYear = new Date().getFullYear().toString();

    await db.query('BEGIN');

    try {
      // INSERT ONLY columns that exist in your users table
      const userResult = await db.query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'teacher', true, NOW(), NOW())
        RETURNING id, email, first_name, last_name
      `, [
        teacher.email,
        teacher.password_hash,
        teacher.first_name,
        teacher.last_name
      ]);

      const newTeacher = userResult.rows[0];
      console.log('✅ [ADMIN] Created user account:', newTeacher.id);

      // Create teacher assignments from the assignments JSON
      const assignments = typeof teacher.assignments === 'string' 
        ? JSON.parse(teacher.assignments) 
        : teacher.assignments || [];

      let assignmentCount = 0;
      let skippedCount = 0;

      for (const assignment of assignments) {
        const { gradeId, subjectIds, isPrimary } = assignment;
        
        // Skip if gradeId is missing
        if (!gradeId) {
          console.log('⚠️ [ADMIN] Skipping assignment - missing gradeId');
          skippedCount++;
          continue;
        }

        // Validate grade exists
        const gradeCheck = await db.query('SELECT id FROM grades WHERE id = $1', [gradeId]);
        if (gradeCheck.rows.length === 0) {
          console.log(`⚠️ [ADMIN] Skipping assignment - grade not found: ${gradeId}`);
          skippedCount++;
          continue;
        }

        // Skip if subjectIds is empty or not an array
        if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
          console.log('⚠️ [ADMIN] Skipping assignment - no subjects provided');
          skippedCount++;
          continue;
        }

        for (const subjectId of subjectIds) {
          // Skip empty subject IDs
          if (!subjectId) {
            console.log('⚠️ [ADMIN] Skipping empty subjectId');
            skippedCount++;
            continue;
          }

          // Validate subject exists before inserting
          const subjectCheck = await db.query('SELECT id FROM subjects WHERE id = $1', [subjectId]);
          
          if (subjectCheck.rows.length === 0) {
            console.log(`⚠️ [ADMIN] Skipping invalid subject_id: ${subjectId}`);
            skippedCount++;
            continue;
          }

          try {
            await db.query(`
              INSERT INTO teacher_assignments (
                teacher_id, grade_id, subject_id, academic_year, is_primary, is_active
              ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, true)
              ON CONFLICT (teacher_id, subject_id, academic_year) DO UPDATE
              SET grade_id = $2::uuid, is_primary = $5, is_active = true
            `, [newTeacher.id, gradeId, subjectId, academicYear, isPrimary || false]);
            assignmentCount++;
          } catch (insertErr) {
            console.log(`⚠️ [ADMIN] Failed to insert assignment for subject ${subjectId}:`, insertErr.message);
            skippedCount++;
          }
        }
      }
      
      console.log(`✅ [ADMIN] Created ${assignmentCount} assignments, skipped ${skippedCount}`);

      // Update pending record - REMOVED user_id column (doesn't exist)
      await db.query(`
        UPDATE pending_teachers 
        SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
        WHERE id = $2
      `, [adminId, pendingId]);

      // Create welcome notification
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, $2, $3, 'success')
      `, [
        newTeacher.id,
        'Registration Approved!',
        'Your teacher registration has been approved. You can now log in and start teaching.'
      ]);

      await db.query('COMMIT');
      console.log('✅ [ADMIN] Teacher approved successfully:', teacher.email);

      res.json({
        success: true,
        message: 'Teacher approved and account created successfully',
        teacher: {
          id: newTeacher.id,
          email: newTeacher.email,
          firstName: newTeacher.first_name,
          lastName: newTeacher.last_name
        }
      });

    } catch (err) {
      await db.query('ROLLBACK');
      console.error('❌ [ADMIN] Transaction failed:', err);
      throw err;
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error approving teacher:', error);
    res.status(500).json({ success: false, message: 'Failed to approve teacher' });
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

module.exports = {
  getDashboardStats,
  getPendingTeachers,
  getAllTeachers,
  approveTeacher,
  rejectTeacher,
  checkTeacherStatus,
  getAllAdmins,
  createAdmin,
  toggleAdminStatus
};