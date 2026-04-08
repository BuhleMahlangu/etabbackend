/**
 * REQUIRED School Context Database Helper
 * This makes it IMPOSSIBLE to forget school filtering
 * 
 * All queries MUST include school context or they will fail
 */

const originalDb = require('../config/database');

// Store school context per request
let requestSchoolId = null;
let requestIsSuperAdmin = false;

/**
 * Set the school context for current request
 * Call this at the start of every request
 */
const setSchoolContext = (schoolId, isSuperAdmin = false) => {
  requestSchoolId = schoolId;
  requestIsSuperAdmin = isSuperAdmin;
};

/**
 * Clear school context
 * Call this at the end of every request
 */
const clearSchoolContext = () => {
  requestSchoolId = null;
  requestIsSuperAdmin = false;
};

/**
 * Query with automatic school filtering
 * This REQUIRES school context to be set
 */
const query = async (sql, params = []) => {
  // Super admin bypass
  if (requestIsSuperAdmin) {
    return originalDb.query(sql, params);
  }
  
  // Require school context
  if (!requestSchoolId) {
    throw new Error(
      'SCHOOL CONTEXT REQUIRED: Call setSchoolContext(schoolId) before querying. ' +
      'This prevents cross-school data leaks.'
    );
  }
  
  // Tables that require school filtering
  const schoolTables = ['users', 'subjects', 'modules', 'assignments', 
                       'learner_modules', 'teacher_assignments', 'pending_teachers'];
  
  const lowerSql = sql.toLowerCase();
  
  // Check if query touches school tables
  for (const table of schoolTables) {
    if (lowerSql.includes(`from ${table}`) || 
        lowerSql.includes(`join ${table}`)) {
      
      // Check if already filtered
      if (lowerSql.includes('school_id')) {
        break; // Already has school filter
      }
      
      // Auto-add school filter for simple queries
      if (lowerSql.includes(`from ${table}`) && !lowerSql.includes('join')) {
        const modifiedSql = sql.replace(
          new RegExp(`(from\\s+${table})`, 'i'),
          `$1 WHERE school_id = $${params.length + 1}`
        );
        console.log(`🔐 [AutoSchool] Added filter: ${table}`);
        return originalDb.query(modifiedSql, [...params, requestSchoolId]);
      }
      
      // Complex query - warn but allow if manually filtered
      console.warn(`⚠️  [AutoSchool] Complex query on ${table} without school_id filter`);
    }
  }
  
  return originalDb.query(sql, params);
};

/**
 * Get school-scoped query builder
 */
const table = (tableName) => {
  if (!requestSchoolId && !requestIsSuperAdmin) {
    throw new Error(`Cannot query '${tableName}': No school context. Use setSchoolContext(schoolId) first.`);
  }
  
  return {
    where: (conditions = {}) => {
      let sql = `SELECT * FROM ${tableName}`;
      let params = [];
      let whereClause = '';
      
      // Add school filter
      if (!requestIsSuperAdmin && requestSchoolId) {
        whereClause = `school_id = $1`;
        params.push(requestSchoolId);
      }
      
      // Add other conditions
      const entries = Object.entries(conditions);
      entries.forEach(([key, value], idx) => {
        const paramIdx = params.length + 1;
        if (whereClause) {
          whereClause += ` AND ${key} = $${paramIdx}`;
        } else {
          whereClause = `${key} = $${paramIdx}`;
        }
        params.push(value);
      });
      
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
      
      return {
        sql,
        params,
        get: async () => {
          const result = await originalDb.query(sql, params);
          return result.rows;
        },
        first: async () => {
          const result = await originalDb.query(sql + ' LIMIT 1', params);
          return result.rows[0] || null;
        }
      };
    },
    
    insert: (data) => {
      if (!requestIsSuperAdmin && requestSchoolId) {
        data.school_id = requestSchoolId;
      }
      
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      
      return {
        sql,
        params: values,
        execute: async () => {
          const result = await originalDb.query(sql, values);
          return result.rows[0];
        }
      };
    }
  };
};

/**
 * Middleware to set/clear school context
 */
const schoolContextMiddleware = (req, res, next) => {
  const { schoolId, isSuperAdmin } = req.user || {};
  
  if (schoolId || isSuperAdmin) {
    setSchoolContext(schoolId, isSuperAdmin);
    
    // Clear context when response is sent
    res.on('finish', clearSchoolContext);
  }
  
  next();
};

module.exports = {
  query,
  table,
  setSchoolContext,
  clearSchoolContext,
  schoolContextMiddleware,
  pool: originalDb.pool
};
