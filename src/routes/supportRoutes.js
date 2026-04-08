const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  sendMessageToAdmin,
  sendMessageToSuperAdmin,
  getMyMessages,
  getAllSupportMessages,
  getSuperAdminMessages,
  getSupportMessageById,
  respondToMessage,
  updateMessageStatus,
  deleteMessage,
  getUnreadSupportCount,
  markMessageAsRead
} = require('../controllers/supportController');

// All routes require authentication
router.use(authenticate);

// ============================================
// USER ROUTES (Teacher/Learner)
// ============================================
router.post('/messages', sendMessageToAdmin);
router.get('/my-messages', getMyMessages);
router.get('/unread-count', getUnreadSupportCount); // For badge notification
router.put('/messages/:id/read', markMessageAsRead); // Mark as read when viewed

// ============================================
// ADMIN ROUTES
// ============================================
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'school_admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

// ============================================
// SCHOOL ADMIN ROUTES (Contact Super Admin)
// ============================================
const requireSchoolAdmin = (req, res, next) => {
  if (req.user.role !== 'school_admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'School Admin access required' 
    });
  }
  next();
};

router.post('/super-admin', requireSchoolAdmin, sendMessageToSuperAdmin);

// ============================================
// SUPER ADMIN ROUTES
// ============================================
const requireSuperAdmin = (req, res, next) => {
  if (!req.user.isSuperAdmin && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Super Admin access required' 
    });
  }
  next();
};

router.get('/super-admin/messages', requireSuperAdmin, getSuperAdminMessages);

// ============================================
// ADMIN ROUTES (School Admin - manage their school messages)
// ============================================
router.use('/admin', requireAdmin);
router.get('/admin/messages', getAllSupportMessages);
router.get('/admin/messages/:id', getSupportMessageById);
router.put('/admin/messages/:id/respond', respondToMessage);
router.put('/admin/messages/:id/status', updateMessageStatus);
router.delete('/admin/messages/:id', deleteMessage);

module.exports = router;
