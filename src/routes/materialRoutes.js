const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { authenticate } = require('../middleware/authMiddleware');
const { isTeacher } = require('../middleware/roleMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');
const db = require('../config/database');

router.get('/', authenticate, materialController.getAll);
router.get('/my-materials', authenticate, materialController.getMyMaterials);
router.get('/subject/:subjectId', authenticate, materialController.getBySubject);
router.post('/', authenticate, isTeacher, handleUpload('file'), materialController.upload);
router.get('/:id', authenticate, materialController.getById);
router.put('/:id', authenticate, materialController.update);
router.delete('/:id', authenticate, materialController.delete);

// DEBUG: Check materials for a subject (no auth required for testing)
router.get('/debug/subject/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    
    // Get all materials for this subject
    const materialsResult = await db.query(
      `SELECT m.id, m.title, m.grade_id, m.applicable_grades, m.is_published, m.created_at,
              g.name as grade_name, mod.name as subject_name
       FROM materials m
       LEFT JOIN grades g ON m.grade_id = g.id
       JOIN modules mod ON m.subject_id = mod.id
       WHERE m.subject_id = $1`,
      [subjectId]
    );
    
    // Get grade info
    const gradesResult = await db.query('SELECT id, name, level FROM grades ORDER BY level');
    
    res.json({
      success: true,
      subjectId,
      materialsCount: materialsResult.rows.length,
      materials: materialsResult.rows,
      availableGrades: gradesResult.rows
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DEBUG: Check learner enrollment
router.get('/debug/enrollment/:learnerId', authenticate, async (req, res) => {
  try {
    const { learnerId } = req.params;
    
    // Get user info
    const userResult = await db.query(
      'SELECT id, grade_id, current_grade FROM users WHERE id = $1',
      [learnerId]
    );
    
    // Get learner modules
    const modulesResult = await db.query(
      `SELECT lm.*, m.name as module_name, m.code as module_code, g.name as grade_name
       FROM learner_modules lm
       JOIN modules m ON lm.module_id = m.id
       JOIN grades g ON lm.grade_id = g.id
       WHERE lm.learner_id = $1`,
      [learnerId]
    );
    
    res.json({
      success: true,
      learnerId,
      user: userResult.rows[0],
      enrollments: modulesResult.rows
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;