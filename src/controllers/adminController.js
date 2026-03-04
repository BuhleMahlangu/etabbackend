const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/auth');
const db = require('../config/database');

// Get all pending teacher registrations
const getPendingTeachers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        employee_number,
        qualification,
        specialization,
        years_experience,
        bio,
        assignments,
        status,
        requested_at
      FROM pending_teachers
      WHERE status = 'pending'
      ORDER BY requested_at DESC
    `);

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
        assignments: t.assignments,
        status: t.status,
        requestedAt: t.requested_at
      }))
    });
  } catch (error) {
    console.error('Error fetching pending teachers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending teachers' });
  }
};

// Approve a teacher
const approveTeacher = async (req, res) => {
  try {
    const { pendingId } = req.params;
    const adminId = req.user.userId;

    // Get pending teacher data
    const pending = await db.query(
      'SELECT * FROM pending_teachers WHERE id = $1 AND status = $2',
      [pendingId, 'pending']
    );

    if (pending.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending teacher not found or already processed' });
    }

    const teacher = pending.rows[0];
    const academicYear = new Date().getFullYear().toString();

    // Start transaction
    await db.query('BEGIN');

    try {
      // Create user account
      const userResult = await db.query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, role,
          employee_number, qualification, specialization, years_experience, bio,
          is_active
        ) VALUES ($1, $2, $3, $4, 'teacher', $5, $6, $7, $8, $9, true)
        RETURNING id, email, first_name, last_name
      `, [
        teacher.email,
        teacher.password_hash,
        teacher.first_name,
        teacher.last_name,
        teacher.employee_number,
        teacher.qualification,
        teacher.specialization,
        teacher.years_experience,
        teacher.bio
      ]);

      const newTeacher = userResult.rows[0];

      // Create teacher assignments
      const assignments = teacher.assignments || [];
      for (const assignment of assignments) {
        const { gradeId, subjectIds, isPrimary } = assignment;
        
        for (const subjectId of subjectIds) {
          await db.query(`
            INSERT INTO teacher_assignments (
              teacher_id, grade_id, subject_id, academic_year, is_primary, is_active
            ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, true)
            ON CONFLICT (teacher_id, subject_id, academic_year) DO UPDATE
            SET grade_id = $2::uuid, is_primary = $5, is_active = true
          `, [newTeacher.id, gradeId, subjectId, academicYear, isPrimary || false]);
        }
      }

      // Update pending record
      await db.query(`
        UPDATE pending_teachers 
        SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
        WHERE id = $2
      `, [adminId, pendingId]);

      await db.query('COMMIT');

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
      throw err;
    }

  } catch (error) {
    console.error('Error approving teacher:', error);
    res.status(500).json({ success: false, message: 'Failed to approve teacher' });
  }
};

// Reject a teacher
const rejectTeacher = async (req, res) => {
  try {
    const { pendingId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.userId;

    const result = await db.query(`
      UPDATE pending_teachers 
      SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1, rejection_reason = $2
      WHERE id = $3 AND status = 'pending'
      RETURNING id
    `, [adminId, reason || 'No reason provided', pendingId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending teacher not found or already processed' });
    }

    res.json({
      success: true,
      message: 'Teacher registration rejected'
    });

  } catch (error) {
    console.error('Error rejecting teacher:', error);
    res.status(500).json({ success: false, message: 'Failed to reject teacher' });
  }
};

// Get all admins (for admin management)
const getAllAdmins = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, email, first_name, last_name, is_active, created_at
      FROM admins
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      admins: result.rows.map(a => ({
        id: a.id,
        email: a.email,
        firstName: a.first_name,
        lastName: a.last_name,
        isActive: a.is_active,
        createdAt: a.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
};

// Create new admin (by existing admin)
const createAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if email exists
    const existing = await db.query('SELECT id FROM admins WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(`
      INSERT INTO admins (email, password_hash, first_name, last_name, role, is_active)
      VALUES ($1, $2, $3, $4, 'admin', true)
      RETURNING id, email, first_name, last_name
    `, [email, passwordHash, firstName, lastName]);

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
};

module.exports = {
  getPendingTeachers,
  approveTeacher,
  rejectTeacher,
  getAllAdmins,
  createAdmin
};