const { verifyToken } = require('../config/auth');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    const result = await db.query(
      'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = {
      userId: result.rows[0].id,
      email: result.rows[0].email,
      role: result.rows[0].role,
      firstName: result.rows[0].first_name,
      lastName: result.rows[0].last_name
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
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