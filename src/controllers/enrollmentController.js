const db = require('../config/database');

// Update marks for a student
const updateMarks = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { term1, term2, term3, term4 } = req.body;

    // Calculate final mark (average of terms)
    const marks = [term1, term2, term3, term4].filter(m => m !== null && m !== undefined);
    const finalMark = marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : null;
    
    // Determine if passed (50% is standard pass mark)
    const hasPassed = finalMark !== null && finalMark >= 50;

    const result = await db.query(
      `UPDATE enrollments 
       SET term_1_mark = $1, term_2_mark = $2, term_3_mark = $3, term_4_mark = $4,
           final_mark = $5, has_passed = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [term1, term2, term3, term4, finalMark, hasPassed, enrollmentId]
    );

    // Notify student
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, related_subject_id)
       SELECT learner_id, 'Marks Updated', 'Your marks have been updated for ' || s.name, 'mark', subject_id
       FROM enrollments e JOIN subjects s ON e.subject_id = s.id WHERE e.id = $1`,
      [enrollmentId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update marks error:', error);
    res.status(500).json({ success: false, message: 'Failed to update marks' });
  }
};

// Check and process grade progression
const processGradeProgression = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const academicYear = new Date().getFullYear().toString();

    // Get all enrollments for current year
    const enrollments = await db.query(
      `SELECT e.*, s.name as subject_name
       FROM enrollments e
       JOIN subjects s ON e.subject_id = s.id
       WHERE e.learner_id = $1 AND e.academic_year = $2`,
      [learnerId, academicYear]
    );

    if (enrollments.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No enrollments found' });
    }

    // Check if all subjects passed
    const allPassed = enrollments.rows.every(e => e.has_passed === true);
    const currentGrade = enrollments.rows[0].grade;
    
    // Determine next grade
    const gradeOrder = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 
                       'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    const currentIndex = gradeOrder.indexOf(currentGrade);
    const nextGrade = allPassed && currentIndex < gradeOrder.length - 1 ? gradeOrder[currentIndex + 1] : null;

    // Record progression
    await db.query(
      `INSERT INTO grade_progression (learner_id, from_grade, to_grade, academic_year, all_subjects_passed, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [learnerId, currentGrade, nextGrade || currentGrade, academicYear, allPassed, allPassed ? 'passed' : 'failed']
    );

    if (allPassed && nextGrade) {
      // Promote to next grade
      await db.query('UPDATE users SET current_grade = $1 WHERE id = $2', [nextGrade, learnerId]);
      
      // Auto-enroll in new grade subjects
      const { autoEnrollLearner } = require('./authController');
      const newAcademicYear = (parseInt(academicYear) + 1).toString();
      await autoEnrollLearner(learnerId, nextGrade, newAcademicYear);

      // Notify student
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Congratulations!', 'You have been promoted to ${nextGrade}. New subjects have been assigned.', 'promotion')`,
        [learnerId]
      );

      res.json({ 
        success: true, 
        message: `Promoted to ${nextGrade}`,
        promoted: true,
        newGrade: nextGrade
      });
    } else {
      // Notify about failing
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Academic Review', 'You did not meet the requirements to progress. Please contact your teacher.', 'promotion')`,
        [learnerId]
      );

      res.json({ 
        success: true, 
        message: 'Did not meet progression requirements',
        promoted: false,
        repeatGrade: currentGrade
      });
    }
  } catch (error) {
    console.error('Progression error:', error);
    res.status(500).json({ success: false, message: 'Failed to process progression' });
  }
};

// Get student report
const getReport = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const academicYear = req.query.year || new Date().getFullYear().toString();

    const result = await db.query(
      `SELECT e.*, s.name as subject_name, s.code as subject_code, s.credits
       FROM enrollments e
       JOIN subjects s ON e.subject_id = s.id
       WHERE e.learner_id = $1 AND e.academic_year = $2
       ORDER BY s.name`,
      [learnerId, academicYear]
    );

    // Calculate overall average
    const marks = result.rows.filter(r => r.final_mark !== null).map(r => parseFloat(r.final_mark));
    const average = marks.length > 0 ? (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2) : null;

    res.json({ 
      success: true, 
      data: {
        subjects: result.rows,
        overallAverage: average,
        totalSubjects: result.rows.length,
        passedSubjects: result.rows.filter(r => r.has_passed).length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch report' });
  }
};

module.exports = { updateMarks, processGradeProgression, getReport };