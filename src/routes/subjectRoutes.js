const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { authenticate } = require('../middleware/authMiddleware');
const { isAdmin, isTeacher } = require('../middleware/roleMiddleware');

router.get('/', authenticate, subjectController.getAll);
router.get('/:id', authenticate, subjectController.getById);
router.post('/', authenticate, isAdmin, subjectController.create);
router.put('/:id', authenticate, isAdmin, subjectController.update);
router.delete('/:id', authenticate, isAdmin, subjectController.delete);

module.exports = router;