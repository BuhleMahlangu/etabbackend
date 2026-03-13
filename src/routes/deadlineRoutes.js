const express = require('express');
const router = express.Router();
const deadlineController = require('../controllers/deadlineController');
const { authenticate } = require('../middleware/authMiddleware');
const { isTeacher } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authenticate);

// Public test route
router.get('/test', (req, res) => {
  res.json({ message: 'Deadline routes working' });
});

// Student routes
router.get('/my-deadlines', deadlineController.getMyDeadlines);
router.get('/for-learner/:learnerId', deadlineController.getForLearner);

// Shared routes
router.get('/', deadlineController.getAllDeadlines);
router.get('/subject/:subjectId', deadlineController.getDeadlinesBySubject);
router.get('/:id', deadlineController.getDeadlineById);

// Teacher/Admin routes
router.post('/', isTeacher, deadlineController.createDeadline);
router.put('/:id', isTeacher, deadlineController.updateDeadline);
router.delete('/:id', isTeacher, deadlineController.deleteDeadline);

module.exports = router;
