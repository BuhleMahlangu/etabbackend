/**
 * School-Aware Query Builder
 * Automatically adds school_id filters to all queries
 * 
 * Usage:
 *   const subjects = await SchoolQuery('subjects', schoolId)
 *     .where('phase', 'FET')
 *     .orderBy('name')
 *     .get();
 */

const db = require('../config/database');

class SchoolQuery {
  constructor(tableName, schoolId, isSuperAdmin = false) {
    this.tableName = tableName;
    this.schoolId = schoolId;
    this.isSuperAdmin = isSuperAdmin;
    this.conditions = [];
    this.params = [];
    this.orderColumn = null;
    this.orderDirection = 'ASC';
    this.limitValue = null;
    this.selectColumns = ['*'];
  }
  
  // Static factory - requires school context
  static table(tableName, schoolId, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) {
      throw new Error(`SchoolQuery('${tableName}'): schoolId required`);
    }
    return new SchoolQuery(tableName, schoolId, isSuperAdmin);
  }
  
  // Add WHERE condition
  where(column, operator, value) {
    if (value === undefined) {
      value = operator;
      operator = '=';
    }
    this.conditions.push({ column, operator, value });
    this.params.push(value);
    return this;
  }
  
  // Select columns
  select(columns) {
    this.selectColumns = Array.isArray(columns) ? columns : [columns];
    return this;
  }
  
  // Order by
  orderBy(column, direction = 'ASC') {
    this.orderColumn = column;
    this.orderDirection = direction;
    return this;
  }
  
  // Limit
  limit(n) {
    this.limitValue = n;
    return this;
  }
  
  // Build and execute
  async get() {
    const { sql, params } = this._buildQuery();
    const result = await db.query(sql, params);
    return result.rows;
  }
  
  // Get first
  async first() {
    this.limit(1);
    const results = await this.get();
    return results[0] || null;
  }
  
  // Count
  async count() {
    this.selectColumns = ['COUNT(*) as count'];
    const result = await this.first();
    return parseInt(result?.count || 0);
  }
  
  // Build SQL
  _buildQuery() {
    let sql = `SELECT ${this.selectColumns.join(', ')} FROM ${this.tableName}`;
    let whereClause = '';
    const params = [...this.params];
    
    // Add school filter (unless super admin)
    if (!this.isSuperAdmin && this.schoolId) {
      whereClause = `school_id = $${params.length + 1}`;
      params.push(this.schoolId);
    }
    
    // Add other conditions
    if (this.conditions.length > 0) {
      const conditionSql = this.conditions.map((cond, idx) => {
        const paramIndex = params.length - this.conditions.length + idx + 1;
        return `${cond.column} ${cond.operator} $${paramIndex}`;
      }).join(' AND ');
      
      whereClause = whereClause 
        ? `${whereClause} AND ${conditionSql}`
        : conditionSql;
    }
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    if (this.orderColumn) {
      sql += ` ORDER BY ${this.orderColumn} ${this.orderDirection}`;
    }
    
    if (this.limitValue) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(this.limitValue);
    }
    
    return { sql, params };
  }
  
  // Debug
  toSql() {
    return this._buildQuery();
  }
}

/**
 * Quick helper for simple school-filtered queries
 */
const getBySchool = async (tableName, schoolId, options = {}) => {
  const { where = {}, orderBy, limit, isSuperAdmin = false } = options;
  
  let query = SchoolQuery.table(tableName, schoolId, isSuperAdmin);
  
  Object.entries(where).forEach(([col, val]) => {
    query = query.where(col, val);
  });
  
  if (orderBy) query = query.orderBy(orderBy);
  if (limit) query = query.limit(limit);
  
  return query.get();
};

module.exports = {
  SchoolQuery,
  getBySchool
};
