const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const db = require('../config/database');

// Helper: Get default cover image by department
function getDefaultCoverImage(department) {
  const images = {
    'Mathematics': 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400',
    'Science': 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400',
    'Languages': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400',
    'Technology': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400',
    'Arts': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400',
    'Humanities': 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400',
    'Business': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400',
    'Services': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
    'Life Orientation': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400'
  };
  return images[department] || 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400';
}

// Small helper to validate UUID-ish strings (basic)
function looksLikeUUID(v) {
  return typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);
}

// ============================================
// MAIN ROUTE: GET MY SUBJECTS (After Login)
// ============================================
router.get('/my-subjects', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!looksLikeUUID(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    // Get user's grade info
    const userResult = await db.query(`
      SELECT u.grade_id, g.name as grade_name, g.phase, g.level
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      WHERE u.id = $1::uuid
    `, [userId]);

    if (userResult.rows.length === 0 || !userResult.rows[0].grade_id) {
      return res.status(400).json({
        success: false,
        message: 'Please select your grade first',
        needsGradeSelection: true
      });
    }

    const { grade_id, grade_name, phase, level } = userResult.rows[0];

    // Get all modules for this grade with enrollment status
    const modulesResult = await db.query(`
      SELECT 
        m.id,
        m.code,
        m.name,
        m.description,
        m.department,
        m.credits,
        gm.is_compulsory,
        lm.status as enrollment_status,
        COALESCE(lm.progress_percent, 0) as progress,
        CASE 
          WHEN lm.id IS NOT NULL THEN true
          WHEN gm.is_compulsory THEN true
          ELSE false
        END as is_enrolled
      FROM modules m
      JOIN grade_modules gm ON m.id = gm.module_id
      LEFT JOIN learner_modules lm ON m.id = lm.module_id AND lm.learner_id = $1::uuid
      WHERE gm.grade_id = $2::uuid
      AND m.is_active = true
      ORDER BY gm.is_compulsory DESC, m.department, m.name
    `, [userId, grade_id]);

    // Categorize for frontend
    const doing = [];
    const available = [];

    modulesResult.rows.forEach(module => {
      const isFET = level >= 10;
      const isDoing = module.is_enrolled;

      const subject = {
        id: module.id,
        code: module.code,
        name: module.name,
        description: module.description,
        department: module.department,
        credits: module.credits,
        phase: phase,
        grade: grade_name,
        isCompulsory: module.is_compulsory,
        isEnrolled: module.is_enrolled,
        isDoing: isDoing,
        status: module.enrollment_status || (module.is_compulsory ? 'auto_enrolled' : 'available'),
        progress: module.progress,
        coverImage: getDefaultCoverImage(module.department)
      };

      if (isDoing) {
        doing.push(subject);
      } else if (isFET && !module.is_compulsory) {
        available.push(subject);
      }
    });

    res.status(200).json({
      success: true,
      grade: grade_name,
      phase: phase,
      summary: {
        totalDoing: doing.length,
        totalAvailable: available.length,
        compulsoryDoing: doing.filter(s => s.isCompulsory).length,
        optionalDoing: doing.filter(s => !s.isCompulsory).length
      },
      subjects: {
        doing: doing,
        available: available
      }
    });

  } catch (error) {
    console.error('Error fetching my subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects',
      error: error.message
    });
  }
});

// ============================================
// GET AVAILABLE GRADES (For Registration)
// ============================================
router.get('/available-grades', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        g.id,
        g.name as grade,
        g.phase,
        g.level,
        COUNT(CASE WHEN gm.is_compulsory THEN 1 END) as compulsory_count,
        COUNT(CASE WHEN NOT gm.is_compulsory THEN 1 END) as optional_count,
        COUNT(*) as total_modules
      FROM grades g
      LEFT JOIN grade_modules gm ON g.id = gm.grade_id
      GROUP BY g.id, g.name, g.phase, g.level
      ORDER BY g.level
    `);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      grades: result.rows
    });

  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available grades'
    });
  }
});

// ============================================
// GET SUBJECTS BY GRADE (For Teacher Registration)
// ============================================
router.get('/grade-subjects/:gradeId', async (req, res) => {
  try {
    const { gradeId } = req.params;

    // Validate UUID
    if (!/^[0-9a-fA-F-]{36}$/.test(gradeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade ID format'
      });
    }

    // Get grade info
    const gradeResult = await db.query(
      'SELECT id, name, level FROM grades WHERE id = $1::uuid',
      [gradeId]
    );

    if (gradeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    const grade = gradeResult.rows[0];

    // Get subjects with learner enrollment count
    const subjectsResult = await db.query(`
      SELECT 
        m.id,
        m.code,
        m.name,
        m.description,
        m.department,
        m.credits,
        gm.is_compulsory,
        COUNT(DISTINCT lm.learner_id) as learner_count
      FROM modules m
      JOIN grade_modules gm ON m.id = gm.module_id
      LEFT JOIN learner_modules lm ON m.id = lm.module_id 
        AND lm.grade_id = $1::uuid 
        AND lm.status = 'active'
      WHERE gm.grade_id = $1::uuid
      AND m.is_active = true
      GROUP BY m.id, m.code, m.name, m.description, m.department, m.credits, gm.is_compulsory
      ORDER BY gm.is_compulsory DESC, m.department, m.name
    `, [gradeId]);

    res.status(200).json({
      success: true,
      grade: {
        id: grade.id,
        name: grade.name,
        level: grade.level
      },
      subjects: subjectsResult.rows.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description,
        department: s.department,
        credits: s.credits,
        isCompulsory: s.is_compulsory,
        learnerCount: parseInt(s.learner_count)
      }))
    });

  } catch (error) {
    console.error('Error fetching grade subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects',
      error: error.message
    });
  }
});

// ============================================
// SELECT GRADE (During Registration) - FIXED
// ============================================
router.post('/select-grade', authenticate, async (req, res) => {
  try {
    const { grade } = req.body;
    const userId = req.user.userId;

    if (!grade || typeof grade !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Grade is required'
      });
    }
    if (!looksLikeUUID(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    // Get grade ID, name, AND level (integer)
    const gradeResult = await db.query(
      'SELECT id, name, level FROM grades WHERE name = $1::varchar',
      [grade]
    );

    if (gradeResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade selected'
      });
    }

    const { id: gradeId, name: gradeName, level } = gradeResult.rows[0];

    // FIXED: Store level (INTEGER) in current_grade, gradeName in grade
    await db.query(`
      UPDATE users 
      SET grade_id = $1::uuid, 
          grade = $2::varchar, 
          current_grade = $3::int 
      WHERE id = $4::uuid
    `, [gradeId, gradeName, level, userId]);

    // Get modules to auto-enroll (gradeId as uuid)
    const modulesResult = await db.query(`
      SELECT m.id, gm.is_compulsory
      FROM modules m
      JOIN grade_modules gm ON m.id = gm.module_id
      WHERE gm.grade_id = $1::uuid
    `, [gradeId]);

    // Determine which to auto-enroll
    // FET (10-12): Only compulsory
    // Others (1-9): All modules
    const toEnroll = modulesResult.rows.filter(m => {
      if (level >= 10) return m.is_compulsory;
      return true;
    });

    // Insert enrollments with explicit UUID casting
    for (const mod of toEnroll) {
      // defensive check
      if (!looksLikeUUID(mod.id)) {
        console.warn('Skipping enroll for module with invalid id:', mod);
        continue;
      }
      await db.query(`
        INSERT INTO learner_modules (learner_id, module_id, grade_id, status, progress_percent)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'active', 0)
        ON CONFLICT (learner_id, module_id) DO NOTHING
      `, [userId, mod.id, gradeId]);
    }

    res.status(200).json({
      success: true,
      message: `Grade ${gradeName} selected successfully`,
      grade: gradeName,
      phase: level >= 10 ? 'FET' : (level >= 7 ? 'Senior' : (level >= 4 ? 'Intermediate' : 'Foundation')),
      autoEnrolled: toEnroll.length,
      totalModules: modulesResult.rows.length
    });

  } catch (error) {
    console.error('Error selecting grade:', error);
    res.status(500).json({
      success: false,
      message: 'Error selecting grade',
      error: error.message
    });
  }
});

// ============================================
// ENROLL IN OPTIONAL MODULE (FET Only)
// ============================================
router.post('/enroll', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.body;
    const userId = req.user.userId;

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: 'Module ID is required'
      });
    }
    if (!looksLikeUUID(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    // Check user's grade and current enrollments
    const userResult = await db.query(`
      SELECT u.grade_id, g.level, g.name
      FROM users u
      JOIN grades g ON u.grade_id = g.id
      WHERE u.id = $1::uuid
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select your grade first'
      });
    }

    const { grade_id, level, name: gradeName } = userResult.rows[0];

    if (level < 10) {
      return res.status(400).json({
        success: false,
        message: 'Subject choice only available for FET phase (Grades 10-12)'
      });
    }

    // Check if already enrolled in 4 optional subjects
    const countResult = await db.query(`
      SELECT COUNT(*) as count
      FROM learner_modules lm
      JOIN grade_modules gm ON lm.module_id = gm.module_id
      WHERE lm.learner_id = $1::uuid
      AND gm.grade_id = $2::uuid
      AND gm.is_compulsory = false
      AND lm.status = 'active'
    `, [userId, grade_id]);

    const optionalCount = parseInt(countResult.rows[0].count);

    if (optionalCount >= 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 optional subjects allowed. Please drop one first.'
      });
    }

    // Verify module is optional for this grade
    const moduleCheck = await db.query(`
      SELECT m.name, gm.is_compulsory
      FROM modules m
      JOIN grade_modules gm ON m.id = gm.module_id
      WHERE m.id = $1::uuid AND gm.grade_id = $2::uuid
    `, [moduleId, grade_id]);

    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Module not found for your grade'
      });
    }

    if (moduleCheck.rows[0].is_compulsory) {
      return res.status(400).json({
        success: false,
        message: 'Cannot enroll in compulsory modules - already auto-enrolled'
      });
    }

    // Enroll with explicit UUID casting
    await db.query(`
      INSERT INTO learner_modules (learner_id, module_id, grade_id, status, progress_percent)
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'active', 0)
      ON CONFLICT (learner_id, module_id) 
      DO UPDATE SET status = 'active', enrolled_at = CURRENT_TIMESTAMP
    `, [userId, moduleId, grade_id]);

    res.status(200).json({
      success: true,
      message: `Enrolled in ${moduleCheck.rows[0].name}`,
      enrolledModule: moduleId,
      optionalCount: optionalCount + 1,
      remainingSlots: 4 - (optionalCount + 1)
    });

  } catch (error) {
    console.error('Error enrolling:', error);
    res.status(500).json({
      success: false,
      message: 'Error enrolling in subject'
    });
  }
});

// ============================================
// DROP OPTIONAL MODULE (FET Only)
// ============================================
router.post('/drop', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.body;
    const userId = req.user.userId;

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: 'Module ID is required'
      });
    }
    if (!looksLikeUUID(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    // Check if it's compulsory
    const moduleCheck = await db.query(`
      SELECT m.name, gm.is_compulsory
      FROM learner_modules lm
      JOIN modules m ON lm.module_id = m.id
      JOIN grade_modules gm ON m.id = gm.module_id
      JOIN users u ON lm.learner_id = u.id
      WHERE lm.learner_id = $1::uuid AND lm.module_id = $2::uuid AND gm.grade_id = u.grade_id
    `, [userId, moduleId]);

    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Module not found in your enrollments'
      });
    }

    if (moduleCheck.rows[0].is_compulsory) {
      return res.status(400).json({
        success: false,
        message: 'Cannot drop compulsory modules'
      });
    }

    // Drop (soft delete - set status to dropped)
    await db.query(`
      UPDATE learner_modules 
      SET status = 'dropped' 
      WHERE learner_id = $1::uuid AND module_id = $2::uuid
    `, [userId, moduleId]);

    res.status(200).json({
      success: true,
      message: `Dropped ${moduleCheck.rows[0].name}`,
      droppedModule: moduleId
    });

  } catch (error) {
    console.error('Error dropping subject:', error);
    res.status(500).json({
      success: false,
      message: 'Error dropping subject'
    });
  }
});

// ============================================
// GET SINGLE MODULE DETAILS
// ============================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!looksLikeUUID(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    // Get module with user's context
    const result = await db.query(`
      SELECT 
        m.*,
        g.name as grade_name,
        g.phase,
        gm.is_compulsory,
        lm.status as enrollment_status,
        COALESCE(lm.progress_percent, 0) as progress
      FROM modules m
      JOIN grade_modules gm ON m.id = gm.module_id
      JOIN grades g ON gm.grade_id = g.id
      JOIN users u ON u.grade_id = g.id
      LEFT JOIN learner_modules lm ON m.id = lm.module_id AND lm.learner_id = u.id
      WHERE m.id = $1::uuid AND u.id = $2::uuid
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found or not available for your grade'
      });
    }

    const module = result.rows[0];

    res.status(200).json({
      success: true,
      subject: {
        id: module.id,
        code: module.code,
        name: module.name,
        description: module.description,
        department: module.department,
        credits: module.credits,
        phase: module.phase,
        grade: module.grade_name,
        isCompulsory: module.is_compulsory,
        isEnrolled: !!module.enrollment_status,
        isDoing: module.is_compulsory || !!module.enrollment_status,
        status: module.enrollment_status || 'available',
        progress: module.progress,
        coverImage: getDefaultCoverImage(module.department)
      }
    });

  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subject details'
    });
  }
});

module.exports = router;