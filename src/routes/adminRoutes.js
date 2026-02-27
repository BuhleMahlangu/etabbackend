const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

router.get('/dashboard', authenticate, isAdmin, adminController.getDashboard);
router.get('/logs', authenticate, isAdmin, adminController.getLogs);

module.exports = router;