const db = require('./src/config/database');
const { verifyToken } = require('./src/config/auth');

async function test() {
  // Simulate what the auth middleware does
  const token = process.argv[2];
  if (!token) {
    console.log('Usage: node test-admin-api.js <jwt_token>');
    process.exit(1);
  }
  
  try {
    const decoded = verifyToken(token);
    console.log('Decoded token:', decoded);
    
    // Check admins table
    let userResult = await db.query(
      `SELECT id, email, first_name, last_name, is_active, is_super_admin 
       FROM admins WHERE id = $1`,
      [decoded.userId]
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('Found in admins table:', {
        id: user.id,
        email: user.email,
        is_super_admin: user.is_super_admin,
        computedIsSuperAdmin: user.is_super_admin || false
      });
    } else {
      console.log('Not found in admins table');
      
      // Check users table
      userResult = await db.query(
        `SELECT id, email, role, first_name, last_name, is_active, school_id 
         FROM users WHERE id = $1`,
        [decoded.userId]
      );
      
      if (userResult.rows.length > 0) {
        console.log('Found in users table:', userResult.rows[0]);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  process.exit(0);
}

test();
