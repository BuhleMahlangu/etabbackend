const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { proxyDownload } = require('../controllers/downloadController');

// Proxy download endpoint - streams file from Cloudinary with proper filename
router.get('/materials/:id', authenticate, proxyDownload);

module.exports = router;
