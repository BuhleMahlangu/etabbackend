const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { authenticate } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

router.get('/', authenticate, subjectController.getAll);
router.get('/grade/:grade', authenticate, subjectController.getByGrade);
router.get('/phase/:phase', authenticate, subjectController.getByPhase);
router.get('/:id', authenticate, subjectController.getById);
router.post('/', authenticate, isAdmin, subjectController.create);
router.put('/:id', authenticate, isAdmin, subjectController.update);
router.delete('/:id', authenticate, isAdmin, subjectController.delete);
router.get('/:id', authenticate, subjectController.getById);

module.exports = router;