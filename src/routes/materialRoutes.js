const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { authenticate } = require('../middleware/authMiddleware');
const { isTeacher } = require('../middleware/roleMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.get('/', authenticate, materialController.getAll);
router.post('/', authenticate, isTeacher, handleUpload('file'), materialController.upload);
router.get('/:id', authenticate, materialController.getById);
router.put('/:id', authenticate, materialController.update);
router.delete('/:id', authenticate, materialController.delete);

module.exports = router;