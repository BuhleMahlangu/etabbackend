const db = require('../config/database');
const bcrypt = require('bcrypt');
const { generateToken } = require('../config/auth');

// ============================================
// SUPER ADMIN: CREATE NEW SCHOOL
// ============================================
const createSchool = async (req, res) => {
  let client;
  
  try {
    const {
      name,
      code,
      address,
      phone,
      email,
      principalName,
      emisNumber,
      province,
      subscriptionPlan = 'free',
      maxTeachers = 10,
      maxLearners = 500,
      adminEmail,
      adminFirstName,
      adminLastName,
      adminPassword
    } = req.body;

    console.log('[School] Registration attempt:', { name, code, adminEmail });

    // Validate required fields
    if (!name || !code || !adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      return res.status(400).json({
        success: false,
        message: 'School name, code, admin first name, last name, email, and password are required'
      });
    }

    // Check if code already exists
    const existingSchool = await db.query(
      'SELECT id FROM schools WHERE code = $1',
      [code.toUpperCase()]
    );

    if (existingSchool.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'School code already exists'
      });
    }

    // Check if admin email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Admin email already registered'
      });
    }

    // Start transaction
    const { pool } = db;
    if (!pool) {
      throw new Error('Database pool not available');
    }
    client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create school
      const schoolResult = await client.query(
        `INSERT INTO schools (name, code, address, phone, email, principal_name, emis_number, province, subscription_plan, max_teachers, max_learners)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          name,
          code.toUpperCase(),
          address || null,
          phone || null,
          email || null,
          principalName || null,
          emisNumber || null,
          province || null,
          subscriptionPlan,
          maxTeachers,
          maxLearners
        ]
      );

      const school = schoolResult.rows[0];
      console.log('[School] Created:', school.id);

      // Hash admin password
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Create first school admin with role='school_admin' and school_code
      const adminResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, school_code, is_active)
         VALUES ($1, $2, $3, $4, 'school_admin', $5, $6, true) RETURNING *`,
        [adminEmail, hashedPassword, adminFirstName, adminLastName, school.id, school.code]
      );

      const admin = adminResult.rows[0];
      console.log('[School] Admin created:', admin.id);

      // Add to school_admins table (if it exists)
      try {
        await client.query(
          `INSERT INTO school_admins (school_id, user_id, role, permissions)
           VALUES ($1, $2, 'principal', $3)`,
          [school.id, admin.id, JSON.stringify({ all: true })]
        );
      } catch (adminTableErr) {
        console.log('[School] school_admins table may not exist, skipping');
      }

      // Create default subjects for the new school
      console.log('[School] Creating default subjects...');
      await createDefaultSubjectsForSchool(client, school.id, school.code);
      console.log('[School] Default subjects created');

      await client.query('COMMIT');
      console.log('[School] Transaction committed successfully');

      res.status(201).json({
        success: true,
        message: 'School created successfully',
        data: {
          school: {
            id: school.id,
            name: school.name,
            code: school.code,
            subscriptionPlan: school.subscription_plan
          },
          admin: {
            id: admin.id,
            email: admin.email,
            name: `${admin.first_name} ${admin.last_name}`
          }
        }
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[School] Transaction error:', err.message);
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[School] ================================');
    console.error('[School] ERROR:', error.message);
    console.error('[School] Stack:', error.stack);
    console.error('[School] ================================');
    res.status(500).json({
      success: false,
      message: 'Failed to create school: ' + error.message
    });
  }
};

// ============================================
// SUPER ADMIN: GET ALL SCHOOLS
// ============================================
const getAllSchools = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];
    let paramCount = 0;

    if (status) {
      whereClause += ` WHERE is_active = $${++paramCount}`;
      params.push(status === 'active');
    }

    if (search) {
      whereClause += whereClause ? ' AND' : ' WHERE';
      whereClause += ` (name ILIKE $${++paramCount} OR code ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Get schools with stats
    const schoolsResult = await db.query(
      `SELECT 
        s.*,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'teacher') as teacher_count,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'learner') as learner_count
       FROM schools s
       LEFT JOIN users u ON s.id = u.school_id
       ${whereClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT $${++paramCount} OFFSET $${++paramCount}`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM schools ${whereClause}`,
      params.slice(0, paramCount)
    );

    res.json({
      success: true,
      data: {
        schools: schoolsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      }
    });

  } catch (error) {
    console.error('[School] List error:', error);
    res.status(500).json({ success: false, message: 'Failed to get schools' });
  }
};

// ============================================
// GET CURRENT SCHOOL DETAILS
// For school admins viewing their own school
// ============================================
const getMySchool = async (req, res) => {
  try {
    const schoolId = req.schoolId;

    const result = await db.query(
      `SELECT 
        s.*,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'teacher' AND u.is_active = true) as active_teachers,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'learner' AND u.is_active = true) as active_learners,
        COUNT(DISTINCT m.id) as total_subjects
       FROM schools s
       LEFT JOIN users u ON s.id = u.school_id
       LEFT JOIN modules m ON s.id = m.school_id
       WHERE s.id = $1
       GROUP BY s.id`,
      [schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    const school = result.rows[0];

    // Check if approaching limits
    const warnings = [];
    if (school.active_teachers >= school.max_teachers * 0.9) {
      warnings.push(`Approaching teacher limit (${school.active_teachers}/${school.max_teachers})`);
    }
    if (school.active_learners >= school.max_learners * 0.9) {
      warnings.push(`Approaching learner limit (${school.active_learners}/${school.max_learners})`);
    }

    res.json({
      success: true,
      data: {
        ...school,
        warnings
      }
    });

  } catch (error) {
    console.error('[School] Get error:', error);
    res.status(500).json({ success: false, message: 'Failed to get school details' });
  }
};

// ============================================
// UPDATE SCHOOL SETTINGS
// ============================================
const updateSchool = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const updates = req.body;

    // Fields that can be updated by school admin
    const allowedFields = ['name', 'address', 'phone', 'email', 'principal_name', 'logo_url'];
    
    const setClause = [];
    const values = [];
    let paramCount = 0;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${++paramCount}`);
        values.push(value);
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    values.push(schoolId);
    
    const result = await db.query(
      `UPDATE schools SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = $${++paramCount} RETURNING *`,
      values
    );

    res.json({
      success: true,
      message: 'School updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('[School] Update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update school' });
  }
};

// ============================================
// SUPER ADMIN: UPDATE SUBSCRIPTION
// ============================================
const updateSubscription = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { plan, maxTeachers, maxLearners, expiresAt } = req.body;

    const result = await db.query(
      `UPDATE schools 
       SET subscription_plan = $1, max_teachers = $2, max_learners = $3, subscription_expires_at = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [plan, maxTeachers, maxLearners, expiresAt, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    res.json({
      success: true,
      message: 'Subscription updated',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('[School] Subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to update subscription' });
  }
};

// ============================================
// HELPER: Create Default Subjects for New School
// ============================================
const createDefaultSubjectsForSchool = async (client, schoolId, schoolCode) => {
  const subjects = [
    // Foundation Phase
    { name: 'Home Language', code: 'HL-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Languages' },
    { name: 'First Additional Language', code: 'FAL-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Languages' },
    { name: 'Mathematics', code: 'MATH-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Mathematics' },
    { name: 'Life Skills', code: 'LS-F', phase: 'Foundation', grades: ['Grade 1', 'Grade 2', 'Grade 3'], dept: 'Life Skills' },
    
    // Intermediate Phase
    { name: 'Home Language', code: 'HL-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Languages' },
    { name: 'First Additional Language', code: 'FAL-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Languages' },
    { name: 'Mathematics', code: 'MATH-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Mathematics' },
    { name: 'Natural Sciences', code: 'NS-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Sciences' },
    { name: 'Social Sciences', code: 'SS-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Social Sciences' },
    { name: 'Life Skills', code: 'LS-I', phase: 'Intermediate', grades: ['Grade 4', 'Grade 5', 'Grade 6'], dept: 'Life Skills' },
    
    // Senior Phase
    { name: 'English Home Language', code: 'ENG-H', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Languages' },
    { name: 'isiZulu First Additional', code: 'ZUL-FAL', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Languages' },
    { name: 'Mathematics', code: 'MATH-S', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Mathematics' },
    { name: 'Natural Sciences', code: 'NS-S', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Sciences' },
    { name: 'Social Sciences', code: 'SS-S', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Social Sciences' },
    { name: 'Economic Management Sciences', code: 'EMS', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Business' },
    { name: 'Life Orientation', code: 'LO', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Life Skills' },
    { name: 'Creative Arts', code: 'CA', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Arts' },
    { name: 'Technology', code: 'TECH', phase: 'Senior', grades: ['Grade 7', 'Grade 8', 'Grade 9'], dept: 'Technology' },
    
    // FET Phase
    { name: 'English Home Language', code: 'ENG-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Languages' },
    { name: 'isiZulu First Additional', code: 'ZUL-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Languages' },
    { name: 'Mathematics', code: 'MATH-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Mathematics' },
    { name: 'Mathematical Literacy', code: 'MATH-LIT', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Mathematics' },
    { name: 'Life Sciences', code: 'LIFE-SCI', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Sciences' },
    { name: 'Physical Sciences', code: 'PHY-SCI', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Sciences' },
    { name: 'Geography', code: 'GEO', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Sciences' },
    { name: 'History', code: 'HIST', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Social Sciences' },
    { name: 'Accounting', code: 'ACC', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Business' },
    { name: 'Business Studies', code: 'BUS', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Business' },
    { name: 'Economics', code: 'ECON', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Business' },
    { name: 'Life Orientation', code: 'LO-FET', phase: 'FET', grades: ['Grade 10', 'Grade 11', 'Grade 12'], dept: 'Life Skills' }
  ];

  // Prefix codes with school code to ensure uniqueness
  for (const subj of subjects) {
    const uniqueCode = `${schoolCode}-${subj.code}`;
    
    // Create subject
    const subjectResult = await client.query(`
      INSERT INTO subjects (
        code, name, phase, applicable_grades, department,
        school_id, school_code, is_active, is_compulsory, credits
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, 10)
      ON CONFLICT (code) DO NOTHING
      RETURNING id
    `, [
      uniqueCode,
      subj.name,
      subj.phase,
      subj.grades,
      subj.dept,
      schoolId,
      schoolCode
    ]);
    
    // Also create corresponding module (needed for teacher assignments and learner enrollments)
    if (subjectResult.rows.length > 0) {
      const moduleResult = await client.query(`
        INSERT INTO modules (
          code, name, description, department, credits,
          school_id, school_code, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      `, [
        uniqueCode,
        subj.name,
        `${subj.name} - ${subj.phase} Phase`,
        subj.dept,
        10,
        schoolId,
        schoolCode
      ]);
      
      // Create grade_modules entries to link module to grades
      if (moduleResult.rows.length > 0) {
        const moduleId = moduleResult.rows[0].id;
        
        for (const gradeName of subj.grades) {
          // Get grade ID from name
          const gradeResult = await client.query(
            'SELECT id FROM grades WHERE name = $1',
            [gradeName]
          );
          
          if (gradeResult.rows.length > 0) {
            const gradeId = gradeResult.rows[0].id;
            
            await client.query(`
              INSERT INTO grade_modules (grade_id, module_id, is_compulsory)
              VALUES ($1, $2, true)
              ON CONFLICT DO NOTHING
            `, [gradeId, moduleId]);
          }
        }
      }
    }
  }
};

// ============================================
// UPDATE SCHOOL SMTP SETTINGS
// ============================================
const updateSMTPSettings = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      smtp_from_email,
      smtp_from_name,
      smtp_secure,
      smtp_enabled
    } = req.body;

    console.log('[School] Updating SMTP settings for school:', schoolId);

    // Verify school exists
    const schoolCheck = await db.query(
      'SELECT id, name FROM schools WHERE id = $1',
      [schoolId]
    );

    if (schoolCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    // Update SMTP settings
    const result = await db.query(
      `UPDATE schools 
       SET smtp_host = $1,
           smtp_port = $2,
           smtp_user = $3,
           smtp_password = $4,
           smtp_from_email = $5,
           smtp_from_name = $6,
           smtp_secure = $7,
           smtp_enabled = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING id, name, smtp_host, smtp_port, smtp_user, smtp_from_email, smtp_from_name, smtp_secure, smtp_enabled`,
      [
        smtp_host,
        smtp_port || 587,
        smtp_user,
        smtp_password,
        smtp_from_email,
        smtp_from_name,
        smtp_secure || false,
        smtp_enabled || false,
        schoolId
      ]
    );

    // Clear transporter cache so new settings take effect
    const { clearSchoolTransporter } = require('../config/email');
    clearSchoolTransporter(schoolId);

    console.log('[School] SMTP settings updated for:', result.rows[0].name);

    res.json({
      success: true,
      message: 'SMTP settings updated successfully',
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        smtp_host: result.rows[0].smtp_host,
        smtp_port: result.rows[0].smtp_port,
        smtp_user: result.rows[0].smtp_user,
        smtp_from_email: result.rows[0].smtp_from_email,
        smtp_from_name: result.rows[0].smtp_from_name,
        smtp_secure: result.rows[0].smtp_secure,
        smtp_enabled: result.rows[0].smtp_enabled
      }
    });

  } catch (error) {
    console.error('[School] Error updating SMTP settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update SMTP settings' });
  }
};

// ============================================
// GET SCHOOL SMTP SETTINGS
// ============================================
const getSMTPSettings = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const result = await db.query(
      `SELECT id, name, smtp_host, smtp_port, smtp_user, smtp_from_email, 
              smtp_from_name, smtp_secure, smtp_enabled
       FROM schools 
       WHERE id = $1`,
      [schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    // Don't return password for security
    const settings = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: settings.id,
        name: settings.name,
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_user: settings.smtp_user,
        smtp_from_email: settings.smtp_from_email,
        smtp_from_name: settings.smtp_from_name,
        smtp_secure: settings.smtp_secure,
        smtp_enabled: settings.smtp_enabled,
        is_configured: !!(settings.smtp_host && settings.smtp_user && settings.smtp_enabled)
      }
    });

  } catch (error) {
    console.error('[School] Error getting SMTP settings:', error);
    res.status(500).json({ success: false, message: 'Failed to get SMTP settings' });
  }
};

module.exports = {
  createSchool,
  getAllSchools,
  getMySchool,
  updateSchool,
  updateSubscription,
  updateSMTPSettings,
  getSMTPSettings
};
