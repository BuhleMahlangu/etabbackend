const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticate, restrictTo } = require('../middleware/authMiddleware');

// All routes require authentication and teacher role
router.use(authenticate, restrictTo('teacher', 'admin'));

// Get teacher's dashboard stats
router.get('/dashboard', teacherController.getDashboard);

// Get subjects/modules teacher is assigned to
router.get('/my-assignments', teacherController.getMyAssignments);

// Get all students taught by this teacher
router.get('/my-students', teacherController.getMyStudents);

module.exports = router;
