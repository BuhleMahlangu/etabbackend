const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

router.get('/', authenticate, isAdmin, userController.getAll);
router.get('/:id', authenticate, isAdmin, userController.getById);
router.put('/:id', authenticate, isAdmin, userController.update);
router.delete('/:id', authenticate, isAdmin, userController.delete);

module.exports = router;