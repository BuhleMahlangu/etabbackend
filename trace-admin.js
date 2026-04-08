const db = require('./src/config/database');

async function trace() {
  try {
    // Test the exact query the controller would run for tomjiyane@gmail.com
    const userResult = await db.query(
      `SELECT id, email, role, school_id, is_active 
       FROM users WHERE email = 'tomjiyane@gmail.com'`
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found!');
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log('User from DB:', user);
    
    // Simulate req.user object
    const reqUser = {
      userId: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.school_id || null,
      isSuperAdmin: false,
      table: 'users'
    };
    
    console.log('Simulated req.user:', reqUser);
    
    // Simulate controller logic
    const { schoolId, isSuperAdmin, table } = reqUser;
    const effectiveSuperAdmin = isSuperAdmin || table === 'admins';
    
    console.log('Variables:', { schoolId, isSuperAdmin, table, effectiveSuperAdmin });
    
    if (!effectiveSuperAdmin) {
      if (schoolId) {
        console.log('✅ Would filter by schoolId:', schoolId);
        
        // Run the actual query
        const query = `SELECT * FROM subjects WHERE school_id = $1 LIMIT 5`;
        const result = await db.query(query, [schoolId]);
        console.log(`✅ Found ${result.rows.length} subjects for this school`);
        
      } else {
        console.log('❌ Would return 403 - School admin without schoolId!');
      }
    } else {
      console.log('✅ Super admin - no school filter');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

trace();
