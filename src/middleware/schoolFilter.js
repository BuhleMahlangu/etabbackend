/**
 * Automatic School Filter Middleware
 * This middleware patches db.query to automatically add school_id filters
 */

const db = require('../config/database');

// Tables that need school filtering
const SCHOOL_TABLES = [
  'users', 'subjects', 'modules', 'learner_modules', 
  'teacher_assignments', 'assignments', 'pending_teachers',
  'announcements', 'materials', 'quizzes'
];

// Store original query method
const originalQuery = db.query.bind(db);

/**
 * Middleware that enables automatic school filtering
 */
const autoSchoolFilter = (req, res, next) => {
  const { schoolId, isSuperAdmin } = req.user || {};
  
  if (!schoolId && !isSuperAdmin) {
    return next(); // No filtering if no school (shouldn't happen for logged-in users)
  }
  
  // Store school context on request
  req.schoolContext = { schoolId, isSuperAdmin };
  
  // Log for debugging
  console.log(`🔐 [SchoolFilter] Context set: schoolId=${schoolId}, isSuperAdmin=${isSuperAdmin}`);
  
  next();
};

/**
 * Create a school-filtered query function for a request
 */
const createFilteredQuery = (schoolId, isSuperAdmin) => {
  return async (sql, params = []) => {
    // Skip if super admin
    if (isSuperAdmin) {
      return originalQuery(sql, params);
    }
    
    // Check if this is a SELECT on a school table
    const lowerSql = sql.toLowerCase();
    const isSelect = lowerSql.includes('select');
    const isInsert = lowerSql.includes('insert');
    const isUpdate = lowerSql.includes('update');
    const isDelete = lowerSql.includes('delete');
    
    // Find which table is being queried
    let tableName = null;
    for (const table of SCHOOL_TABLES) {
      // Match FROM table, JOIN table, INTO table, UPDATE table
      const patterns = [
        new RegExp(`\\bfrom\\s+${table}\\b`, 'i'),
        new RegExp(`\\bjoin\\s+${table}\\b`, 'i'),
        new RegExp(`\\binto\\s+${table}\\b`, 'i'),
        new RegExp(`\\bupdate\\s+${table}\\b`, 'i')
      ];
      
      if (patterns.some(p => p.test(sql))) {
        tableName = table;
        break;
      }
    }
    
    // If no school table or already has school_id filter, run as-is
    if (!tableName || lowerSql.includes('school_id')) {
      return originalQuery(sql, params);
    }
    
    // For SELECT queries on school tables, add school filter
    if (isSelect) {
      // Simple case: SELECT ... FROM table
      if (lowerSql.includes(`from ${tableName}`) && !lowerSql.includes('join')) {
        const modifiedSql = sql.replace(
          new RegExp(`(from\\s+${tableName})`, 'i'),
          `$1 WHERE school_id = $${params.length + 1}`
        );
        console.log(`🔐 [AutoFilter] Modified: ${sql.substring(0, 50)}...`);
        return originalQuery(modifiedSql, [...params, schoolId]);
      }
      
      // Complex case: Add school filter to main table
      // For now, just log warning - these need manual fixing
      console.log(`⚠️  [AutoFilter] Complex query needs manual school filter: ${sql.substring(0, 100)}`);
    }
    
    // For INSERT, ensure school_id is set
    if (isInsert && tableName) {
      // If INSERT doesn't include school_id, add it
      if (!lowerSql.includes('school_id')) {
        console.log(`⚠️  [AutoFilter] INSERT missing school_id: ${sql.substring(0, 100)}`);
      }
    }
    
    return originalQuery(sql, params);
  };
};

module.exports = {
  autoSchoolFilter,
  createFilteredQuery,
  SCHOOL_TABLES
};
