const db = require('../config/database');

// ============================================
// SEND MESSAGE (Learner to Teacher or Teacher to Learner)
// ============================================
const sendMessage = async (req, res) => {
  try {
    const { subjectId, recipientId, message, parentMessageId } = req.body;
    const senderId = req.user.userId;
    const senderRole = req.user.role;
    
    if (!subjectId || !recipientId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject, recipient, and message are required'
      });
    }
    
    // Verify the subject exists
    const subjectCheck = await db.query(
      'SELECT id, name FROM modules WHERE id = $1',
      [subjectId]
    );
    
    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }
    
    // Insert message
    const result = await db.query(
      `INSERT INTO subject_messages 
       (subject_id, sender_id, sender_role, recipient_id, message, parent_message_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [subjectId, senderId, senderRole, recipientId, message, parentMessageId || null]
    );
    
    // Create notification for recipient
    const senderName = await getUserName(senderId);
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, 'subject_message', 'New Subject Message', $2, false, NOW())`,
      [recipientId, `New message from ${senderName} in ${subjectCheck.rows[0].name}`]
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
// GET MESSAGES FOR A SUBJECT (Conversation view)
// ============================================
const getSubjectMessages = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const userId = req.user.userId;
    const { otherUserId } = req.query;
    
    let query = `
      SELECT sm.*,
             s.name as subject_name,
             sender.first_name as sender_first_name,
             sender.last_name as sender_last_name,
             sender.email as sender_email,
             recipient.first_name as recipient_first_name,
             recipient.last_name as recipient_last_name
      FROM subject_messages sm
      JOIN modules s ON sm.subject_id = s.id
      JOIN users sender ON sm.sender_id = sender.id
      JOIN users recipient ON sm.recipient_id = recipient.id
      WHERE sm.subject_id = $1
      AND (sm.sender_id = $2 OR sm.recipient_id = $2)
    `;
    
    const params = [subjectId, userId];
    
    if (otherUserId) {
      query += ` AND (sm.sender_id = $3 OR sm.recipient_id = $3)`;
      params.push(otherUserId);
    }
    
    query += ` ORDER BY sm.created_at ASC`;
    
    const result = await db.query(query, params);
    
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
// GET ALL CONVERSATIONS FOR USER (Grouped by subject and other user)
// ============================================
const getMyConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { role } = req.user;
    
    // Get all unique conversations with latest message and unread count
    const result = await db.query(`
      WITH latest_messages AS (
        SELECT DISTINCT ON (subject_id, 
          CASE 
            WHEN sender_id = $1 THEN recipient_id 
            ELSE sender_id 
          END)
          sm.*,
          s.name as subject_name,
          sender.first_name as sender_first_name,
          sender.last_name as sender_last_name,
          recipient.first_name as recipient_first_name,
          recipient.last_name as recipient_last_name,
          CASE 
            WHEN sender_id = $1 THEN recipient_id 
            ELSE sender_id 
          END as other_user_id,
          CASE 
            WHEN sender_id = $1 THEN recipient.first_name 
            ELSE sender.first_name 
          END as other_user_first_name,
          CASE 
            WHEN sender_id = $1 THEN recipient.last_name 
            ELSE sender.last_name 
          END as other_user_last_name
        FROM subject_messages sm
        JOIN modules s ON sm.subject_id = s.id
        JOIN users sender ON sm.sender_id = sender.id
        JOIN users recipient ON sm.recipient_id = recipient.id
        WHERE sm.sender_id = $1 OR sm.recipient_id = $1
        ORDER BY subject_id, 
          CASE 
            WHEN sender_id = $1 THEN recipient_id 
            ELSE sender_id 
          END,
          sm.created_at DESC
      ),
      unread_counts AS (
        SELECT subject_id,
               sender_id,
               COUNT(*) as unread_count
        FROM subject_messages
        WHERE recipient_id = $1 AND is_read = false
        GROUP BY subject_id, sender_id
      )
      SELECT lm.*,
             COALESCE(uc.unread_count, 0) as unread_count
      FROM latest_messages lm
      LEFT JOIN unread_counts uc ON lm.subject_id = uc.subject_id 
        AND lm.other_user_id = uc.sender_id
      ORDER BY lm.created_at DESC
    `, [userId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
};

// ============================================
// GET TEACHER'S ASSIGNED SUBJECTS WITH MESSAGE STATS
// ============================================
const getTeacherSubjectStats = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    
    const result = await db.query(`
      SELECT 
        m.id,
        m.name as subject_name,
        m.code,
        COUNT(DISTINCT lm.learner_id) as learner_count,
        COUNT(DISTINCT CASE WHEN sm.is_read = false AND sm.recipient_id = $1 THEN sm.id END) as unread_count,
        COUNT(DISTINCT sm.id) as total_messages
      FROM modules m
      LEFT JOIN teacher_assignments ta ON m.id = ta.subject_id AND ta.is_active = true
      LEFT JOIN learner_modules lm ON m.id = lm.module_id AND lm.status = 'active'
      LEFT JOIN subject_messages sm ON m.id = sm.subject_id
      WHERE ta.teacher_id = $1
      GROUP BY m.id, m.name, m.code
      ORDER BY m.name
    `, [teacherId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching teacher subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subject stats'
    });
  }
};

// ============================================
// GET LEARNERS FOR A SUBJECT (Teacher view)
// ============================================
const getSubjectLearners = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const teacherId = req.user.userId;
    
    // Verify teacher is assigned to this subject
    const teacherCheck = await db.query(
      'SELECT id FROM teacher_assignments WHERE teacher_id = $1 AND subject_id = $2 AND is_active = true',
      [teacherId, subjectId]
    );
    
    if (teacherCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this subject'
      });
    }
    
    const result = await db.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(CASE WHEN sm.is_read = false AND sm.recipient_id = $2 THEN 1 END) as unread_from_learner,
        MAX(sm.created_at) as last_message_at
      FROM users u
      JOIN learner_modules lm ON u.id = lm.learner_id
      LEFT JOIN subject_messages sm ON (sm.sender_id = u.id AND sm.recipient_id = $2) 
        OR (sm.sender_id = $2 AND sm.recipient_id = u.id)
      WHERE lm.module_id = $1 AND lm.status = 'active'
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY last_message_at DESC NULLS LAST, u.last_name
    `, [subjectId, teacherId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching learners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch learners'
    });
  }
};

// ============================================
// MARK MESSAGES AS READ
// ============================================
const markMessagesAsRead = async (req, res) => {
  try {
    const { subjectId, senderId } = req.body;
    const userId = req.user.userId;
    
    await db.query(`
      UPDATE subject_messages
      SET is_read = true, read_at = NOW()
      WHERE subject_id = $1 
      AND sender_id = $2 
      AND recipient_id = $3
      AND is_read = false
    `, [subjectId, senderId, userId]);
    
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
};

// ============================================
// GET UNREAD MESSAGE COUNT
// ============================================
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await db.query(`
      SELECT COUNT(*) as unread_count,
             COUNT(DISTINCT subject_id) as subjects_with_unread
      FROM subject_messages
      WHERE recipient_id = $1 AND is_read = false
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        unreadCount: parseInt(result.rows[0].unread_count),
        subjectsWithUnread: parseInt(result.rows[0].subjects_with_unread)
      }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count'
    });
  }
};

// Helper function
async function getUserName(userId) {
  try {
    const result = await db.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length > 0) {
      return `${result.rows[0].first_name} ${result.rows[0].last_name}`;
    }
    return 'Unknown User';
  } catch (e) {
    return 'Unknown User';
  }
}

module.exports = {
  sendMessage,
  getSubjectMessages,
  getMyConversations,
  getTeacherSubjectStats,
  getSubjectLearners,
  markMessagesAsRead,
  getUnreadCount
};
