const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, restrictTo } = require('../middleware/authMiddleware');

// Public test route
router.get('/test', (req, res) => {
  res.json({ message: 'Notification routes working' });
});

// Protected routes - All authenticated users
router.get('/', authenticate, notificationController.getMyNotifications);
router.get('/stats', authenticate, notificationController.getNotificationStats);
router.get('/unread-count', authenticate, notificationController.getNotificationStats); // Returns same as stats
router.get('/user/:userId', authenticate, notificationController.getForUser);
router.put('/:id/read', authenticate, notificationController.markAsRead);
router.put('/mark-all-read', authenticate, notificationController.markAllAsRead);
router.put('/read-all', authenticate, notificationController.markAllAsRead); // Alias
router.delete('/:id', authenticate, notificationController.deleteNotification);

// Protected routes - Teachers and Admins only (create notification manually)
router.post('/', authenticate, restrictTo('teacher', 'admin'), async (req, res) => {
  // Manual notification creation is handled through materials/deadlines/announcements
  res.status(501).json({ success: false, message: 'Use materials, deadlines, or announcements endpoints to create notifications' });
});

module.exports = router;
