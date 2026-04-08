/**
 * Tenant-aware query wrapper
 * Automatically sets RLS context before executing queries
 */

const db = require('../config/database');

// Store tenant context per request (using AsyncLocalStorage)
const { AsyncLocalStorage } = require('async_hooks');
const tenantStorage = new AsyncLocalStorage();

/**
 * Execute a callback with tenant context set
 * This ensures all queries in the callback use the correct RLS context
 */
const withTenantContext = async (schoolId, isSuperAdmin, callback) => {
  return tenantStorage.run({ schoolId, isSuperAdmin }, async () => {
    const client = await db.pool.connect();
    try {
      // Set RLS context for this connection
      if (schoolId) {
        await client.query(`SET LOCAL app.current_school_id = '${schoolId}'`);
      }
      await client.query(`SET LOCAL app.is_super_admin = '${isSuperAdmin || false}'`);
      
      // Execute the callback with this client
      return await callback(client);
    } finally {
      client.release();
    }
  });
};

/**
 * Get current tenant from storage
 */
const getCurrentTenant = () => {
  return tenantStorage.getStore();
};

/**
 * Middleware to extract tenant from JWT and set context
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    const { schoolId, isSuperAdmin } = req.user || {};
    
    if (!schoolId && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No school assigned to user'
      });
    }
    
    // Store tenant context for this request
    req.tenant = { schoolId, isSuperAdmin };
    
    next();
  } catch (error) {
    console.error('[Tenant] Middleware error:', error);
    res.status(500).json({ success: false, message: 'Tenant context error' });
  }
};

/**
 * Helper to run queries with tenant context from request
 */
const withRequestTenant = async (req, callback) => {
  const { schoolId, isSuperAdmin } = req.tenant || req.user || {};
  return withTenantContext(schoolId, isSuperAdmin, callback);
};

module.exports = {
  withTenantContext,
  getCurrentTenant,
  tenantMiddleware,
  withRequestTenant,
  tenantStorage
};
