const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  sendMessageToAdmin,
  getMyMessages,
  getAllSupportMessages,
  getSupportMessageById,
  respondToMessage,
  updateMessageStatus,
  deleteMessage
} = require('../controllers/supportController');

// All routes require authentication
router.use(authenticate);

// ============================================
// USER ROUTES (Teacher/Learner)
// ============================================
router.post('/messages', sendMessageToAdmin);
router.get('/my-messages', getMyMessages);

// ============================================
// ADMIN ROUTES
// ============================================
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

router.use('/admin', requireAdmin);
router.get('/admin/messages', getAllSupportMessages);
router.get('/admin/messages/:id', getSupportMessageById);
router.put('/admin/messages/:id/respond', respondToMessage);
router.put('/admin/messages/:id/status', updateMessageStatus);
router.delete('/admin/messages/:id', deleteMessage);

module.exports = router;
