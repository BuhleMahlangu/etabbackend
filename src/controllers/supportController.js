const db = require('../config/database');

// ============================================
// SEND MESSAGE TO ADMIN (Teacher/Learner)
// ============================================
const sendMessageToAdmin = async (req, res) => {
  try {
    const { subject, message, category = 'general' } = req.body;
    const userId = req.user.userId;
    
    if (!subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject and message are required' 
      });
    }
    
    const result = await db.query(
      `INSERT INTO support_messages (user_id, subject, message, category, status, created_at)
       VALUES ($1, $2, $3, $4, 'open', NOW())
       RETURNING *`,
      [userId, subject, message, category]
    );
    
    // Create notification for admin
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES (NULL, 'support', 'New Support Message', $1, false, NOW())`,
      [`New message from user: ${subject}`]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Message sent successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message: ' + error.message 
    });
  }
};

// ============================================
// GET MY MESSAGES (Teacher/Learner)
// ============================================
const getMyMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await db.query(
      `SELECT sm.*, 
              u.first_name as admin_first_name, 
              u.last_name as admin_last_name
       FROM support_messages sm
       LEFT JOIN users u ON sm.responded_by = u.id
       WHERE sm.user_id = $1
       ORDER BY sm.created_at DESC`,
      [userId]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch messages' 
    });
  }
};

// ============================================
// GET ALL SUPPORT MESSAGES (Admin)
// ============================================
const getAllSupportMessages = async (req, res) => {
  try {
    const { status, category } = req.query;
    
    let query = `
      SELECT sm.*, 
             u.first_name as user_first_name, 
             u.last_name as user_last_name,
             u.email as user_email,
             u.role as user_role,
             a.first_name as admin_first_name,
             a.last_name as admin_last_name
      FROM support_messages sm
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN admins a ON sm.responded_by = a.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND sm.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (category) {
      query += ` AND sm.category = $${paramIndex++}`;
      params.push(category);
    }
    
    query += ` ORDER BY 
      CASE sm.status 
        WHEN 'open' THEN 1 
        WHEN 'in_progress' THEN 2 
        WHEN 'resolved' THEN 3 
      END,
      sm.created_at DESC
    `;
    
    const result = await db.query(query, params);
    
    // Get stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) as total_count
      FROM support_messages
    `);
    
    res.json({ 
      success: true, 
      data: result.rows,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching support messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch support messages' 
    });
  }
};

// ============================================
// GET SINGLE MESSAGE (Admin)
// ============================================
const getSupportMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT sm.*, 
             u.first_name as user_first_name, 
             u.last_name as user_last_name,
             u.email as user_email,
             u.role as user_role,
             a.first_name as admin_first_name,
             a.last_name as admin_last_name
      FROM support_messages sm
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN admins a ON sm.responded_by = a.id
      WHERE sm.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch message' 
    });
  }
};

// ============================================
// RESPOND TO MESSAGE (Admin)
// ============================================
const respondToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { response, status } = req.body;
    const adminId = req.user.userId;
    
    if (!response) {
      return res.status(400).json({ 
        success: false, 
        message: 'Response is required' 
      });
    }
    
    // Update message with response
    const result = await db.query(
      `UPDATE support_messages 
       SET admin_response = $1, 
           status = COALESCE($2, status), 
           responded_by = $3, 
           responded_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [response, status, adminId, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }
    
    const message = result.rows[0];
    
    // Create notification for the user
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, 'support_response', 'Response to Your Support Request', $2, false, NOW())`,
      [message.user_id, `Admin responded to: ${message.subject}`]
    );
    
    res.json({ 
      success: true, 
      message: 'Response sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error responding to message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send response' 
    });
  }
};

// ============================================
// UPDATE MESSAGE STATUS (Admin)
// ============================================
const updateMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }
    
    const result = await db.query(
      `UPDATE support_messages 
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update status' 
    });
  }
};

// ============================================
// DELETE MESSAGE (Admin)
// ============================================
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM support_messages WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Message deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete message' 
    });
  }
};

module.exports = {
  sendMessageToAdmin,
  getMyMessages,
  getAllSupportMessages,
  getSupportMessageById,
  respondToMessage,
  updateMessageStatus,
  deleteMessage
};
