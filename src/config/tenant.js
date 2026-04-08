/**
 * Tenant Context Management
 * Centralizes multi-tenancy logic
 */

const db = require('./database');
const { AsyncLocalStorage } = require('async_hooks');

// Thread-local storage for current tenant
const tenantStorage = new AsyncLocalStorage();

class TenantContext {
  static getCurrent() {
    return tenantStorage.getStore();
  }
  
  static getSchoolId() {
    const ctx = this.getCurrent();
    return ctx?.schoolId;
  }
  
  static getSchoolCode() {
    const ctx = this.getCurrent();
    return ctx?.schoolCode;
  }
  
  static isSuperAdmin() {
    const ctx = this.getCurrent();
    return ctx?.isSuperAdmin === true;
  }
  
  // Run code within a tenant context
  static async runWithTenant(tenantInfo, callback) {
    return tenantStorage.run(tenantInfo, callback);
  }
  
  // Database query with automatic tenant filtering
  static async query(sql, params = []) {
    const tenant = this.getCurrent();
    
    if (!tenant && !sql.includes('SET app.current_school_id')) {
      throw new Error('No tenant context set for query');
    }
    
    // If using RLS, tenant context is already in the connection
    return db.query(sql, params);
  }
}

// Middleware to extract tenant from JWT and set context
const tenantMiddleware = async (req, res, next) => {
  try {
    const { schoolId, schoolCode, isSuperAdmin, role } = req.user || {};
    
    if (!schoolId && !isSuperAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'No school assigned to user' 
      });
    }
    
    // Set tenant context for this request
    const tenantInfo = {
      schoolId,
      schoolCode,
      isSuperAdmin,
      role,
      userId: req.user?.userId
    };
    
    // For RLS: Set database session variable
    if (schoolId) {
      await db.query(`SET LOCAL app.current_school_id = '${schoolId}'`);
      await db.query(`SET LOCAL app.current_user_role = '${role}'`);
    }
    
    // Run request within tenant context
    await TenantContext.runWithTenant(tenantInfo, async () => {
      next();
    });
    
  } catch (error) {
    console.error('[Tenant] Middleware error:', error);
    res.status(500).json({ success: false, message: 'Tenant context error' });
  }
};

module.exports = {
  TenantContext,
  tenantMiddleware,
  tenantStorage
};
