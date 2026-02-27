const db = require('../config/database');

// Get all subjects with optional grade filter
const getAll = async (req, res) => {
  try {
    const { grade, phase } = req.query;
    let query = 'SELECT * FROM subjects WHERE is_active = true';
    let params = [];
    let paramCount = 0;

    if (grade) {
      paramCount++;
      query += ` AND $${paramCount} = ANY(applicable_grades)`;
      params.push(grade);
    }

    if (phase) {
      paramCount++;
      query += ` AND phase = $${paramCount}`;
      params.push(phase);
    }

    query += ' ORDER BY phase, name';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
};

// Get subjects for a specific grade (for registration)
const getByGrade = async (req, res) => {
  try {
    const { grade } = req.params;
    const result = await db.query(
      'SELECT * FROM subjects WHERE $1 = ANY(applicable_grades) AND is_active = true ORDER BY name',
      [grade]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
};

// Get subjects by phase
const getByPhase = async (req, res) => {
  try {
    const { phase } = req.params;
    const result = await db.query(
      'SELECT * FROM subjects WHERE phase = $1 AND is_active = true ORDER BY name',
      [phase]
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
    const { code, name, description, phase, applicableGrades, credits, isCompulsory, department } = req.body;
    const result = await db.query(
      `INSERT INTO subjects (code, name, description, phase, applicable_grades, credits, is_compulsory, department, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [code, name, description, phase, applicableGrades, credits, isCompulsory, department, req.user.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create subject' });
  }
};

const update = async (req, res) => {
  try {
    const { code, name, description, phase, applicableGrades, credits, isCompulsory, department, isActive } = req.body;
    const result = await db.query(
      `UPDATE subjects SET code = $1, name = $2, description = $3, phase = $4, applicable_grades = $5, 
       credits = $6, is_compulsory = $7, department = $8, is_active = $9, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $10 RETURNING *`,
      [code, name, description, phase, applicableGrades, credits, isCompulsory, department, isActive, req.params.id]
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

module.exports = { getAll, getById, getByGrade, getByPhase, create, update, delete: remove };