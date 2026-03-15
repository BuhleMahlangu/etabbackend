const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  sendMessage,
  getSubjectMessages,
  getMyConversations,
  getTeacherSubjectStats,
  getSubjectLearners,
  markMessagesAsRead,
  getUnreadCount
} = require('../controllers/subjectMessageController');

// All routes require authentication
router.use(authenticate);

// Send a message
router.post('/messages', sendMessage);

// Get all conversations for current user
router.get('/conversations', getMyConversations);

// Get messages for a specific subject
router.get('/subject/:subjectId', getSubjectMessages);

// Get unread count
router.get('/unread-count', getUnreadCount);

// Mark messages as read
router.put('/mark-read', markMessagesAsRead);

// Teacher routes
router.get('/teacher/subjects', getTeacherSubjectStats);
router.get('/teacher/subject/:subjectId/learners', getSubjectLearners);

module.exports = router;
