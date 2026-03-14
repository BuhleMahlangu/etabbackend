const express = require('express');
const router = express.Router();
const deadlineController = require('../controllers/deadlineController');
const { authenticate } = require('../middleware/authMiddleware');

// Get learner deadlines (assignments + quizzes)
router.get('/my-deadlines', authenticate, deadlineController.getLearnerDeadlines);

module.exports = router;
