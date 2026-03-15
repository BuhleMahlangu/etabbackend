const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticate } = require('../middleware/authMiddleware');
const { isTeacher } = require('../middleware/roleMiddleware');

// Public routes (for learners)
router.get('/', authenticate, quizController.getAllQuizzes);
router.get('/:id', authenticate, quizController.getQuizById);
router.post('/:quizId/start', authenticate, quizController.startAttempt);
router.post('/attempts/:attemptId/answer', authenticate, quizController.submitAnswer);
router.post('/attempts/:attemptId/submit', authenticate, quizController.submitQuiz);
router.get('/my-results/all', authenticate, quizController.getMyQuizResults);

// Teacher/Admin routes
router.post('/', authenticate, isTeacher, quizController.createQuiz);
router.delete('/:id', authenticate, isTeacher, quizController.deleteQuiz);
router.post('/:id/publish', authenticate, isTeacher, quizController.publishQuiz);
router.post('/:id/unpublish', authenticate, isTeacher, quizController.unpublishQuiz);
router.post('/:quizId/reset/:learnerId', authenticate, isTeacher, quizController.resetStudentAttempt);
router.get('/:quizId/attempts', authenticate, isTeacher, quizController.getQuizAttempts);
router.get('/:quizId/statistics', authenticate, isTeacher, quizController.getQuizStatistics);
router.get('/attempts/:attemptId/review', authenticate, isTeacher, quizController.getAttemptForReview);
router.put('/answers/:answerId/override', authenticate, isTeacher, quizController.overrideAnswerMark);

module.exports = router;
