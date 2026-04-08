const db = require('../config/database');
const { 
  emitToUser, 
  emitToSchoolAdmins, 
  emitToSuperAdmins 
} = require('../config/socket');
const { createNotification } = require('../services/notificationService');

// ============================================
// SEND MESSAGE TO ADMIN (Teacher/Learner) - School-scoped
// ============================================
const sendMessageToAdmin = async (req, res) => {
  try {
    const { subject, message, category = 'general' } = req.body;
    const userId = req.user.userId;
    const schoolId = req.user.schoolId; // Get school from user's token
    
    if (!subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject and message are required' 
      });
    }
    
    // User must have a school assigned
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'You must be assigned to a school to send messages'
      });
    }
    
    const result = await db.query(
      `INSERT INTO support_messages (user_id, school_id, subject, message, category, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW())
       RETURNING *`,
      [userId, schoolId, subject, message, category]
    );
    
    // Create notification for school admins (not global - school-scoped)
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at, school_id)
       SELECT id, 'support', 'New Support Message', $1, false, NOW(), $2
       FROM users WHERE role = 'school_admin' AND school_id = $2`,
      [`New message from user: ${subject}`, schoolId]
    );
    
    // Get the admin user IDs for real-time emit
    const adminResult = await db.query(
      'SELECT id FROM users WHERE role = $1 AND school_id = $2',
      ['school_admin', schoolId]
    );
    
    // Emit real-time notification to school admins
    adminResult.rows.forEach(admin => {
      emitToUser(admin.id, 'support:message', {
        message: result.rows[0],
        type: 'new_message'
      });
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Message sent to your school admin successfully',
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
       ORDER BY 
         CASE WHEN sm.admin_response IS NOT NULL AND sm.is_read = false THEN 0 ELSE 1 END,
         sm.created_at DESC`,
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
// MARK MESSAGE AS READ (when user views response)
// ============================================
const markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await db.query(
      `UPDATE support_messages 
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Marked as read',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark as read' 
    });
  }
};

// ============================================
// GET ALL SUPPORT MESSAGES (Admin) - School-scoped
// ============================================
const getAllSupportMessages = async (req, res) => {
  try {
    const { status, category } = req.query;
    const { schoolId, isSuperAdmin } = req.user;
    
    console.log('🔥 [SUPPORT] getAllSupportMessages:', { schoolId, isSuperAdmin });
    
    let query = `
      SELECT sm.*, 
             u.first_name as user_first_name, 
             u.last_name as user_last_name,
             u.email as user_email,
             u.role as user_role,
             a.first_name as admin_first_name,
             a.last_name as admin_last_name,
             s.name as school_name,
             s.code as school_code
      FROM support_messages sm
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN admins a ON sm.responded_by = a.id
      LEFT JOIN schools s ON sm.school_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // School filter - school admins only see their school's messages
    if (!isSuperAdmin && schoolId) {
      query += ` AND sm.school_id = $${paramIndex++}`;
      params.push(schoolId);
      console.log('🔥 [SUPPORT] Filtering by school:', schoolId);
    } else if (!isSuperAdmin) {
      console.log('❌ [SUPPORT] School admin without schoolId!');
      return res.status(403).json({
        success: false,
        message: 'School admin must have school assigned'
      });
    } else {
      console.log('🔥 [SUPPORT] Super admin - showing all messages');
    }
    
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
    
    // Get stats (filtered by school for school admins)
    let statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) as total_count
      FROM support_messages
      WHERE 1=1
    `;
    
    if (!isSuperAdmin && schoolId) {
      statsQuery += ` AND school_id = '${schoolId}'`;
    }
    
    const statsResult = await db.query(statsQuery);
    
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
// GET SINGLE MESSAGE (Admin) - School-scoped
// ============================================
const getSupportMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId, isSuperAdmin } = req.user;
    
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
      WHERE sm.id = $1
    `;
    
    const params = [id];
    
    // School filter for school admins
    if (!isSuperAdmin && schoolId) {
      query += ` AND sm.school_id = $2`;
      params.push(schoolId);
    }
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found or access denied' 
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
// RESPOND TO MESSAGE (Admin) - School-scoped
// ============================================
const respondToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { response, status } = req.body;
    const adminId = req.user.userId;
    const { schoolId, isSuperAdmin, role } = req.user;
    
    console.log('🔥 [SUPPORT] respondToMessage:', { adminId, schoolId, isSuperAdmin, role });
    
    if (!response) {
      return res.status(400).json({ 
        success: false, 
        message: 'Response is required' 
      });
    }
    
    // Determine if super admin (admins table) or school admin
    const effectiveSuperAdmin = isSuperAdmin === true || role === 'admin';
    
    // First check if message belongs to admin's school
    if (!effectiveSuperAdmin && schoolId) {
      console.log('🔥 [SUPPORT] Checking school access for school admin');
      const checkResult = await db.query(
        'SELECT school_id FROM support_messages WHERE id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Message not found' 
        });
      }
      
      if (checkResult.rows[0].school_id !== schoolId) {
        return res.status(403).json({
          success: false,
          message: 'You can only respond to messages from your school'
        });
      }
    }
    
    // Update message with response
    // Reset is_read to false so user sees notification of new response
    const result = await db.query(
      `UPDATE support_messages 
       SET admin_response = $1, 
           status = COALESCE($2, 'in_progress'), 
           responded_by = $3, 
           responded_at = NOW(),
           is_read = false
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
    
    // Create notification for the user (school admin for super admin messages, regular user for normal messages)
    const notificationType = message.is_super_admin_message ? 'super_admin_response' : 'support_response';
    const notificationTitle = message.is_super_admin_message 
      ? 'Super Admin Responded to Your Request'
      : 'Response to Your Support Request';
    
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, NOW())`,
      [message.user_id, notificationType, notificationTitle, `Response to: ${message.subject}`]
    );
    
    // Emit real-time response to the user
    emitToUser(message.user_id, 'support:response', {
      messageId: message.id,
      response: message.admin_response,
      status: message.status,
      respondedAt: message.responded_at
    });
    
    res.json({ 
      success: true, 
      message: 'Response sent successfully',
      data: message
    });
  } catch (error) {
    console.error('❌ [SUPPORT] Error responding to message:', error.message);
    console.error('Error details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send response: ' + error.message
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
    const { schoolId, isSuperAdmin } = req.user;
    
    let query = 'DELETE FROM support_messages WHERE id = $1';
    const params = [id];
    
    // School filter for school admins
    if (!isSuperAdmin && schoolId) {
      query += ` AND school_id = $2`;
      params.push(schoolId);
    }
    
    query += ' RETURNING *';
    
    const result = await db.query(query, params);
    
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

// ============================================
// GET UNREAD SUPPORT MESSAGES COUNT (for badge)
// ============================================
const getUnreadSupportCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { schoolId, isSuperAdmin, role } = req.user;
    
    // For learners/teachers: count messages with unread responses (admin_response exists AND is_read = false)
    // For admins: count open/in_progress messages in their school
    let query;
    let params;
    
    const isAdmin = isSuperAdmin || role === 'school_admin' || role === 'admin';
    
    if (isAdmin) {
      // Admin view: count open/in_progress messages in their school (these need attention)
      query = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'open') as open_count,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
          COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as unread_count,
          COUNT(*) as total_count
        FROM support_messages 
        WHERE 1=1
      `;
      params = [];
      
      if (!isSuperAdmin && schoolId) {
        query += ` AND school_id = $1`;
        params.push(schoolId);
      }
    } else {
      // Learner/Teacher view: count messages with unread admin responses
      query = `
        SELECT 
          COUNT(*) FILTER (WHERE admin_response IS NOT NULL AND is_read = false) as unread_count,
          COUNT(*) FILTER (WHERE admin_response IS NOT NULL) as total_responses,
          COUNT(*) as total_messages
        FROM support_messages 
        WHERE user_id = $1
      `;
      params = [userId];
    }
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      data: result.rows[0],
      userType: isAdmin ? 'admin' : 'user'
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch unread count' 
    });
  }
};

// ============================================
// SEND MESSAGE TO SUPER ADMIN (School Admin only)
// ============================================
const sendMessageToSuperAdmin = async (req, res) => {
  try {
    const { subject, message, category = 'general' } = req.body;
    const userId = req.user.userId;
    const schoolId = req.user.schoolId;
    const { role } = req.user;
    
    // Only school admins can contact super admin
    if (role !== 'school_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only school admins can contact the Super Admin'
      });
    }
    
    if (!subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject and message are required' 
      });
    }
    
    const result = await db.query(
      `INSERT INTO support_messages (user_id, school_id, subject, message, category, status, is_super_admin_message, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', true, NOW())
       RETURNING *`,
      [userId, schoolId, subject, message, category]
    );
    
    // Create notification for super admins only
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       SELECT id, 'support_super_admin', 'School Admin Needs Help', $1, false, NOW()
       FROM admins WHERE role = 'super_admin' OR is_super_admin = true`,
      [`Message from school admin: ${subject}`]
    );
    
    // Emit real-time to all super admins
    emitToSuperAdmins('support:super_admin_message', {
      message: result.rows[0],
      type: 'super_admin_message'
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Message sent to Super Admin successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error sending message to super admin:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message: ' + error.message 
    });
  }
};

// ============================================
// GET SUPER ADMIN MESSAGES (For Super Admin only)
// ============================================
const getSuperAdminMessages = async (req, res) => {
  try {
    const { isSuperAdmin } = req.user;
    
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Super Admin access required'
      });
    }
    
    const result = await db.query(`
      SELECT sm.*, 
             u.first_name as user_first_name, 
             u.last_name as user_last_name,
             u.email as user_email,
             s.name as school_name,
             s.code as school_code,
             responder.first_name as responder_first_name,
             responder.last_name as responder_last_name
      FROM support_messages sm
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN schools s ON sm.school_id = s.id
      LEFT JOIN users responder ON sm.responded_by = responder.id
      WHERE sm.is_super_admin_message = true
      ORDER BY 
        CASE sm.status 
          WHEN 'open' THEN 1 
          WHEN 'in_progress' THEN 2 
          WHEN 'resolved' THEN 3 
        END,
        sm.created_at DESC
    `);
    
    // Get stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) as total_count
      FROM support_messages
      WHERE is_super_admin_message = true
    `);
    
    res.json({ 
      success: true, 
      data: result.rows,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching super admin messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch messages' 
    });
  }
};

module.exports = {
  sendMessageToAdmin,
  sendMessageToSuperAdmin,
  getMyMessages,
  getAllSupportMessages,
  getSuperAdminMessages,
  getSupportMessageById,
  respondToMessage,
  updateMessageStatus,
  deleteMessage,
  getUnreadSupportCount,
  markMessageAsRead
};
