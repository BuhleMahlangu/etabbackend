const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { authenticate } = require('../middleware/authMiddleware');
const { isTeacher } = require('../middleware/roleMiddleware');

// Public routes (for learners)
router.get('/my-announcements', authenticate, announcementController.getMyAnnouncements);
router.get('/recent', authenticate, announcementController.getRecentAnnouncements);
router.get('/:id', authenticate, announcementController.getAnnouncementById);

// Teacher/Admin routes
router.get('/', authenticate, announcementController.getAllAnnouncements);
router.post('/', authenticate, isTeacher, announcementController.createAnnouncement);
router.put('/:id', authenticate, isTeacher, announcementController.updateAnnouncement);
router.delete('/:id', authenticate, isTeacher, announcementController.deleteAnnouncement);

module.exports = router;
