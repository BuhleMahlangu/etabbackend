const express = require('express');
const router = express.Router();
const { authenticate, restrictTo } = require('../middleware/authMiddleware');
const { attachSchoolContext } = require('../middleware/schoolMiddleware');
const {
  createSchool,
  getAllSchools,
  getMySchool,
  updateSchool,
  updateSubscription,
  updateSMTPSettings,
  getSMTPSettings
} = require('../controllers/schoolController');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================
const db = require('../config/database');

// Register new school - PUBLIC
router.post('/register', createSchool);

// Verify school code - PUBLIC (for user registration)
router.get('/verify/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const result = await db.query(
      `SELECT id, name, code, province, logo_url, is_active 
       FROM schools 
       WHERE code = $1`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    const school = result.rows[0];

    if (!school.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This school account has been suspended'
      });
    }

    res.json({
      success: true,
      data: school
    });

  } catch (error) {
    console.error('[School] Verify error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify school' });
  }
});

// ============================================
// SUPER ADMIN ROUTES (All Schools)
// ============================================

// Create new school (super admin only)
router.post('/',
  authenticate,
  restrictTo('super_admin'),
  createSchool
);

// List all schools
router.get('/',
  authenticate,
  restrictTo('super_admin'),
  getAllSchools
);

// Update school subscription (super admin only)
router.put('/:schoolId/subscription',
  authenticate,
  restrictTo('super_admin'),
  updateSubscription
);

// ============================================
// SCHOOL ADMIN ROUTES (Own School Only)
// ============================================

// Get current school details
router.get('/my',
  authenticate,
  attachSchoolContext,
  getMySchool
);

// Update current school
router.put('/my',
  authenticate,
  attachSchoolContext,
  updateSchool
);

// ============================================
// SMTP SETTINGS ROUTES (Super Admin)
// ============================================

// Get school SMTP settings
router.get('/:schoolId/smtp',
  authenticate,
  restrictTo('super_admin', 'school_admin'),
  getSMTPSettings
);

// Update school SMTP settings
router.put('/:schoolId/smtp',
  authenticate,
  restrictTo('super_admin', 'school_admin'),
  updateSMTPSettings
);

module.exports = router;
