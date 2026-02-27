const db = require('../config/database');
const { deleteFromCloudinary, cloudinary } = require('../config/multer-cloudinary');

const getAll = async (req, res) => {
  try {
    const { subjectId, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT m.*, u.first_name || ' ' || u.last_name as uploaded_by_name,
             s.name as subject_name
      FROM materials m
      JOIN users u ON m.uploaded_by = u.id
      JOIN subjects s ON m.subject_id = s.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (req.user.role === 'learner') {
      query += ` AND m.is_published = true AND m.subject_id IN (
        SELECT subject_id FROM enrollments WHERE learner_id = $${++paramCount} AND status = 'active'
      )`;
      params.push(req.user.userId);
    }

    if (subjectId) {
      query += ` AND m.subject_id = $${++paramCount}`;
      params.push(subjectId);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch materials' });
  }
};

const upload = async (req, res) => {
  try {
    const { subjectId, title, description, weekNumber, isPublished } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (req.user.role === 'teacher') {
      const assignment = await db.query(
        'SELECT id FROM teacher_assignments WHERE teacher_id = $1 AND subject_id = $2',
        [req.user.userId, subjectId]
      );
      if (assignment.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not assigned to this subject' });
      }
    }

    const result = await db.query(
      `INSERT INTO materials (subject_id, uploaded_by, title, description, file_url, file_type, 
        file_size_bytes, week_number, is_published, cloudinary_public_id, cloudinary_resource_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        subjectId, req.user.userId, title, description, req.file.path, 
        req.file.format || 'unknown', req.file.size || 0, weekNumber || null, 
        isPublished === 'true', req.file.filename, req.file.resource_type || 'raw'
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as uploaded_by_name
       FROM materials m JOIN users u ON m.uploaded_by = u.id WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    await db.query('UPDATE materials SET view_count = view_count + 1 WHERE id = $1', [id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch material' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, weekNumber, isPublished } = req.body;

    const existing = await db.query('SELECT uploaded_by FROM materials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].uploaded_by !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await db.query(
      `UPDATE materials SET title = $1, description = $2, week_number = $3, 
       is_published = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`,
      [title, description, weekNumber, isPublished, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query(
      'SELECT uploaded_by, cloudinary_public_id, cloudinary_resource_type FROM materials WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].uploaded_by !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await deleteFromCloudinary(
      existing.rows[0].cloudinary_public_id,
      existing.rows[0].cloudinary_resource_type
    );

    await db.query('DELETE FROM materials WHERE id = $1', [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
};

module.exports = { getAll, upload, getById, update, delete: remove };