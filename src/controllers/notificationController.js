const db = require('../config/database');

// ============================================
// GET NOTIFICATIONS FOR CURRENT USER
// ============================================
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT n.*, s.name as subject_name, s.code as subject_code
      FROM notifications n
      LEFT JOIN subjects s ON n.related_subject_id = s.id
      WHERE n.user_id = $1
    `;
    let params = [userId];
    let paramCount = 1;

    if (unreadOnly === 'true') {
      query += ` AND n.is_read = false`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get unread count
    const unreadCount = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    // Get total count
    const totalCount = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      unreadCount: parseInt(unreadCount.rows[0].count),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount: parseInt(totalCount.rows[0].count),
        totalPages: Math.ceil(parseInt(totalCount.rows[0].count) / limit)
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// ============================================
// MARK NOTIFICATION AS READ
// ============================================
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Marked as read', data: result.rows[0] });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

// ============================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    await db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({ success: true, message: 'All notifications marked as read' });

  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
};

// ============================================
// DELETE NOTIFICATION
// ============================================
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
};

// ============================================
// GET NOTIFICATION STATS
// ============================================
const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE type = 'material') as materials,
        COUNT(*) FILTER (WHERE type = 'deadline') as deadlines,
        COUNT(*) FILTER (WHERE type = 'announcement') as announcements
      FROM notifications 
      WHERE user_id = $1
    `, [userId]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

// Legacy function for backward compatibility
const getForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Security check - only allow users to access their own notifications
    // unless they're an admin
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await db.query(
      `SELECT n.*, s.name as subject_name, s.code as subject_code
       FROM notifications n
       LEFT JOIN subjects s ON n.related_subject_id = s.id
       WHERE n.user_id = $1 
       ORDER BY n.created_at DESC 
       LIMIT 50`,
      [userId]
    );

    // Get unread count
    const unreadCount = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    
    res.json({ 
      success: true, 
      data: result.rows,
      unreadCount: parseInt(unreadCount.rows[0].count)
    });

  } catch (error) {
    console.error('Get notifications for user error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// ============================================
// SEND GLOBAL NOTIFICATION TO ALL USERS (Super Admin only)
// ============================================
const sendGlobalNotification = async (req, res) => {
  try {
    const { title, message, type = 'announcement' } = req.body;
    const userSchoolId = req.user.schoolId;

    if (!title || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and message are required' 
      });
    }

    // Get all active users in the system (filtered by school for school_admin)
    let usersQuery = `
      SELECT id FROM users 
      WHERE is_active = true 
      AND role IN ('learner', 'teacher', 'school_admin')
    `;
    
    if (userSchoolId) {
      usersQuery += ` AND school_id = '${userSchoolId}'`;
    }

    const usersResult = await db.query(usersQuery);
    const userIds = usersResult.rows.map(u => u.id);

    if (userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No users found to notify' 
      });
    }

    // Insert notification for each user
    const notificationValues = userIds.map(userId => {
      return `('${userId}', '${type}', '${title.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}', false, NOW())`;
    }).join(', ');

    const insertQuery = `
      INSERT INTO notifications 
        (user_id, type, title, message, is_read, created_at)
      VALUES ${notificationValues}
      RETURNING id
    `;

    const result = await db.query(insertQuery);

    res.json({
      success: true,
      message: `Notification sent to ${userIds.length} users`,
      data: {
        recipientsCount: userIds.length,
        notificationIds: result.rows.map(r => r.id)
      }
    });

  } catch (error) {
    console.error('Send global notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to send global notification' });
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
  getForUser,
  sendGlobalNotification
};
