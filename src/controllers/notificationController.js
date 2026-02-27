const db = require('../config/database');

const getForUser = async (req, res) => {
  const result = await db.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
    [req.params.userId]
  );
  res.json({ success: true, data: result.rows });
};

module.exports = { getForUser };