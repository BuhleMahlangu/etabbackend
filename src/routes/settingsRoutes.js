const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticate);

// Get user settings
router.get('/', settingsController.getUserSettings);

// Update profile (works for both teachers and learners)
router.put('/profile', settingsController.updateProfile);

// Password change with 2-step verification
router.post('/password/request-change', settingsController.requestPasswordChange);
router.post('/password/verify-change', settingsController.verifyAndChangePassword);
router.post('/password/resend-code', settingsController.resend2FACode);

// Notification preferences
router.put('/notifications', settingsController.updateNotificationPreferences);

module.exports = router;
