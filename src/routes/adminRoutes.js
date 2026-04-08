const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  getDashboardStats,
  getPendingTeachers,
  getAllTeachers,
  approveTeacher,
  rejectTeacher,
  getAllLearners,
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
} = require('../controllers/adminController');

// All routes require admin authentication
router.use(authenticate);

// Check admin middleware - allows both super admins ('admin') and school admins ('school_admin')
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'school_admin') {
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
router.post('/teachers/:id/approve', approveTeacher);
router.post('/teachers/:id/reject', rejectTeacher);

// Legacy teacher approval URLs (for backward compatibility)
router.post('/approve-teacher/:id', approveTeacher);
router.post('/reject-teacher/:id', rejectTeacher);

// ============================================
// USER MANAGEMENT (LEARNERS)
// ============================================
router.get('/learners', getAllLearners);

// ============================================
// USER MANAGEMENT (ALL USERS - Learners + Teachers)
// ============================================
router.get('/users', getAllUsers);

// User detail management
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// ============================================
// SUBJECT MANAGEMENT
// ============================================
router.get('/subjects', getAllSubjects);
router.get('/subjects/:id', getSubjectById);
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

// ============================================
// GRADE MANAGEMENT
// ============================================
router.get('/grades', getAllGrades);

module.exports = router;
