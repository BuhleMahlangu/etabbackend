const express = require('express');
const router = express.Router();
const { authenticate, restrictTo } = require('../middleware/authMiddleware');
const {
  askTutor,
  getHistory,
  getAllConversations
} = require('../controllers/aiTutorController');

// Learner routes
router.post('/ask', authenticate, restrictTo('learner'), askTutor);
router.get('/history', authenticate, restrictTo('learner'), getHistory);

// Teacher/Admin routes (monitoring)
router.get('/monitor', authenticate, restrictTo('teacher', 'admin'), getAllConversations);

module.exports = router;
