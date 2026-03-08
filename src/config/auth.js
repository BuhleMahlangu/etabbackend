const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ============================================
// JWT Configuration Validation
// ============================================

const validateConfig = () => {
  console.log('🔐 JWT Configuration:');
  console.log('  JWT_SECRET exists:', JWT_SECRET ? '✅ Yes' : '❌ NO - MISSING!');
  console.log('  JWT_SECRET length:', JWT_SECRET ? JWT_SECRET.length : 0);
  console.log('  JWT_EXPIRES_IN:', JWT_EXPIRES_IN);

  if (!JWT_SECRET) {
    console.error('❌ FATAL ERROR: JWT_SECRET environment variable is not set!');
    console.error('   Please add JWT_SECRET to your .env file');
    console.error('   Example: JWT_SECRET=your_super_secret_random_string_here');
    
    // Development fallback (REMOVE IN PRODUCTION!)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  DEVELOPMENT MODE: Using temporary fallback secret');
      console.warn('   DO NOT USE THIS IN PRODUCTION!');
      return 'temporary_dev_secret_change_immediately';
    } else {
      throw new Error('JWT_SECRET must be defined in environment variables');
    }
  }

  // Validate secret length (minimum 32 characters for security)
  if (JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for security');
  }

  return JWT_SECRET;
};

const SECRET = validateConfig();

// ============================================
// Token Generation
// ============================================

const generateToken = (payload) => {
  try {
    // Ensure required fields are present
    if (!payload.userId && !payload.id) {
      throw new Error('Payload must contain userId or id');
    }

    const token = jwt.sign(
      {
        userId: payload.userId || payload.id,
        email: payload.email,
        role: payload.role,
        ...payload // Include any additional fields
      }, 
      SECRET, 
      { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'e-tab-platform',
        audience: 'e-tab-users'
      }
    );

    console.log('✅ Token generated for user:', payload.userId || payload.id);
    return token;
  } catch (error) {
    console.error('❌ Token generation failed:', error.message);
    throw error;
  }
};

// ============================================
// Token Verification
// ============================================

const verifyToken = (token) => {
  // Initial validation
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }

  let cleanToken = token.trim();

  // Remove quotes if present (common localStorage issue)
  if (cleanToken.startsWith('"') && cleanToken.endsWith('"')) {
    cleanToken = cleanToken.replace(/^"|"$/g, '');
  }

  // Remove Bearer prefix if present
  if (cleanToken.toLowerCase().startsWith('bearer ')) {
    cleanToken = cleanToken.substring(7).trim();
  }

  // Validate JWT structure
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
  }

  // Verify and decode
  try {
    const decoded = jwt.verify(cleanToken, SECRET, {
      issuer: 'e-tab-platform',
      audience: 'e-tab-users'
    });

    console.log('✅ Token verified for user:', decoded.userId);
    return decoded;
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    
    // Provide specific error messages
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired. Please log in again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token format.');
    }
    
    throw error;
  }
};

// ============================================
// Token Decoding (without verification - for debugging)
// ============================================

const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('❌ Token decode failed:', error.message);
    return null;
  }
};

// ============================================
// Middleware for Express
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: error.message || 'Invalid or expired token' 
    });
  }
};

// ============================================
// Role-based Authorization Middleware
// ============================================

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    next();
  };
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  authenticateToken,
  authorize
};