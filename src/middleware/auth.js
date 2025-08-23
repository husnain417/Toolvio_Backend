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

    // Verify tenant is still active
    const tenant = await Tenant.findOne({ tenantId: user.tenantId });
    if (!tenant || !tenant.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tenant is inactive',
        code: 'TENANT_INACTIVE'
      });
    }

    // Set user context
    req.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      permissions: user.getEffectivePermissions()
    };

    // Set tenant context
    req.tenant = {
      _id: tenant._id,
      tenantId: tenant.tenantId,
      name: tenant.name,
      displayName: tenant.displayName,
      settings: tenant.settings,
      subscriptionStatus: tenant.subscriptionStatus
    };

    next();
  } catch (error) {
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
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check specific permission
    if (req.user.permissions[resource] && req.user.permissions[resource][action]) {
      return next();
    }

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
 */
const requireTenantAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Extract tenant ID from request (could be in params, body, or query)
  const requestTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  
  if (requestTenantId && requestTenantId !== req.user.tenantId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to different tenant',
      code: 'TENANT_ACCESS_DENIED',
      userTenant: req.user.tenantId,
      requestTenant: requestTenantId
    });
  }

  next();
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
          permissions: user.getEffectivePermissions()
        };

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
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
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

module.exports = {
  authenticate,
  authorize,
  requireRole,
  requireTenantAccess,
  optionalAuth,
  tenantRateLimit
};
