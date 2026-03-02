const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// DEBUG: Log the status (remove this after fixing)
console.log('🔐 JWT Configuration:');
console.log('  JWT_SECRET exists:', JWT_SECRET ? '✅ Yes' : '❌ NO - MISSING!');
console.log('  JWT_SECRET length:', JWT_SECRET ? JWT_SECRET.length : 0);
console.log('  JWT_EXPIRES_IN:', JWT_EXPIRES_IN);

// Validate that JWT_SECRET is set
if (!JWT_SECRET) {
  console.error('❌ FATAL ERROR: JWT_SECRET environment variable is not set!');
  console.error('   Please add JWT_SECRET to your .env file');
  console.error('   Example: JWT_SECRET=your_super_secret_random_string_here');
  
  // For development only: use a fallback (REMOVE IN PRODUCTION!)
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️  DEVELOPMENT MODE: Using temporary fallback secret');
    console.warn('   DO NOT USE THIS IN PRODUCTION!');
  } else {
    throw new Error('JWT_SECRET must be defined in environment variables');
  }
}

const generateToken = (payload) => {
  const secret = JWT_SECRET || 'temporary_dev_secret_change_immediately';
  
  try {
    const token = jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
    console.log('✅ Token generated for user:', payload.userId || payload.id);
    return token;
  } catch (error) {
    console.error('❌ Token generation failed:', error.message);
    throw error;
  }
};

const verifyToken = (token) => {
  const secret = JWT_SECRET || 'temporary_dev_secret_change_immediately';
  
  // DEBUG: Log what we received
  console.log('🔍 verifyToken called');
  console.log('  Token type:', typeof token);
  console.log('  Token length:', token?.length);
  console.log('  First 50 chars:', token?.substring(0, 50));
  
  // Check if token is valid format before trying to verify
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  
  // Clean the token
  let cleanToken = token.trim();
  
  // Remove quotes if present (common issue with localStorage)
  if (cleanToken.startsWith('"') && cleanToken.endsWith('"')) {
    cleanToken = cleanToken.replace(/^"|"$/g, '');
    console.log('  Removed quotes from token');
  }
  
  // Remove Bearer prefix if somehow still present
  if (cleanToken.startsWith('Bearer ')) {
    cleanToken = cleanToken.substring(7).trim();
    console.log('  Removed Bearer prefix from token');
  }
  
  // Check JWT structure (should have 3 parts)
  const parts = cleanToken.split('.');
  console.log('  JWT parts count:', parts.length);
  
  if (parts.length !== 3) {
    console.error('  ❌ Invalid JWT format - expected 3 parts, got', parts.length);
    throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
  }
  
  // Try to decode payload for debugging (without verification)
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('  Token payload (decoded):', {
      userId: payload.userId || payload.id,
      email: payload.email,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp
    });
  } catch (e) {
    console.log('  Could not decode payload:', e.message);
  }
  
  // Now verify with secret
  try {
    const decoded = jwt.verify(cleanToken, secret);
    console.log('✅ Token verified successfully for user:', decoded.userId || decoded.id);
    return decoded;
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    console.error('  Token was:', cleanToken.substring(0, 50) + '...');
    throw error;
  }
};

module.exports = {
  generateToken,
  verifyToken
};