const AuthService = require('../services/AuthService');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

/**
 * Extract JWT token from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} - JWT token or null
 */
const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  return null;
};

/**
 * Authentication middleware - verifies JWT token and sets user context
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify token
    const decoded = AuthService.verifyToken(token);
    
    // Get fresh user data
    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    // Set user context with JWT data as fallback
    req.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId || decoded.tenantId,  // Use JWT as fallback
      isSystemAdmin: user.isSystemAdmin || user.role === 'system_admin' || decoded.isSystemAdmin,
      permissions: user.getEffectivePermissions()
    };

    console.log('🔍 DEBUG: User context set:', {
      role: req.user.role,
      isSystemAdmin: req.user.isSystemAdmin,
      tenantId: req.user.tenantId
    });

    // For system admin, skip tenant validation
    if (req.user.isSystemAdmin) {
      console.log('✅ DEBUG: System admin detected, skipping tenant validation');
      req.user.isSystemAdmin = true;
      next();
      return;
    }

    // Verify tenant is still active for non-system users
    if (req.user.tenantId) {
      console.log('🔍 DEBUG: Checking tenant for non-system user:', req.user.tenantId);
      const tenant = await Tenant.findOne({ tenantId: req.user.tenantId });
      if (!tenant || !tenant.isActive) {
        console.log('❌ DEBUG: Tenant validation failed:', {
          tenantExists: !!tenant,
          isActive: tenant?.isActive
        });
        return res.status(403).json({
          success: false,
          message: 'Tenant is inactive',
          code: 'TENANT_INACTIVE'
        });
      }

      // Set tenant context
      req.tenant = {
        _id: tenant._id,
        tenantId: tenant.tenantId,
        name: tenant.name,
        displayName: tenant.displayName,
        settings: tenant.settings,
        subscriptionStatus: tenant.subscriptionStatus
      };
    }

    next();
  } catch (error) {
    console.error('❌ DEBUG: Error in authenticate middleware:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'TOKEN_INVALID'
    });
  }
};

/**
 * Authorization middleware - checks if user has required permission
 * @param {string} resource - Resource to check permission for
 * @param {string} action - Action to check permission for
 */
const authorize = (resource, action) => {
  return (req, res, next) => {
    console.log('🔍 DEBUG: authorize START - resource:', resource, 'action:', action);
    
    if (!req.user) {
      console.log('❌ DEBUG: No user in authorize');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // System admin has all permissions
    if (req.user.role === 'system_admin' || req.user.isSystemAdmin) {
      console.log('✅ DEBUG: System admin in authorize, allowing access');
      return next();
    }

    console.log('🔍 DEBUG: authorize - checking permissions:', req.user.permissions[resource]);
    console.log('🔍 DEBUG: authorize - checking specific permission:', req.user.permissions[resource]?.[action]);

    // Check specific permission
    if (req.user.permissions[resource] && req.user.permissions[resource][action]) {
      console.log('✅ DEBUG: authorize - permission granted');
      return next();
    }

    console.log('❌ DEBUG: authorize - permission denied');
    return res.status(403).json({
      success: false,
      message: `Insufficient permissions: ${resource}.${action}`,
      code: 'INSUFFICIENT_PERMISSIONS',
      required: `${resource}.${action}`,
      userRole: req.user.role
    });
  };
};

/**
 * System-level authorization middleware - checks if user has system permission
 * @param {string} action - System action to check permission for
 */
const requireSystemPermission = (action) => {
  return (req, res, next) => {
    console.log('🔍 DEBUG: requireSystemPermission called with action:', action);
    console.log('🔍 DEBUG: User in requireSystemPermission:', {
      role: req.user?.role,
      isSystemAdmin: req.user?.isSystemAdmin,
      permissions: req.user?.permissions
    });

    if (!req.user) {
      console.log('❌ DEBUG: No user in requireSystemPermission');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // System admin has all system permissions
    if (req.user.role === 'system_admin' || req.user.isSystemAdmin) {
      console.log('✅ DEBUG: System admin detected in requireSystemPermission, allowing access');
      return next();
    }

    // Check specific system permission
    if (req.user.permissions.system && req.user.permissions.system[action]) {
      console.log('✅ DEBUG: User has specific system permission:', action);
      return next();
    }

    console.log('❌ DEBUG: User lacks system permission:', action);
    return res.status(403).json({
      success: false,
      message: `Insufficient system permissions: ${action}`,
      code: 'INSUFFICIENT_SYSTEM_PERMISSIONS',
      required: `system.${action}`,
      userRole: req.user.role
    });
  };
};

/**
 * Role-based authorization middleware
 * @param {Array} allowedRoles - Array of allowed roles
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized for this operation`,
        code: 'ROLE_NOT_AUTHORIZED',
        allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Tenant isolation middleware - ensures user can only access their tenant's data
 * System admin can access all tenants
 */
const requireTenantAccess = (req, res, next) => {
  console.log('🔍 DEBUG: requireTenantAccess START');
  
  if (!req.user) {
    console.log('❌ DEBUG: No user in requireTenantAccess');
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // System admin can access all tenants
  if (req.user.role === 'system_admin' || req.user.isSystemAdmin) {
    console.log('✅ DEBUG: System admin in requireTenantAccess, allowing access');
    return next();
  }

  // Extract tenant ID from request (could be in params, body, or query)
  const requestTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  console.log('🔍 DEBUG: requireTenantAccess - requestTenantId:', requestTenantId);
  console.log('🔍 DEBUG: requireTenantAccess - user.tenantId:', req.user.tenantId);
  
  if (requestTenantId && requestTenantId !== req.user.tenantId) {
    console.log('❌ DEBUG: Tenant access denied - different tenant');
    return res.status(403).json({
      success: false,
      message: 'Access denied to different tenant',
      code: 'TENANT_ACCESS_DENIED',
      userTenant: req.user.tenantId,
      requestTenant: requestTenantId
    });
  }

  console.log('✅ DEBUG: requireTenantAccess - calling next()');
  next();
};

/**
 * Tenant management middleware - ensures user can manage the specified tenant
 * System admin can manage all tenants, tenant admin can manage their own
 */
const requireTenantManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // System admin can manage all tenants
  if (req.user.role === 'system_admin' || req.user.isSystemAdmin) {
    return next();
  }

  // Extract tenant ID from request
  const requestTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  
  if (!requestTenantId) {
    return res.status(400).json({
      success: false,
      message: 'Tenant ID is required',
      code: 'TENANT_ID_REQUIRED'
    });
  }

  // Tenant admin can only manage their own tenant
  if (req.user.role === 'admin' && req.user.tenantId === requestTenantId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Insufficient permissions to manage this tenant',
    code: 'TENANT_MANAGEMENT_DENIED',
    userRole: req.user.role,
    userTenant: req.user.tenantId,
    requestTenant: requestTenantId
  });
};

/**
 * Optional authentication middleware - sets user context if token is provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = AuthService.verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = {
          _id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          isSystemAdmin: user.isSystemAdmin || user.role === 'system_admin',
          permissions: user.getEffectivePermissions()
        };

        // Set tenant context for non-system users
        if (user.tenantId && user.role !== 'system_admin' && !user.isSystemAdmin) {
          const tenant = await Tenant.findOne({ tenantId: user.tenantId });
          if (tenant && tenant.isActive) {
            req.tenant = {
              _id: tenant._id,
              tenantId: tenant.tenantId,
              name: tenant.name,
              displayName: tenant.displayName,
              settings: tenant.settings,
              subscriptionStatus: tenant.subscriptionStatus
            };
          }
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Rate limiting middleware based on tenant subscription
 */
const tenantRateLimit = (req, res, next) => {
  if (!req.tenant) {
    return res.status(403).json({
      success: false,
      message: 'Tenant context required',
      code: 'TENANT_CONTEXT_REQUIRED'
    });
  }

  // Check if tenant has exceeded their API call limit
  const currentMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
  const lastUpdateMonth = req.tenant.usage.lastUsageUpdate ? 
    req.tenant.usage.lastUsageUpdate.getFullYear() + '-' + (req.tenant.usage.lastUsageUpdate.getMonth() + 1) : null;

  // Reset counter for new month
  if (lastUpdateMonth !== currentMonth) {
    req.tenant.usage.apiCallsThisMonth = 0;
  }

  // Check limits based on subscription plan
  const limits = {
    trial: 1000,
    basic: 10000,
    professional: 100000,
    enterprise: 1000000
  };

  const limit = limits[req.tenant.subscriptionPlan] || limits.trial;

  if (req.tenant.usage.apiCallsThisMonth >= limit) {
    return res.status(429).json({
      success: false,
      message: 'API rate limit exceeded for this month',
      code: 'RATE_LIMIT_EXCEEDED',
      limit,
      current: req.tenant.usage.apiCallsThisMonth,
      resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    });
  }

  // Increment counter
  req.tenant.usage.apiCallsThisMonth++;
  req.tenant.usage.lastUsageUpdate = new Date();

  next();
};

/**
 * Schema-specific authorization middleware
 * Maps schema names to permission resources and checks appropriate permissions
 * @param {string} action - Action to check permission for
 */
const authorizeSchemaAction = (action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // System admin has all permissions
    if (req.user.role === 'system_admin' || req.user.isSystemAdmin) {
      return next();
    }

    const schemaName = req.params.schemaName;
    
    // Map schema names to permission resources
    const schemaPermissionMap = {
      'customer': 'customers',
      'customers': 'customers',
      'job': 'jobs', 
      'jobs': 'jobs',
      'invoice': 'invoices',
      'invoices': 'invoices',
      'user': 'users',
      'users': 'users'
    };

    const permissionResource = schemaPermissionMap[schemaName];
    
    if (!permissionResource) {
      // For unknown schemas, fall back to generic data permissions
      if (req.user.permissions.data && req.user.permissions.data[action]) {
        return next();
      }
    } else {
      // Check schema-specific permission
      if (req.user.permissions[permissionResource] && req.user.permissions[permissionResource][action]) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: `Insufficient permissions: ${permissionResource || 'data'}.${action}`,
      code: 'INSUFFICIENT_PERMISSIONS',
      required: `${permissionResource || 'data'}.${action}`,
      userRole: req.user.role,
      schemaName
    });
  };
};

module.exports = {
  authenticate,
  authorize,
  requireSystemPermission,
  requireRole,
  requireTenantAccess,
  requireTenantManagement,
  optionalAuth,
  tenantRateLimit,
  authorizeSchemaAction
};
