const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { isTeacher } = require('../middleware/roleMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

// Learner routes - specific routes FIRST (before :id)
router.get('/my-assignments', authenticate, assignmentController.getMyAssignments);
router.get('/upcoming-deadlines', authenticate, assignmentController.getUpcomingDeadlines);

// Teacher/Admin routes - specific routes FIRST
router.get('/', authenticate, assignmentController.getAllAssignments);
router.post('/', authenticate, isTeacher, assignmentController.createAssignment);

// Submission routes
router.post('/:assignmentId/submit', authenticate, handleUpload('file'), assignmentController.submitAssignment);
router.get('/:assignmentId/submissions', authenticate, isTeacher, assignmentController.getAssignmentSubmissions);
router.get('/submissions/:submissionId/download', authenticate, isTeacher, assignmentController.downloadSubmission);

// Generic routes LAST
router.get('/:id', authenticate, assignmentController.getAssignmentById);
router.put('/:id', authenticate, isTeacher, assignmentController.updateAssignment);
router.delete('/:id', authenticate, isTeacher, assignmentController.deleteAssignment);
router.post('/submissions/:submissionId/grade', authenticate, isTeacher, assignmentController.gradeSubmission);
router.post('/:id/extend-due-date', authenticate, isTeacher, assignmentController.extendDueDate);

module.exports = router;
