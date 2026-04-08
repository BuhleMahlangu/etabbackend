const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { 
  sendWelcomeEmail, 
  sendPasswordChangeNotification, 
  send2FACode, 
  sendProfileUpdateNotification 
} = require('../config/email');

// In-memory store for 2FA codes (use Redis in production)
const twoFactorCodes = new Map();

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================
// UPDATE PROFILE (Works for both Teachers & Learners)
// ============================================
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, phone, bio } = req.body;

    console.log('[updateProfile] Updating profile for user:', userId);

    // Get current user data for comparison
    const currentUser = await db.query(
      'SELECT first_name, last_name, email, phone, bio, role, school_id FROM users WHERE id = $1',
      [userId]
    );

    if (currentUser.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const oldData = currentUser.rows[0];
    const changes = [];

    // Track changes for email notification
    if (firstName && firstName !== oldData.first_name) {
      changes.push(`First name changed from "${oldData.first_name}" to "${firstName}"`);
    }
    if (lastName && lastName !== oldData.last_name) {
      changes.push(`Last name changed from "${oldData.last_name}" to "${lastName}"`);
    }
    if (phone !== undefined && phone !== oldData.phone) {
      changes.push(`Phone number updated`);
    }
    if (bio !== undefined && bio !== oldData.bio) {
      changes.push(`Bio updated`);
    }

    // Update user profile
    const result = await db.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           bio = COALESCE($4, bio),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, email, first_name, last_name, phone, bio, role, avatar_url`,
      [firstName, lastName, phone, bio, userId]
    );

    const updatedUser = result.rows[0];

    // Send email notification for learners
    if (oldData.role === 'learner' && changes.length > 0) {
      sendProfileUpdateNotification(
        { firstName: updatedUser.first_name, lastName: updatedUser.last_name, email: updatedUser.email, schoolId: oldData.school_id },
        changes
      ).catch(err => console.error('Failed to send profile update email:', err));
    }

    console.log('[updateProfile] Profile updated successfully');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('[updateProfile] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// ============================================
// REQUEST PASSWORD CHANGE (Send 2FA Code)
// ============================================
const requestPasswordChange = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword } = req.body;

    console.log('[requestPasswordChange] Password change requested for user:', userId);

    // Get user data
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name, password_hash, role, school_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Generate 2FA code
    const verificationCode = generateVerificationCode();
    
    // Store code with expiration (10 minutes)
    twoFactorCodes.set(userId, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0
    });

    // Send 2FA code via email
    const emailResult = await send2FACode(
      { firstName: user.first_name, lastName: user.last_name, email: user.email, schoolId: user.school_id },
      verificationCode
    );

    if (!emailResult.success) {
      console.error('[requestPasswordChange] Failed to send email:', emailResult.error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send verification code. Please try again later.' 
      });
    }

    console.log('[requestPasswordChange] 2FA code sent to:', user.email);
    
    // DEBUG: Log code to console (remove in production)
    console.log('[DEBUG] 2FA Code for user:', verificationCode);

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      data: {
        email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Masked email
        expiresIn: 600, // 10 minutes in seconds
        // DEBUG: Include code in response for testing (remove in production)
        // code: verificationCode 
      }
    });

  } catch (error) {
    console.error('[requestPasswordChange] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

// ============================================
// VERIFY 2FA CODE & CHANGE PASSWORD
// ============================================
const verifyAndChangePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { verificationCode, newPassword } = req.body;

    console.log('[verifyAndChangePassword] Verifying code for user:', userId);

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters long' 
      });
    }

    // Get stored 2FA data
    const twoFactorData = twoFactorCodes.get(userId);

    if (!twoFactorData) {
      return res.status(400).json({ 
        success: false, 
        message: 'No verification code found. Please request a new code.' 
      });
    }

    // Check if code is expired
    if (Date.now() > twoFactorData.expiresAt) {
      twoFactorCodes.delete(userId);
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired. Please request a new code.' 
      });
    }

    // Check max attempts (3 attempts allowed)
    if (twoFactorData.attempts >= 3) {
      twoFactorCodes.delete(userId);
      return res.status(400).json({ 
        success: false, 
        message: 'Too many failed attempts. Please request a new code.' 
      });
    }

    // Verify code
    if (twoFactorData.code !== verificationCode) {
      twoFactorData.attempts += 1;
      return res.status(400).json({ 
        success: false, 
        message: `Invalid verification code. ${3 - twoFactorData.attempts} attempts remaining.` 
      });
    }

    // Get user data
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name, role, school_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    // Clear 2FA code
    twoFactorCodes.delete(userId);

    // Send password change notification
    if (user.role === 'learner') {
      sendPasswordChangeNotification({
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        schoolId: user.school_id
      }).catch(err => console.error('Failed to send password change email:', err));
    }

    console.log('[verifyAndChangePassword] Password changed successfully for:', user.email);

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again with your new password.'
    });

  } catch (error) {
    console.error('[verifyAndChangePassword] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// ============================================
// RESEND 2FA CODE
// ============================================
const resend2FACode = async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log('[resend2FACode] Resending code for user:', userId);

    // Get user data
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name, school_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate new code
    const verificationCode = generateVerificationCode();
    
    // Update stored code
    twoFactorCodes.set(userId, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    });

    // Send email
    const emailResult = await send2FACode(
      { firstName: user.first_name, lastName: user.last_name, email: user.email, schoolId: user.school_id },
      verificationCode
    );

    if (!emailResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send verification code' 
      });
    }

    res.json({
      success: true,
      message: 'New verification code sent to your email'
    });

  } catch (error) {
    console.error('[resend2FACode] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend code' });
  }
};

// ============================================
// GET USER SETTINGS
// ============================================
const getUserSettings = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone, bio, role, 
              avatar_url, email_notifications, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        bio: user.bio,
        role: user.role,
        avatarUrl: user.avatar_url,
        emailNotifications: user.email_notifications,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('[getUserSettings] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

// ============================================
// UPDATE NOTIFICATION PREFERENCES
// ============================================
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { emailNotifications } = req.body;

    await db.query(
      'UPDATE users SET email_notifications = $1, updated_at = NOW() WHERE id = $2',
      [emailNotifications, userId]
    );

    res.json({
      success: true,
      message: 'Notification preferences updated'
    });

  } catch (error) {
    console.error('[updateNotificationPreferences] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
};

module.exports = {
  updateProfile,
  requestPasswordChange,
  verifyAndChangePassword,
  resend2FACode,
  getUserSettings,
  updateNotificationPreferences,
  sendWelcomeEmail
};
