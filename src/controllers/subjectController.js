const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT s.*, u.first_name || \' \' || u.last_name as created_by_name FROM subjects s LEFT JOIN users u ON s.created_by = u.id WHERE s.is_active = true'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
};

const getById = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch subject' });
  }
};

const create = async (req, res) => {
  try {
    const { code, name, description, credits, department } = req.body;
    const result = await db.query(
      'INSERT INTO subjects (code, name, description, credits, department, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [code, name, description, credits, department, req.user.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create subject' });
  }
};

const update = async (req, res) => {
  try {
    const { code, name, description, credits, department, isActive } = req.body;
    const result = await db.query(
      'UPDATE subjects SET code = $1, name = $2, description = $3, credits = $4, department = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [code, name, description, credits, department, isActive, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

const remove = async (req, res) => {
  try {
    await db.query('DELETE FROM subjects WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Subject deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
};

module.exports = { getAll, getById, create, update, delete: remove };