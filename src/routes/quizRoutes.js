const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticate } = require('../middleware/authMiddleware');
const { isTeacher } = require('../middleware/roleMiddleware');

// Public routes (for learners)
router.get('/', authenticate, quizController.getAllQuizzes);
router.get('/:id', authenticate, quizController.getQuizById);
router.post('/:quizId/start', authenticate, quizController.startAttempt);
router.post('/attempts/:attemptId/save', authenticate, quizController.saveAnswer);
router.post('/attempts/:attemptId/submit', authenticate, quizController.submitQuiz);
router.get('/:quizId/my-results', authenticate, quizController.getMyQuizResults);

// Teacher/Admin routes
router.post('/', authenticate, isTeacher, quizController.createQuiz);
router.put('/:id', authenticate, isTeacher, quizController.updateQuiz);
router.delete('/:id', authenticate, isTeacher, quizController.deleteQuiz);
router.post('/:quizId/questions', authenticate, isTeacher, quizController.addQuestion);
router.get('/:quizId/statistics', authenticate, isTeacher, quizController.getQuizStatistics);

module.exports = router;
