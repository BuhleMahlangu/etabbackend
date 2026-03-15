const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  getDashboardStats,
  getPendingTeachers,
  getAllTeachers,
  approveTeacher,
  rejectTeacher,
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
} = require('../controllers/adminController');

// All routes require admin authentication
router.use(authenticate);

// Check admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

router.use(requireAdmin);

// ============================================
// DASHBOARD
// ============================================
router.get('/dashboard', getDashboardStats);
// Legacy alias
router.get('/dashboard-stats', getDashboardStats);

// ============================================
// TEACHER MANAGEMENT
// ============================================

// Get all teachers (approved + pending combined)
router.get('/teachers', getAllTeachers);

// Get only pending teachers
router.get('/teachers/pending', getPendingTeachers);
// Legacy alias
router.get('/pending-teachers', getPendingTeachers);

// Teacher approval actions (new RESTful URLs)
router.post('/teachers/:pendingId/approve', approveTeacher);
router.post('/teachers/:pendingId/reject', rejectTeacher);

// Legacy teacher approval URLs (for backward compatibility)
router.post('/approve-teacher/:pendingId', approveTeacher);
router.post('/reject-teacher/:pendingId', rejectTeacher);

// ============================================
// ADMIN MANAGEMENT
// ============================================

// Get all admins
router.get('/admins', getAllAdmins);

// Create new admin
router.post('/admins', createAdmin);
// Legacy alias
router.post('/create-admin', createAdmin);

// Toggle admin status (activate/deactivate)
router.patch('/admins/:adminId/status', toggleAdminStatus);

// ============================================
// USER MANAGEMENT
// ============================================
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// ============================================
// SUBJECT MANAGEMENT
// ============================================
router.get('/subjects', getAllSubjects);
router.get('/subjects/:id', getSubjectById);
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.get('/grades', getAllGrades);
router.put('/subjects/:id/status', updateSubjectStatus);
router.delete('/subjects/:id', deleteSubject);

module.exports = router;