const db = require('../config/database');

// Get all subjects with optional grade filter - School-aware
const getAll = async (req, res) => {
  try {
    const { grade, phase } = req.query;
    const { schoolId, isSuperAdmin } = req.user || {};
    
    let query = 'SELECT * FROM subjects WHERE is_active = true';
    let params = [];
    let paramCount = 0;

    // Filter by school for non-super-admins
    if (!isSuperAdmin && schoolId) {
      paramCount++;
      query += ` AND school_id = $${paramCount}`;
      params.push(schoolId);
    }

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
    console.error('❌ Error fetching subjects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
};

// Get subjects for a specific grade (for registration) - School-aware
const getByGrade = async (req, res) => {
  try {
    const { grade } = req.params;
    const { schoolId, isSuperAdmin } = req.user || {};
    
    let query = 'SELECT * FROM subjects WHERE $1 = ANY(applicable_grades) AND is_active = true';
    let params = [grade];
    
    // Filter by school for non-super-admins
    if (!isSuperAdmin && schoolId) {
      query += ' AND school_id = $2';
      params.push(schoolId);
    }
    
    query += ' ORDER BY name';
    
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ Error fetching subjects by grade:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
};

// Get subjects by phase - School-aware
const getByPhase = async (req, res) => {
  try {
    const { phase } = req.params;
    const { schoolId, isSuperAdmin } = req.user || {};
    
    let query = 'SELECT * FROM subjects WHERE phase = $1 AND is_active = true';
    let params = [phase];
    
    // Filter by school for non-super-admins
    if (!isSuperAdmin && schoolId) {
      query += ' AND school_id = $2';
      params.push(schoolId);
    }
    
    query += ' ORDER BY name';
    
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ Error fetching subjects by phase:', error);
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
    const { schoolId } = req.user || {};
    
    // Get school code
    let schoolCode = null;
    if (schoolId) {
      const schoolResult = await db.query('SELECT code FROM schools WHERE id = $1', [schoolId]);
      if (schoolResult.rows.length > 0) {
        schoolCode = schoolResult.rows[0].code;
      }
    }
    
    const result = await db.query(
      `INSERT INTO subjects (code, name, description, phase, applicable_grades, credits, is_compulsory, department, created_by, school_id, school_code) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [code, name, description, phase, applicableGrades, credits, isCompulsory, department, req.user.userId, schoolId, schoolCode]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating subject:', error);
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