const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

// All routes require admin authentication
router.use(authenticate);

// Check admin middleware
const requireAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

router.use(requireAdmin);

// Pending teacher management
router.get('/pending-teachers', adminController.getPendingTeachers);
router.post('/approve-teacher/:pendingId', adminController.approveTeacher);
router.post('/reject-teacher/:pendingId', adminController.rejectTeacher);

// Admin management
router.get('/admins', adminController.getAllAdmins);
router.post('/create-admin', adminController.createAdmin);

module.exports = router;