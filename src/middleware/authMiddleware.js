const { verifyToken } = require('../config/auth');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('🔍 [AUTH] Header received:', authHeader ? 'exists' : 'missing');

    if (!authHeader) {
      console.log('❌ [AUTH] No auth header');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ [AUTH] Invalid format:', authHeader.substring(0, 20));
      return res.status(401).json({ success: false, message: 'Invalid token format' });
    }

    let token = authHeader.split(' ')[1];
    
    // ============================================
    // AGGRESSIVE TOKEN CLEANING
    // ============================================
    console.log('🔍 [AUTH] Raw token length:', token.length);
    console.log('🔍 [AUTH] Raw token start:', token.substring(0, 10));
    console.log('🔍 [AUTH] Raw token end:', token.substring(token.length - 10));
    
    // Step 1: Trim whitespace
    token = token.trim();
    
    // Step 2: Remove surrounding quotes (single or double)
    token = token.replace(/^["']|["']$/g, '');
    
    // Step 3: Remove any escaped quotes
    token = token.replace(/\\"/g, '"');
    token = token.replace(/\\'/g, "'");
    
    // Step 4: Remove any newlines or carriage returns
    token = token.replace(/[\n\r]/g, '');
    
    console.log('🔍 [AUTH] Cleaned token length:', token.length);
    console.log('🔍 [AUTH] Cleaned token start:', token.substring(0, 20));

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
      console.log('✅ [AUTH] Token verified, userId:', decoded.userId, 'role:', decoded.role);
    } catch (verifyError) {
      console.log('❌ [AUTH] verifyToken failed:', verifyError.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token',
        error: verifyError.message
      });
    }
    
    // ============================================
    // FIXED: Separate queries for admins and users
    // Admins table does NOT have 'role' column
    // Users table HAS 'role' column
    // ============================================
    
    // First check admins table (without 'role' column)
    let userResult = await db.query(
      `SELECT id, email, first_name, last_name, is_active, is_super_admin 
       FROM admins WHERE id = $1`,
      [decoded.userId]
    );
    
    let user = userResult.rows[0];
    let table = 'admins';
    let role = 'admin'; // Admins don't have role column, default to 'admin'
    
    // If not found in admins, check users table (has 'role' column)
    if (!user) {
      userResult = await db.query(
        `SELECT id, email, role, first_name, last_name, is_active 
         FROM users WHERE id = $1`,
        [decoded.userId]
      );
      user = userResult.rows[0];
      table = 'users';
      role = user?.role; // Users have role column from database
    }

    if (!user) {
      console.log('❌ [AUTH] User not found in any table:', decoded.userId);
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    if (!user.is_active) {
      console.log('❌ [AUTH] User inactive:', decoded.userId);
      return res.status(401).json({ success: false, message: 'User account is inactive' });
    }

    // Build req.user object
    req.user = {
      userId: user.id,
      email: user.email,
      role: role, // Use the role determined above
      firstName: user.first_name,
      lastName: user.last_name,
      isSuperAdmin: user.is_super_admin || false, // Only exists for admins
      table // For debugging: 'admins' or 'users'
    };

    console.log('✅ [AUTH] Success - User:', req.user.email, 'Role:', req.user.role, 'Table:', table);
    next();
    
  } catch (error) {
    console.error('❌ [AUTH] Unexpected error:', error.message);
    
    // Check for database connection errors
    if (error.message && error.message.includes('timeout')) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection timeout. Please try again.' 
      });
    }
    
    if (error.message && error.message.includes('terminated')) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection lost. Please try again.' 
      });
    }
    
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// Role-based access control middleware
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

module.exports = { authenticate, restrictTo };