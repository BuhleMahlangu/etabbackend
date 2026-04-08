/**
 * Tenant-Aware Query Builder
 * Simplifies database queries by automatically handling school filtering
 * 
 * Usage:
 *   const subjects = await TenantQueryBuilder('subjects')
 *     .where('is_active', true)
 *     .where('phase', 'FET')
 *     .orderBy('name')
 *     .get();
 */

const db = require('../config/database');
const { TenantContext } = require('../config/tenant');

class TenantQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.conditions = [];
    this.params = [];
    this.orderColumn = null;
    this.orderDirection = 'ASC';
    this.limitValue = null;
    this.offsetValue = null;
    this.selectColumns = ['*'];
  }
  
  // Static factory method
  static table(tableName) {
    return new TenantQueryBuilder(tableName);
  }
  
  // Add WHERE condition
  where(column, operator, value) {
    // Handle 2-arg version: where('column', value)
    if (value === undefined) {
      value = operator;
      operator = '=';
    }
    
    this.conditions.push({ column, operator, value });
    this.params.push(value);
    return this;
  }
  
  // Add WHERE IN condition
  whereIn(column, values) {
    const placeholders = values.map((_, i) => `$${this.params.length + i + 1}`).join(',');
    this.conditions.push({ 
      column, 
      operator: 'IN', 
      value: values,
      raw: `${column} IN (${placeholders})`
    });
    this.params.push(...values);
    return this;
  }
  
  // Select specific columns
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
  
  // Offset
  offset(n) {
    this.offsetValue = n;
    return this;
  }
  
  // Build and execute query
  async get() {
    const { sql, params } = this.buildQuery();
    const result = await db.query(sql, params);
    return result.rows;
  }
  
  // Get first result
  async first() {
    this.limit(1);
    const results = await this.get();
    return results[0] || null;
  }
  
  // Get count
  async count() {
    this.selectColumns = ['COUNT(*) as count'];
    const result = await this.first();
    return parseInt(result?.count || 0);
  }
  
  // Build the SQL query
  buildQuery() {
    // Get tenant context (school_id)
    const tenant = TenantContext.getCurrent();
    const schoolId = tenant?.schoolId;
    
    // Start building SQL
    let sql = `SELECT ${this.selectColumns.join(', ')} FROM ${this.tableName}`;
    let whereClause = '';
    const params = [...this.params];
    
    // If RLS is NOT enabled, manually add school filter
    // If RLS IS enabled, this is redundant but harmless
    if (schoolId && !tenant?.isSuperAdmin) {
      whereClause = `school_id = $${params.length + 1}`;
      params.push(schoolId);
    }
    
    // Add other conditions
    if (this.conditions.length > 0) {
      const conditionSql = this.conditions.map((cond, index) => {
        if (cond.raw) return cond.raw;
        return `${cond.column} ${cond.operator} $${params.length - this.conditions.length + index + 1}`;
      }).join(' AND ');
      
      whereClause = whereClause 
        ? `${whereClause} AND ${conditionSql}`
        : conditionSql;
    }
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    // Add ORDER BY
    if (this.orderColumn) {
      sql += ` ORDER BY ${this.orderColumn} ${this.orderDirection}`;
    }
    
    // Add LIMIT
    if (this.limitValue) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(this.limitValue);
    }
    
    // Add OFFSET
    if (this.offsetValue) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(this.offsetValue);
    }
    
    return { sql, params };
  }
  
  // Debug: get the SQL without executing
  toSql() {
    return this.buildQuery();
  }
}

// Convenience function for raw queries with tenant context
const withTenant = async (callback) => {
  const tenant = TenantContext.getCurrent();
  if (!tenant) {
    throw new Error('No tenant context available');
  }
  
  const client = await db.pool.connect();
  try {
    // Set RLS context
    await client.query(`SET LOCAL app.current_school_id = '${tenant.schoolId}'`);
    await client.query(`SET LOCAL app.current_user_role = '${tenant.role}'`);
    
    return await callback(client);
  } finally {
    client.release();
  }
};

module.exports = {
  TenantQueryBuilder,
  withTenant
};
