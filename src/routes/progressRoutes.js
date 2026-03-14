const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { authenticate } = require('../middleware/authMiddleware');

// Get overall learner progress
router.get('/my-progress', authenticate, progressController.getLearnerProgress);

// Get progress history for charts
router.get('/history', authenticate, progressController.getProgressHistory);

// Get detailed progress for a specific subject
router.get('/subject/:subjectId', authenticate, progressController.getSubjectProgress);

module.exports = router;
