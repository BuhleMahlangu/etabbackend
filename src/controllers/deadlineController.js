const db = require('../config/database');

const getForLearner = async (req, res) => {
  const { learnerId } = req.params;
  const year = new Date().getFullYear().toString();
  
  const result = await db.query(`
    SELECT d.*, s.name as subject_name 
    FROM deadlines d
    JOIN subjects s ON d.subject_id = s.id
    WHERE d.acplicable_grades && (SELECT ARRAY[current_grade] FROM users WHERE id = $1)
    AND d.due_date > NOW()
    ORDER BY d.due_date ASC
  `, [learnerId]);
  
  res.json({ success: true, data: result.rows });
};

module.exports = { getForLearner };