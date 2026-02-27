const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { isTeacher, isAdmin } = require('../middleware/roleMiddleware');

// Update marks (teachers only)
router.put('/:enrollmentId/marks', authenticate, isTeacher, enrollmentController.updateMarks);

// Process grade progression (admin only)
router.post('/:learnerId/progress', authenticate, isAdmin, enrollmentController.processGradeProgression);

// Get student report
router.get('/:learnerId/report', authenticate, enrollmentController.getReport);

module.exports = router;