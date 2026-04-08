const db = require('../config/database');

// ============================================
// SCHOOL CONTEXT MIDDLEWARE
// Attaches school_id to request from user's JWT
// ============================================
const attachSchoolContext = async (req, res, next) => {
  try {
    // Super admin can access all schools via header
    if (req.user.role === 'super_admin' && req.headers['x-school-id']) {
      req.schoolId = req.headers['x-school-id'];
      req.isSuperAdmin = true;
      return next();
    }

    // Regular users - get school from their profile
    if (req.user.schoolId) {
      req.schoolId = req.user.schoolId;
      req.isSuperAdmin = false;
      return next();
    }

    // If user has no school assigned
    console.error('[School] User has no school_id:', req.user.userId);
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to any school. Please contact support.'
    });

  } catch (error) {
    console.error('[School] Middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'School context error'
    });
  }
};

// ============================================
// CHECK SCHOOL ACCESS
// For teachers accessing cross-school resources
// ============================================
const checkSchoolAccess = async (req, res, next) => {
  try {
    const resourceId = req.params.id;
    const table = req.resourceTable; // Set by previous middleware

    if (!table || !resourceId) {
      return next();
    }

    // Super admin can access anything
    if (req.isSuperAdmin) {
      return next();
    }

    // Check if resource belongs to user's school
    const result = await db.query(
      `SELECT school_id FROM ${table} WHERE id = $1`,
      [resourceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (result.rows[0].school_id !== req.schoolId) {
      console.warn('[School] Access denied:', req.user.userId, 'tried accessing', table, resourceId);
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    next();

  } catch (error) {
    console.error('[School] Access check error:', error);
    return res.status(500).json({ success: false, message: 'Access check failed' });
  }
};

// ============================================
// VERIFY SCHOOL ACTIVE
// Check if school's subscription is valid
// ============================================
const verifySchoolActive = async (req, res, next) => {
  try {
    const schoolResult = await db.query(
      `SELECT is_active, subscription_expires_at FROM schools WHERE id = $1`,
      [req.schoolId]
    );

    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    const school = schoolResult.rows[0];

    if (!school.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your school account has been suspended. Please contact support.'
      });
    }

    if (school.subscription_expires_at && new Date(school.subscription_expires_at) < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Your school subscription has expired. Please renew to continue.'
      });
    }

    next();

  } catch (error) {
    console.error('[School] Verification error:', error);
    return res.status(500).json({ success: false, message: 'School verification failed' });
  }
};

module.exports = {
  attachSchoolContext,
  checkSchoolAccess,
  verifySchoolActive
};
