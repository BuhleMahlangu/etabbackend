const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { checkTeacherStatus } = require('../controllers/adminController'); // ADD THIS LINE
const { authenticate } = require('../middleware/authMiddleware');

const validateRegister = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty()
];

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', authController.login);
router.post('/check-teacher-status', checkTeacherStatus); // ADD THIS LINE

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

module.exports = router;