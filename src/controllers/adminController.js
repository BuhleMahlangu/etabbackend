const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// ============================================
// GET DASHBOARD STATS (School-aware)
// ============================================
const getDashboardStats = async (req, res) => {
  try {
    const { schoolId, isSuperAdmin } = req.user;
    
    console.log('🔥 [ADMIN] Fetching dashboard stats', { schoolId, isSuperAdmin });

    let pendingQuery = "SELECT COUNT(*) FROM pending_teachers WHERE status = 'pending'";
    let teachersQuery = "SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = true";
    let learnersQuery = "SELECT COUNT(*) FROM users WHERE role = 'learner' AND is_active = true";
    let recentPendingQuery = `
      SELECT COUNT(*) FROM pending_teachers 
      WHERE status = 'pending' 
      AND requested_at > NOW() - INTERVAL '7 days'
    `;

    // For school admins, filter by school_id
    if (!isSuperAdmin && schoolId) {
      pendingQuery += ` AND school_id = '${schoolId}'`;
      teachersQuery += ` AND school_id = '${schoolId}'`;
      learnersQuery += ` AND school_id = '${schoolId}'`;
      recentPendingQuery += ` AND school_id = '${schoolId}'`;
    }

    const pendingCount = await db.query(pendingQuery);
    const teachersCount = await db.query(teachersQuery);
    const learnersCount = await db.query(learnersQuery);
    const recentPending = await db.query(recentPendingQuery);

    // Only super admins see total admins count
    let adminsCount = { rows: [{ count: 0 }] };
    if (isSuperAdmin) {
      adminsCount = await db.query("SELECT COUNT(*) FROM admins");
    }

    // Fetch school info for school admins
    let schoolInfo = null;
    if (!isSuperAdmin && schoolId) {
      const schoolResult = await db.query(
        'SELECT id, name, code, address FROM schools WHERE id = $1',
        [schoolId]
      );
      if (schoolResult.rows.length > 0) {
        schoolInfo = schoolResult.rows[0];
      }
    }

    res.json({
      success: true,
      data: {
        pendingTeachers: parseInt(pendingCount.rows[0].count),
        totalTeachers: parseInt(teachersCount.rows[0].count),
        totalLearners: parseInt(learnersCount.rows[0].count),
        totalAdmins: isSuperAdmin ? parseInt(adminsCount.rows[0].count) : null,
        recentPending: parseInt(recentPending.rows[0].count),
        isSuperAdmin,
        school: schoolInfo
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

// ============================================
// GET ALL PENDING TEACHER REGISTRATIONS (School-aware)
// ============================================
const getPendingTeachers = async (req, res) => {
  try {
    const { schoolId, isSuperAdmin } = req.user;
    console.log('🔥 [ADMIN] Fetching pending teachers', { schoolId, isSuperAdmin });

    let query = `
      SELECT 
        id, email, first_name, last_name, employee_number,
        qualification, specialization, years_experience, bio,
        assignments, status, requested_at, school_id
      FROM pending_teachers
      WHERE status = 'pending'
    `;

    // For school admins, only show teachers from their school
    if (!isSuperAdmin && schoolId) {
      query += ` AND school_id = '${schoolId}'`;
    }

    query += ` ORDER BY requested_at DESC`;

    const result = await db.query(query);

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
        requestedAt: t.requested_at,
        schoolId: t.school_id
      }))
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching pending teachers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending teachers' });
  }
};

// ============================================
// APPROVE TEACHER (School-aware)
// ============================================
const approveTeacher = async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const { id } = req.params;
    const { schoolId, isSuperAdmin } = req.user;
    
    console.log('🔥 [ADMIN] Approving teacher:', id, { schoolId, isSuperAdmin });

    await client.query('BEGIN');

    // Get pending teacher - verify they belong to this school
    let pendingQuery = `SELECT * FROM pending_teachers WHERE id = $1 AND status = 'pending'`;
    const pendingResult = await client.query(pendingQuery, [id]);

    if (pendingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Teacher not found or already processed' });
    }

    const pending = pendingResult.rows[0];

    // Check if school admin has permission for this teacher
    if (!isSuperAdmin && schoolId && pending.school_id !== schoolId) {
      await client.query('ROLLBACK');
      console.warn('🚫 [ADMIN] Unauthorized approval attempt:', { 
        adminSchool: schoolId, 
        teacherSchool: pending.school_id 
      });
      return res.status(403).json({ success: false, message: 'You can only approve teachers for your school' });
    }

    // Create user account with school_code
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, school_code, is_active)
       VALUES ($1, $2, $3, $4, 'teacher', $5, $6, true) RETURNING *`,
      [pending.email, pending.password_hash, pending.first_name, pending.last_name, pending.school_id, pending.school_code]
    );
    
    const newTeacherId = userResult.rows[0].id;

    // Assign teacher to the subjects they registered for
    const assignments = pending.assignments || [];
    console.log('🔥 [ADMIN] Teacher assignments from registration:', assignments.length);
    
    for (const assignment of assignments) {
      const gradeId = assignment.gradeId;
      const isPrimary = assignment.isPrimary || false;
      
      for (const subjectId of (assignment.subjectIds || [])) {
        // Find the subject to get its code
        const subjectResult = await client.query(
          'SELECT code, name FROM subjects WHERE id = $1',
          [subjectId]
        );
        
        if (subjectResult.rows.length > 0) {
          const subjectCode = subjectResult.rows[0].code;
          
          // Find the corresponding module with school prefix
          const moduleResult = await client.query(
            'SELECT id FROM modules WHERE code = $1 AND school_id = $2',
            [subjectCode, pending.school_id]
          );
          
          if (moduleResult.rows.length > 0) {
            const moduleId = moduleResult.rows[0].id;
            
            // Create teacher assignment
            await client.query(`
              INSERT INTO teacher_assignments 
                (teacher_id, subject_id, grade_id, is_active, is_primary, academic_year)
              VALUES ($1, $2, $3, true, $4, '2026')
              ON CONFLICT DO NOTHING
            `, [newTeacherId, moduleId, gradeId, isPrimary]);
            
            console.log(`✅ [ADMIN] Assigned to ${subjectCode}`);
          }
        }
      }
    }

    // Update pending status
    await client.query(
      `UPDATE pending_teachers SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1 WHERE id = $2`,
      [req.user.userId, id]
    );

    await client.query('COMMIT');

    console.log('✅ [ADMIN] Teacher approved:', userResult.rows[0].id);

    res.json({
      success: true,
      message: 'Teacher approved successfully',
      teacher: {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        firstName: userResult.rows[0].first_name,
        lastName: userResult.rows[0].last_name
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ADMIN] Error approving teacher:', error);
    res.status(500).json({ success: false, message: 'Failed to approve teacher' });
  } finally {
    client.release();
  }
};

// ============================================
// REJECT TEACHER (School-aware)
// ============================================
const rejectTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { schoolId, isSuperAdmin } = req.user;
    
    console.log('🔥 [ADMIN] Rejecting teacher:', id, { schoolId, isSuperAdmin });

    // Get pending teacher - verify they belong to this school
    let pendingQuery = `SELECT * FROM pending_teachers WHERE id = $1 AND status = 'pending'`;
    const pendingResult = await db.query(pendingQuery, [id]);

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found or already processed' });
    }

    const pending = pendingResult.rows[0];

    // Check if school admin has permission for this teacher
    if (!isSuperAdmin && schoolId && pending.school_id !== schoolId) {
      console.warn('🚫 [ADMIN] Unauthorized rejection attempt');
      return res.status(403).json({ success: false, message: 'You can only reject teachers for your school' });
    }

    await db.query(
      `UPDATE pending_teachers SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1, rejection_reason = $2 WHERE id = $3`,
      [req.user.userId, reason || null, id]
    );

    console.log('✅ [ADMIN] Teacher rejected');

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
// GET ALL TEACHERS (School-aware)
// ============================================
const getAllTeachers = async (req, res) => {
  try {
    const { schoolId, isSuperAdmin } = req.user;
    console.log('🔥 [ADMIN] Fetching all teachers', { schoolId, isSuperAdmin });

    let query = `
      SELECT id, email, first_name, last_name, is_active, created_at, school_id, school_code
      FROM users 
      WHERE role = 'teacher'
    `;

    if (!isSuperAdmin && schoolId) {
      query += ` AND school_id = '${schoolId}'`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query);

    res.json({
      success: true,
      count: result.rows.length,
      teachers: result.rows.map(t => ({
        id: t.id,
        email: t.email,
        firstName: t.first_name,
        lastName: t.last_name,
        isActive: t.is_active,
        createdAt: t.created_at,
        schoolId: t.school_id,
        schoolCode: t.school_code
      }))
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching teachers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch teachers' });
  }
};

// ============================================
// GET ALL LEARNERS (School-aware)
// ============================================
const getAllLearners = async (req, res) => {
  try {
    const { schoolId, isSuperAdmin } = req.user;
    console.log('🔥 [ADMIN] Fetching all learners', { schoolId, isSuperAdmin });

    let query = `
      SELECT id, email, first_name, last_name, grade, current_grade, is_active, created_at, school_id, school_code
      FROM users 
      WHERE role = 'learner'
    `;

    if (!isSuperAdmin && schoolId) {
      query += ` AND school_id = '${schoolId}'`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query);

    res.json({
      success: true,
      count: result.rows.length,
      learners: result.rows.map(l => ({
        id: l.id,
        email: l.email,
        firstName: l.first_name,
        lastName: l.last_name,
        grade: l.grade,
        currentGrade: l.current_grade,
        isActive: l.is_active,
        createdAt: l.created_at,
        schoolId: l.school_id,
        schoolCode: l.school_code
      }))
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching learners:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch learners' });
  }
};

// ============================================
// CHECK TEACHER STATUS
// ============================================
const checkTeacherStatus = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check pending_teachers table FIRST for the most complete status info
    const pendingResult = await db.query(
      "SELECT status, requested_at, reviewed_at, rejection_reason FROM pending_teachers WHERE email = $1",
      [email]
    );

    if (pendingResult.rows.length > 0) {
      const record = pendingResult.rows[0];
      
      if (record.status === 'approved') {
        // Also check users table to confirm account exists
        const userResult = await db.query(
          "SELECT id, role, is_active FROM users WHERE email = $1 AND role = 'teacher'",
          [email]
        );
        
        if (userResult.rows.length > 0) {
          return res.json({
            success: true,
            data: {
              status: 'approved',
              isActive: userResult.rows[0].is_active,
              requestedAt: record.requested_at,
              reviewedAt: record.reviewed_at
            }
          });
        } else {
          // Approved but account not created yet
          return res.json({
            success: true,
            data: {
              status: 'processing',
              message: 'Approval granted, account being created',
              requestedAt: record.requested_at
            }
          });
        }
      } else if (record.status === 'pending') {
        return res.json({
          success: true,
          data: {
            status: 'pending',
            requestedAt: record.requested_at
          }
        });
      } else if (record.status === 'rejected') {
        return res.json({
          success: true,
          data: {
            status: 'rejected',
            requestedAt: record.requested_at,
            reviewedAt: record.reviewed_at,
            rejectionReason: record.rejection_reason
          }
        });
      }
    }

    // Check users table for teachers who may have been added directly
    const userResult = await db.query(
      "SELECT id, role, is_active FROM users WHERE email = $1 AND role = 'teacher'",
      [email]
    );

    if (userResult.rows.length > 0) {
      return res.json({
        success: true,
        data: {
          status: 'approved',
          isActive: userResult.rows[0].is_active
        }
      });
    }

    // Not found
    res.json({
      success: true,
      data: {
        status: 'not_found'
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error checking teacher status:', error);
    res.status(500).json({ success: false, message: 'Failed to check status' });
  }
};

// ============================================
// GET ALL USERS (Learners + Teachers) - School-aware
// ============================================
const getAllUsers = async (req, res) => {
  try {
    const { schoolId, isSuperAdmin } = req.user;
    console.log('🔥 [ADMIN] Fetching all users', { schoolId, isSuperAdmin });

    let query = `
      SELECT id, email, first_name, last_name, role, 
             grade, current_grade, is_active, created_at, school_id, school_code,
             COALESCE(teacher_subjects, '{}') as teacher_subjects
      FROM users 
      WHERE role IN ('learner', 'teacher')
    `;

    // For school admins, only show users from their school
    if (!isSuperAdmin && schoolId) {
      query += ` AND school_id = '${schoolId}'`;
    }

    query += ` ORDER BY role, created_at DESC`;

    const result = await db.query(query);

    // Separate learners and teachers for easier frontend handling
    const learners = result.rows.filter(u => u.role === 'learner').map(l => ({
      id: l.id,
      email: l.email,
      firstName: l.first_name,
      lastName: l.last_name,
      role: l.role,
      grade: l.grade,
      currentGrade: l.current_grade,
      isActive: l.is_active,
      createdAt: l.created_at,
      schoolId: l.school_id,
      schoolCode: l.school_code
    }));

    const teachers = result.rows.filter(u => u.role === 'teacher').map(t => ({
      id: t.id,
      email: t.email,
      firstName: t.first_name,
      lastName: t.last_name,
      role: t.role,
      isActive: t.is_active,
      createdAt: t.created_at,
      schoolId: t.school_id,
      schoolCode: t.school_code,
      subjects: t.teacher_subjects
    }));

    // Combine learners and teachers for backward compatibility
    const allUsers = [...learners, ...teachers];

    res.json({
      success: true,
      count: result.rows.length,
      data: allUsers,  // For backward compatibility
      learners,
      teachers
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// ============================================
// USER MANAGEMENT - GET USER BY ID
// ============================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId, isSuperAdmin } = req.user;

    let query = `
      SELECT id, email, first_name, last_name, role, 
             grade, current_grade, is_active, created_at, school_id, school_code
      FROM users 
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    // Check school permission
    if (!isSuperAdmin && user.school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        grade: user.grade,
        currentGrade: user.current_grade,
        isActive: user.is_active,
        schoolId: user.school_id,
        schoolCode: user.school_code
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

// ============================================
// USER MANAGEMENT - UPDATE USER
// ============================================
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, grade } = req.body;
    const { schoolId, isSuperAdmin } = req.user;

    // Check user exists and belongs to school
    const userCheck = await db.query(
      'SELECT school_id, role FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!isSuperAdmin && userCheck.rows[0].school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Build update query
    let updates = [];
    let params = [];
    let paramCount = 0;

    if (firstName) {
      paramCount++;
      updates.push(`first_name = $${paramCount}`);
      params.push(firstName);
    }

    if (lastName) {
      paramCount++;
      updates.push(`last_name = $${paramCount}`);
      params.push(lastName);
    }

    if (email) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      params.push(email);
    }

    if (grade && userCheck.rows[0].role === 'learner') {
      paramCount++;
      updates.push(`grade = $${paramCount}`);
      params.push(grade);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    paramCount++;
    params.push(id);

    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);

    res.json({
      success: true,
      message: 'User updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

// ============================================
// USER MANAGEMENT - UPDATE USER STATUS
// ============================================
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const { schoolId, isSuperAdmin } = req.user;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be boolean' });
    }

    // Check user exists and belongs to school
    const userCheck = await db.query(
      'SELECT school_id FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!isSuperAdmin && userCheck.rows[0].school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await db.query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [isActive, id]
    );

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

// ============================================
// USER MANAGEMENT - DELETE USER
// ============================================
const deleteUser = async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const { id } = req.params;
    const { schoolId, isSuperAdmin } = req.user;

    await client.query('BEGIN');

    // Check user exists and belongs to school
    const userCheck = await client.query(
      'SELECT school_id, role FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!isSuperAdmin && userCheck.rows[0].school_id !== schoolId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Delete related records first (to avoid foreign key constraints)
    if (userCheck.rows[0].role === 'teacher') {
      await client.query('DELETE FROM teacher_assignments WHERE teacher_id = $1', [id]);
    } else if (userCheck.rows[0].role === 'learner') {
      await client.query('DELETE FROM learner_modules WHERE learner_id = $1', [id]);
      await client.query('DELETE FROM enrollments WHERE learner_id = $1', [id]);
    }

    // Delete user
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ADMIN] Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  } finally {
    client.release();
  }
};

// ============================================
// SUBJECT MANAGEMENT - GET ALL SUBJECTS
// ============================================
const getAllSubjects = async (req, res) => {
  try {
    // Debug: log full req.user to see what's available
    console.log('🔥 [ADMIN] req.user:', req.user);
    
    const { schoolId, isSuperAdmin, table, schoolType } = req.user || {};
    const { phase, grade } = req.query;

    // Treat admins table users as super admins (they don't have school_id)
    const effectiveSuperAdmin = isSuperAdmin || table === 'admins';

    console.log('🔥 [ADMIN] getAllSubjects called:', { schoolId, schoolType, isSuperAdmin, table, effectiveSuperAdmin, phase, grade });

    // Determine which phases to show based on school type
    // Primary: Foundation, Intermediate (Grades 1-7)
    // High: Senior, FET (Grades 8-12)
    // Combined: All phases
    let allowedPhases = [];
    if (schoolType === 'primary_school') {
      allowedPhases = ['Foundation', 'Intermediate'];
    } else if (schoolType === 'high_school') {
      allowedPhases = ['Senior', 'FET'];
    } else {
      // combined or undefined - show all
      allowedPhases = ['Foundation', 'Intermediate', 'Senior', 'FET'];
    }

    // Query subjects with compulsory/optional info from grade_modules
    let query = `
      SELECT s.*, 
             COALESCE(
               (SELECT bool_or(gm.is_compulsory) 
                FROM modules m 
                JOIN grade_modules gm ON m.id = gm.module_id 
                WHERE m.code = s.code AND m.school_id = s.school_id),
               false
             ) as has_compulsory,
             COALESCE(
               (SELECT bool_or(NOT gm.is_compulsory) 
                FROM modules m 
                JOIN grade_modules gm ON m.id = gm.module_id 
                WHERE m.code = s.code AND m.school_id = s.school_id),
               false
             ) as has_optional
      FROM subjects s
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 0;

    // School filter - if not super admin, must filter by school
    if (!effectiveSuperAdmin) {
      if (schoolId) {
        paramCount++;
        query += ` AND s.school_id = $${paramCount}`;
        params.push(schoolId);
        console.log('🔥 [ADMIN] Filtering by schoolId:', schoolId);
        
        // Filter by school type phases (unless specific phase requested)
        if (!phase && allowedPhases.length > 0) {
          const placeholders = allowedPhases.map((_, i) => `$${paramCount + i + 1}`).join(',');
          query += ` AND s.phase IN (${placeholders})`;
          params.push(...allowedPhases);
          paramCount += allowedPhases.length;
          console.log('🔥 [ADMIN] Filtering by school type phases:', allowedPhases);
        }
      } else {
        console.log('❌ [ADMIN] School admin without schoolId!');
        return res.status(403).json({ 
          success: false, 
          message: 'School admin must have school assigned' 
        });
      }
    } else {
      console.log('🔥 [ADMIN] Super admin - no school filter');
    }

    if (phase) {
      paramCount++;
      query += ` AND s.phase = $${paramCount}`;
      params.push(phase);
    }

    if (grade) {
      paramCount++;
      query += ` AND $${paramCount} = ANY(s.applicable_grades)`;
      params.push(grade);
    }

    query += ` ORDER BY s.phase, s.name`;

    console.log('🔥 [ADMIN] Query:', query.substring(0, 100) + '...');
    console.log('🔥 [ADMIN] Params:', params);

    const result = await db.query(query, params);

    console.log('🔥 [ADMIN] Found', result.rows.length, 'subjects');

    // Fetch school info if schoolId is available
    let schoolInfo = null;
    if (schoolId) {
      const schoolResult = await db.query(
        'SELECT id, name, code, school_type FROM schools WHERE id = $1',
        [schoolId]
      );
      schoolInfo = schoolResult.rows[0] || null;
    }

    res.json({
      success: true,
      count: result.rows.length,
      subjects: result.rows,
      school: schoolInfo
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching subjects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
};

// ============================================
// SUBJECT MANAGEMENT - GET SUBJECT BY ID
// ============================================
const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId, isSuperAdmin } = req.user;

    const result = await db.query(
      'SELECT * FROM subjects WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const subject = result.rows[0];

    // Check school permission
    if (!isSuperAdmin && subject.school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({
      success: true,
      subject
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching subject:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subject' });
  }
};

// ============================================
// SUBJECT MANAGEMENT - CREATE SUBJECT
// ============================================
const createSubject = async (req, res) => {
  try {
    const { code, name, phase, applicableGrades, department, credits } = req.body;
    const { schoolId, schoolCode, isSuperAdmin, table } = req.user;
    
    console.log('🔥 [ADMIN] createSubject called');
    console.log('🔥 [ADMIN] Content-Type:', req.headers['content-type']);
    console.log('🔥 [ADMIN] Raw body:', req.body);
    console.log('🔥 [ADMIN] Extracted fields:', { code, name, phase, applicableGrades, department, credits });
    console.log('🔥 [ADMIN] User:', { schoolId, schoolCode, isSuperAdmin, table });

    if (!code || !name || !phase) {
      console.log('❌ [ADMIN] Missing required fields:', { code, name, phase });
      return res.status(400).json({ 
        success: false, 
        message: 'Code, name, and phase are required',
        received: { code, name, phase }
      });
    }

    // Generate unique code with school prefix
    const uniqueCode = `${schoolCode}-${code}`;

    const result = await db.query(
      `INSERT INTO subjects (code, name, phase, applicable_grades, department, credits, school_id, school_code, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
      [uniqueCode, name, phase, applicableGrades || [], department || 'General', credits || 10, schoolId, schoolCode]
    );

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      subject: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error creating subject:', error);
    res.status(500).json({ success: false, message: 'Failed to create subject' });
  }
};

// ============================================
// SUBJECT MANAGEMENT - UPDATE SUBJECT
// ============================================
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, applicableGrades, department, credits, isActive } = req.body;
    const { schoolId, isSuperAdmin } = req.user;

    // Check subject exists and belongs to school
    const subjectCheck = await db.query(
      'SELECT school_id FROM subjects WHERE id = $1',
      [id]
    );

    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    if (!isSuperAdmin && subjectCheck.rows[0].school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let updates = [];
    let params = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (applicableGrades) {
      paramCount++;
      updates.push(`applicable_grades = $${paramCount}`);
      params.push(applicableGrades);
    }

    if (department) {
      paramCount++;
      updates.push(`department = $${paramCount}`);
      params.push(department);
    }

    if (credits) {
      paramCount++;
      updates.push(`credits = $${paramCount}`);
      params.push(credits);
    }

    if (typeof isActive === 'boolean') {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      params.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    paramCount++;
    params.push(id);

    const query = `UPDATE subjects SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);

    res.json({
      success: true,
      message: 'Subject updated successfully',
      subject: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error updating subject:', error);
    res.status(500).json({ success: false, message: 'Failed to update subject' });
  }
};

// ============================================
// SUBJECT MANAGEMENT - DELETE SUBJECT
// ============================================
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId, isSuperAdmin } = req.user;

    // Check subject exists and belongs to school
    const subjectCheck = await db.query(
      'SELECT school_id FROM subjects WHERE id = $1',
      [id]
    );

    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    if (!isSuperAdmin && subjectCheck.rows[0].school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await db.query('DELETE FROM subjects WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Subject deleted successfully'
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error deleting subject:', error);
    res.status(500).json({ success: false, message: 'Failed to delete subject' });
  }
};

// ============================================
// GET ALL GRADES
// ============================================
const getAllGrades = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, level, phase FROM grades ORDER BY level'
    );

    res.json({
      success: true,
      count: result.rows.length,
      grades: result.rows
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching grades:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch grades' });
  }
};

module.exports = {
  getDashboardStats,
  getPendingTeachers,
  approveTeacher,
  rejectTeacher,
  getAllTeachers,
  getAllLearners,
  checkTeacherStatus,
  getAllUsers,
  // User management
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
  // Subject management
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  getAllGrades
};
