const db = require('../config/database');
const { emitToUser } = require('../config/socket');

// ============================================
// CREATE NOTIFICATION - With real-time emit
// ============================================
async function createNotification({ userId, type, title, message, relatedSubjectId = null }) {
  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at, related_subject_id)
       VALUES ($1, $2, $3, $4, false, NOW(), $5)
       RETURNING *`,
      [userId, type, title, message, relatedSubjectId]
    );

    const notification = result.rows[0];

    // Emit real-time notification to user
    emitToUser(userId, 'notification:new', {
      notification,
      unreadCount: await getUnreadCount(userId)
    });

    console.log(`🔔 [NOTIFY] Sent to user ${userId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('❌ [NOTIFY] Error creating notification:', error);
    throw error;
  }
}

// ============================================
// CREATE BULK NOTIFICATIONS - For multiple users
// ============================================
async function createBulkNotifications(userIds, { type, title, message, relatedSubjectId = null }) {
  const notifications = [];
  
  for (const userId of userIds) {
    try {
      const notification = await createNotification({
        userId,
        type,
        title,
        message,
        relatedSubjectId
      });
      notifications.push(notification);
    } catch (error) {
      console.error(`❌ [NOTIFY] Failed to notify user ${userId}:`, error);
    }
  }
  
  return notifications;
}

// ============================================
// NOTIFY SCHOOL ADMINS - Send to all admins in a school
// ============================================
async function notifySchoolAdmins(schoolId, { type, title, message }) {
  try {
    // Get all school admins
    const result = await db.query(
      'SELECT id FROM users WHERE role = $1 AND school_id = $2',
      ['school_admin', schoolId]
    );
    
    const adminIds = result.rows.map(row => row.id);
    
    if (adminIds.length === 0) {
      console.log(`⚠️ [NOTIFY] No school admins found for school ${schoolId}`);
      return [];
    }
    
    return await createBulkNotifications(adminIds, { type, title, message });
  } catch (error) {
    console.error('❌ [NOTIFY] Error notifying school admins:', error);
    throw error;
  }
}

// ============================================
// NOTIFY SUPER ADMINS - Send to all super admins
// ============================================
async function notifySuperAdmins({ type, title, message }) {
  try {
    const result = await db.query(
      "SELECT id FROM admins WHERE role = 'admin' OR is_super_admin = true"
    );
    
    const adminIds = result.rows.map(row => row.id);
    
    return await createBulkNotifications(adminIds, { type, title, message });
  } catch (error) {
    console.error('❌ [NOTIFY] Error notifying super admins:', error);
    throw error;
  }
}

// ============================================
// NOTIFY SCHOOL USERS - Send to all users in a school
// ============================================
async function notifySchoolUsers(schoolId, { type, title, message, excludeUserId = null }) {
  try {
    let query = 'SELECT id FROM users WHERE school_id = $1';
    let params = [schoolId];
    
    if (excludeUserId) {
      query += ' AND id != $2';
      params.push(excludeUserId);
    }
    
    const result = await db.query(query, params);
    const userIds = result.rows.map(row => row.id);
    
    return await createBulkNotifications(userIds, { type, title, message });
  } catch (error) {
    console.error('❌ [NOTIFY] Error notifying school users:', error);
    throw error;
  }
}

// ============================================
// GET UNREAD COUNT
// ============================================
async function getUnreadCount(userId) {
  const result = await db.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return parseInt(result.rows[0].count);
}

// ============================================
// MARK AS READ - With socket emit
// ============================================
async function markAsRead(userId, notificationId) {
  const result = await db.query(
    `UPDATE notifications 
     SET is_read = true, read_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );
  
  if (result.rows.length > 0) {
    // Emit updated unread count
    emitToUser(userId, 'notification:read', {
      notificationId,
      unreadCount: await getUnreadCount(userId)
    });
  }
  
  return result.rows[0];
}

module.exports = {
  createNotification,
  createBulkNotifications,
  notifySchoolAdmins,
  notifySuperAdmins,
  notifySchoolUsers,
  getUnreadCount,
  markAsRead
};
