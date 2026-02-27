const express = require('express');
const router = express.Router();
const { authenticate, restrictTo } = require('../middleware/authMiddleware');

// Deadline controller functions (renamed from 'authenticate' to 'deadlineController')
const deadlineController = {
  getAllDeadlines: async (req, res) => {
    try {
      // Mock data - replace with actual database query
      const deadlines = [
        {
          id: 1,
          title: 'Assignment 1: Introduction to Programming',
          description: 'Submit your first programming assignment',
          subject: 'CS101',
          dueDate: '2024-02-15T23:59:00Z',
          type: 'assignment',
          status: 'active',
          createdBy: 'teacher1',
          createdAt: '2024-01-20T10:00:00Z'
        },
        {
          id: 2,
          title: 'Midterm Exam',
          description: 'Covers chapters 1-5',
          subject: 'MATH201',
          dueDate: '2024-03-01T14:00:00Z',
          type: 'exam',
          status: 'active',
          createdBy: 'teacher2',
          createdAt: '2024-01-25T09:00:00Z'
        },
        {
          id: 3,
          title: 'Project Proposal',
          description: 'Submit your final project proposal',
          subject: 'CS101',
          dueDate: '2024-02-28T23:59:00Z',
          type: 'project',
          status: 'active',
          createdBy: 'teacher1',
          createdAt: '2024-01-22T11:00:00Z'
        }
      ];
      
      res.status(200).json({
        success: true,
        count: deadlines.length,
        data: deadlines
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching deadlines',
        error: error.message
      });
    }
  },

  getDeadlineById: async (req, res) => {
    try {
      const { id } = req.params;
      // Mock data - replace with actual database query
      const deadline = {
        id: parseInt(id),
        title: 'Assignment 1: Introduction to Programming',
        description: 'Submit your first programming assignment',
        subject: 'CS101',
        dueDate: '2024-02-15T23:59:00Z',
        type: 'assignment',
        status: 'active',
        createdBy: 'teacher1',
        createdAt: '2024-01-20T10:00:00Z',
        attachments: [],
        submissions: []
      };
      
      res.status(200).json({
        success: true,
        data: deadline
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching deadline',
        error: error.message
      });
    }
  },

  createDeadline: async (req, res) => {
    try {
      const { title, description, subject, dueDate, type } = req.body;
      
      // Validation
      if (!title || !subject || !dueDate || !type) {
        return res.status(400).json({
          success: false,
          message: 'Please provide title, subject, dueDate, and type'
        });
      }

      // Mock creation - replace with actual database creation
      const newDeadline = {
        id: Date.now(),
        title,
        description,
        subject,
        dueDate,
        type,
        status: 'active',
        createdBy: req.user.userId,
        createdAt: new Date().toISOString()
      };
      
      res.status(201).json({
        success: true,
        message: 'Deadline created successfully',
        data: newDeadline
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating deadline',
        error: error.message
      });
    }
  },

  updateDeadline: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Mock update - replace with actual database update
      const updatedDeadline = {
        id: parseInt(id),
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      res.status(200).json({
        success: true,
        message: 'Deadline updated successfully',
        data: updatedDeadline
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating deadline',
        error: error.message
      });
    }
  },

  deleteDeadline: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Mock deletion - replace with actual database deletion
      res.status(200).json({
        success: true,
        message: `Deadline ${id} deleted successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting deadline',
        error: error.message
      });
    }
  },

  getDeadlinesBySubject: async (req, res) => {
    try {
      const { subjectId } = req.params;
      
      // Mock data filtered by subject
      const deadlines = [
        {
          id: 1,
          title: 'Assignment 1',
          subject: subjectId,
          dueDate: '2024-02-15T23:59:00Z',
          type: 'assignment',
          status: 'active'
        }
      ];
      
      res.status(200).json({
        success: true,
        count: deadlines.length,
        data: deadlines
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching subject deadlines',
        error: error.message
      });
    }
  },

  getMyDeadlines: async (req, res) => {
    try {
      // Get deadlines for the logged-in student/teacher
      const deadlines = [
        {
          id: 1,
          title: 'Upcoming Assignment',
          subject: 'CS101',
          dueDate: '2024-02-15T23:59:00Z',
          type: 'assignment',
          status: 'active',
          daysRemaining: 5
        }
      ];
      
      res.status(200).json({
        success: true,
        count: deadlines.length,
        data: deadlines
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching your deadlines',
        error: error.message
      });
    }
  }
};

// Routes

// Public test route
router.get('/test', (req, res) => {
  res.json({ message: 'Deadline routes working' });
});

// Protected routes - All authenticated users
router.get('/', authenticate, deadlineController.getAllDeadlines);
router.get('/my-deadlines', authenticate, deadlineController.getMyDeadlines);
router.get('/:id', authenticate, deadlineController.getDeadlineById);
router.get('/subject/:subjectId', authenticate, deadlineController.getDeadlinesBySubject);

// Protected routes - Teachers and Admins only
router.post('/', authenticate, restrictTo('teacher', 'admin'), deadlineController.createDeadline);
router.put('/:id', authenticate, restrictTo('teacher', 'admin'), deadlineController.updateDeadline);
router.delete('/:id', authenticate, restrictTo('teacher', 'admin'), deadlineController.deleteDeadline);

module.exports = router;