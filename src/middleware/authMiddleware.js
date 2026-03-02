const { verifyToken } = require('../config/auth');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('🔍 [AUTH] Header received:', authHeader);

    if (!authHeader) {
      console.log('❌ [AUTH] No auth header');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ [AUTH] Invalid format:', authHeader.substring(0, 20));
      return res.status(401).json({ success: false, message: 'Invalid token format' });
    }

    let token = authHeader.split(' ')[1];
    
    // DEBUG: Log raw token
    console.log('🔍 [AUTH] Raw token:', token);
    console.log('🔍 [AUTH] Token length:', token?.length);
    console.log('🔍 [AUTH] First 30 chars:', token?.substring(0, 30));
    console.log('🔍 [AUTH] Last 30 chars:', token?.substring(token?.length - 30));
    
    // Clean token - remove any quotes or extra whitespace
    token = token.trim();
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.replace(/^"|"$/g, '');
      console.log('🔍 [AUTH] Removed quotes from token');
    }
    
    // Check JWT format (should be 3 parts separated by dots)
    const parts = token.split('.');
    console.log('🔍 [AUTH] JWT parts count:', parts.length);
    
    if (parts.length !== 3) {
      console.log('❌ [AUTH] Invalid JWT format - expected 3 parts, got', parts.length);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token format',
        debug: { parts: parts.length, tokenStart: token.substring(0, 20) }
      });
    }

    // Try to decode without verification first to see payload
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('🔍 [AUTH] Token payload:', payload);
    } catch (e) {
      console.log('❌ [AUTH] Could not decode payload:', e.message);
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
      console.log('✅ [AUTH] Token verified, userId:', decoded.userId);
    } catch (verifyError) {
      console.log('❌ [AUTH] verifyToken failed:', verifyError.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token',
        error: verifyError.message
      });
    }
    
    // Check user in database
    const result = await db.query(
      'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      console.log('❌ [AUTH] User not found:', decoded.userId);
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    if (!result.rows[0].is_active) {
      console.log('❌ [AUTH] User inactive:', decoded.userId);
      return res.status(401).json({ success: false, message: 'User account is inactive' });
    }

    req.user = {
      userId: result.rows[0].id,
      email: result.rows[0].email,
      role: result.rows[0].role,
      firstName: result.rows[0].first_name,
      lastName: result.rows[0].last_name
    };

    console.log('✅ [AUTH] Success - User:', req.user.email);
    next();
    
  } catch (error) {
    console.error('❌ [AUTH] Unexpected error:', error);
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