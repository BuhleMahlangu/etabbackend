const express = require('express');
const router = express.Router();
const { authenticate, restrictTo } = require('../middleware/authMiddleware');

// Notification controller functions
const notificationController = {
  // Get all notifications for the logged-in user
  getMyNotifications: async (req, res) => {
    try {
      // Mock data - replace with actual database query
      const notifications = [
        {
          id: 1,
          title: 'New Assignment Posted',
          message: 'A new assignment "Introduction to Programming" has been posted in CS101',
          type: 'assignment',
          isRead: false,
          createdAt: '2024-01-20T10:00:00Z',
          link: '/subjects/CS101'
        },
        {
          id: 2,
          title: 'Deadline Reminder',
          message: 'Assignment 1 is due in 2 days',
          type: 'deadline',
          isRead: false,
          createdAt: '2024-01-19T09:00:00Z',
          link: '/deadlines/1'
        },
        {
          id: 3,
          title: 'Grade Posted',
          message: 'Your grade for Midterm Exam has been posted',
          type: 'grade',
          isRead: true,
          createdAt: '2024-01-18T14:30:00Z',
          link: '/grades'
        }
      ];

      res.status(200).json({
        success: true,
        count: notifications.length,
        unreadCount: notifications.filter(n => !n.isRead).length,
        data: notifications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching notifications',
        error: error.message
      });
    }
  },

  // Get single notification
  getNotificationById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const notification = {
        id: parseInt(id),
        title: 'New Assignment Posted',
        message: 'A new assignment has been posted',
        type: 'assignment',
        isRead: false,
        createdAt: '2024-01-20T10:00:00Z',
        link: '/subjects/CS101'
      };

      res.status(200).json({
        success: true,
        data: notification
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching notification',
        error: error.message
      });
    }
  },

  // Create notification (admin/teacher only)
  createNotification: async (req, res) => {
    try {
      const { title, message, type, recipients, link } = req.body;

      // Validation
      if (!title || !message || !type) {
        return res.status(400).json({
          success: false,
          message: 'Please provide title, message, and type'
        });
      }

      // Mock creation
      const newNotification = {
        id: Date.now(),
        title,
        message,
        type,
        recipients: recipients || 'all',
        link,
        createdBy: req.user.userId,
        createdAt: new Date().toISOString(),
        isRead: false
      };

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: newNotification
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating notification',
        error: error.message
      });
    }
  },

  // Mark notification as read
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;

      res.status(200).json({
        success: true,
        message: `Notification ${id} marked as read`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error marking notification as read',
        error: error.message
      });
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (req, res) => {
    try {
      res.status(200).json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error marking notifications as read',
        error: error.message
      });
    }
  },

  // Delete notification
  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;

      res.status(200).json({
        success: true,
        message: `Notification ${id} deleted successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting notification',
        error: error.message
      });
    }
  },

  // Get unread count (for navbar badge)
  getUnreadCount: async (req, res) => {
    try {
      // Mock count
      const unreadCount = 2;

      res.status(200).json({
        success: true,
        count: unreadCount
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching unread count',
        error: error.message
      });
    }
  }
};

// Routes

// Public test route
router.get('/test', (req, res) => {
  res.json({ message: 'Notification routes working' });
});

// Protected routes - All authenticated users
router.get('/', authenticate, notificationController.getMyNotifications);
router.get('/unread-count', authenticate, notificationController.getUnreadCount);
router.get('/:id', authenticate, notificationController.getNotificationById);
router.put('/:id/read', authenticate, notificationController.markAsRead);
router.put('/mark-all-read', authenticate, notificationController.markAllAsRead);
router.delete('/:id', authenticate, notificationController.deleteNotification);

// Protected routes - Teachers and Admins only
router.post('/', authenticate, restrictTo('teacher', 'admin'), notificationController.createNotification);

module.exports = router;