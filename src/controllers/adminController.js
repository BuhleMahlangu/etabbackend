const db = require('../config/database');

const getDashboard = async (req, res) => {
  try {
    const users = await db.query('SELECT COUNT(*) FROM users');
    const subjects = await db.query('SELECT COUNT(*) FROM subjects');
    const materials = await db.query('SELECT COUNT(*) FROM materials');
    const enrollments = await db.query('SELECT COUNT(*) FROM enrollments WHERE status = \'active\'');

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(users.rows[0].count),
        totalSubjects: parseInt(subjects.rows[0].count),
        totalMaterials: parseInt(materials.rows[0].count),
        activeEnrollments: parseInt(enrollments.rows[0].count)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
};

const getLogs = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT l.*, u.email FROM access_logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT 100'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};

module.exports = { getDashboard, getLogs };