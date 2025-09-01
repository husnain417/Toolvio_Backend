const AuthService = require('../services/AuthService');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const jwt = require('jsonwebtoken'); // Added for registerSuperAdmin

/**
 * Authentication Controller
 * Handles user authentication, registration, and token management
 */
class AuthController {
  /**
   * Register a super admin (production use)
   * Only works if no super admin exists in the system
   */
  async registerSuperAdmin(req, res) {
    try {
      // Check if any super admin already exists
      const existingSuperAdmin = await User.findOne({ 
        $or: [{ role: 'system_admin' }, { isSystemAdmin: true }] 
      });
      
      if (existingSuperAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Super admin already exists in the system',
          code: 'SUPER_ADMIN_EXISTS'
        });
      }

      const { username, email, password, firstName, lastName } = req.body;

      // Validate required fields
      if (!username || !email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required',
          code: 'MISSING_FIELDS'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or username already exists',
          code: 'USER_EXISTS'
        });
      }

      // Create super admin user
      const superAdmin = new User({
        username,
        email,
        password,
        firstName,
        lastName,
        role: 'system_admin',
        isSystemAdmin: true,
        isActive: true,
        permissions: {
          system: {
            manageTenants: true,
            systemMonitoring: true,
            platformConfig: true
          },
          schemas: {
            create: true,
            read: true,
            update: true,
            delete: true,
            versioning: true
          },
          data: {
            create: true,
            read: true,
            update: true,
            delete: true,
            bulk: true
          },
          audit: {
            read: true,
            export: true,
            rollback: true
          },
          users: {
            create: true,
            read: true,
            update: true,
            delete: true,
            roles: true
          },
          tenants: {
            create: true,
            read: true,
            update: true,
            delete: true,
            manage: true
          }
        }
      });

      await superAdmin.save();

      // Create first default tenant
      const defaultTenant = new Tenant({
        tenantId: 'default-platform',
        name: 'Default Platform Tenant',
        displayName: 'Default Platform Tenant',
        domain: 'default-platform',
        description: 'Default platform tenant for system administration',
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          businessType: 'platform'
        },
        isActive: true
      });

      await defaultTenant.save();

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: superAdmin._id, 
          email: superAdmin.email, 
          role: superAdmin.role,
          isSystemAdmin: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'Super admin registered successfully',
        data: {
          user: {
            _id: superAdmin._id,
            username: superAdmin.username,
            email: superAdmin.email,
            firstName: superAdmin.firstName,
            lastName: superAdmin.lastName,
            role: superAdmin.role,
            isSystemAdmin: superAdmin.isSystemAdmin
          },
          tenant: {
            _id: defaultTenant._id,
            name: defaultTenant.name,
            domain: defaultTenant.domain
          },
          token
        }
      });

    } catch (error) {
      console.error('Error registering super admin:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register super admin',
        error: error.message
      });
    }
  }

  /**
   * Bootstrap system (development/testing use)
   * Can work without master key if no super admin exists
   */
  async bootstrap(req, res) {
    try {
      const { email, password, firstName, lastName, masterKey } = req.body;

      // Check if any super admin already exists
      const existingSuperAdmin = await User.findOne({ 
        $or: [{ role: 'system_admin' }, { isSystemAdmin: true }] 
      });
      
      if (existingSuperAdmin) {
        return res.status(400).json({
          success: false,
          message: 'System already bootstrapped. Super admin exists.',
          code: 'ALREADY_BOOTSTRAPPED'
        });
      }

      // In production, allow bootstrap without master key if no super admin exists
      const isProduction = process.env.NODE_ENV === 'production';
      const hasMasterKey = masterKey && masterKey === process.env.SYSTEM_BOOTSTRAP_KEY;
      
      if (isProduction && !hasMasterKey) {
        return res.status(400).json({
          success: false,
          message: 'Master key required for production bootstrap',
          code: 'MASTER_KEY_REQUIRED'
        });
      }

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required',
          code: 'MISSING_FIELDS'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }

      // Create system admin user
      const systemAdmin = new User({
        username: email.split('@')[0], // Generate username from email
        email,
        password,
        firstName,
        lastName,
        role: 'system_admin',
        isSystemAdmin: true,
        isActive: true,
        permissions: {
          system: {
            manageTenants: true,
            systemMonitoring: true,
            platformConfig: true
          },
          schemas: {
            create: true,
            read: true,
            update: true,
            delete: true,
            versioning: true
          },
          data: {
            create: true,
            read: true,
            update: true,
            delete: true,
            bulk: true
          },
          audit: {
            read: true,
            export: true,
            rollback: true
          },
          users: {
            create: true,
            read: true,
            update: true,
            delete: true,
            roles: true
          },
          tenants: {
            create: true,
            read: true,
            update: true,
            delete: true,
            manage: true
          }
        }
      });

      await systemAdmin.save();

      // Create first tenant
      const firstTenant = new Tenant({
        name: 'First Platform Tenant',
        domain: 'first-tenant',
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          businessType: 'platform'
        },
        isActive: true
      });

      await firstTenant.save();

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: systemAdmin._id, 
          email: systemAdmin.email, 
          role: systemAdmin.role,
          isSystemAdmin: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'System bootstrapped successfully',
        data: {
          systemAdmin: {
            _id: systemAdmin._id,
            email: systemAdmin.email,
            role: systemAdmin.role,
            isSystemAdmin: systemAdmin.isSystemAdmin
          },
          firstTenant: {
            _id: firstTenant._id,
            name: firstTenant.name,
            domain: firstTenant.domain
          },
          token,
          tenantsCreated: [firstTenant.domain]
        }
      });

    } catch (error) {
      console.error('Error bootstrapping system:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bootstrap system',
        error: error.message
      });
    }
  }

  /**
   * User login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    try {
      const { identifier, password, tenantId } = req.body;

      // Validate required fields
      if (!identifier || !password) {
        return errorResponse(res, 'Username/email and password are required', 400);
      }

      // For system admin login, tenantId is not required
      if (!tenantId) {
        // Try to find system admin first
        const systemAdmin = await User.findOne({ 
          $or: [{ username: identifier }, { email: identifier }],
          role: 'system_admin'
        });
        
        if (systemAdmin) {
          const isValidPassword = await systemAdmin.comparePassword(password);
          if (isValidPassword) {
            const token = AuthService.generateToken(systemAdmin);
            const result = {
              user: {
                _id: systemAdmin._id,
                username: systemAdmin.username,
                email: systemAdmin.email,
                firstName: systemAdmin.firstName,
                lastName: systemAdmin.lastName,
                role: systemAdmin.role,
                isSystemAdmin: systemAdmin.isSystemAdmin,
                permissions: systemAdmin.getEffectivePermissions()
              },
              token
            };
            return successResponse(res, result, 'System admin login successful');
          }
        }

        // If not system admin, search for regular user across all tenants
        const user = await User.findOne({
          $or: [{ username: identifier }, { email: identifier }],
          isActive: true,
          role: { $ne: 'system_admin' }  // Exclude system admin from this search
        });

        if (!user) {
          return errorResponse(res, 'Invalid credentials', 401);
        }

        // Validate password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
          return errorResponse(res, 'Invalid credentials', 401);
        }

        // Generate token with user's tenant context automatically included
        const token = AuthService.generateToken(user);
        const result = {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,  // Automatically included from user record
            isSystemAdmin: user.isSystemAdmin,
            permissions: user.getEffectivePermissions()
          },
          token
        };
        return successResponse(res, result, 'Login successful');
      }

      // Legacy support: If tenantId is provided, use the old method
      // This maintains backward compatibility
      const result = await AuthService.authenticateUser(identifier, password, tenantId);
      successResponse(res, result, 'Login successful');
    } catch (error) {
      errorResponse(res, error.message, 401);
    }
  }

  /**
   * User registration - restricted to customer and technician roles only
   */
  async register(req, res) {
    try {
      const { username, email, password, firstName, lastName, role, tenantId } = req.body;

      // Validate required fields
      if (!username || !email || !password || !firstName || !lastName || !tenantId) {
        return errorResponse(res, 'All fields are required', 400);
      }

      // Role validation - restrict self-registration to basic roles only
      const allowedSelfRegistrationRoles = ['customer', 'technician'];
      if (!allowedSelfRegistrationRoles.includes(role)) {
        return errorResponse(res, 'Self-registration limited to customer and technician roles only. Contact your administrator for other roles.', 400);
      }

      // Check if tenant exists and is active
      const tenant = await Tenant.findOne({ tenantId, isActive: true });
      if (!tenant) {
        return errorResponse(res, 'Invalid or inactive tenant', 400);
      }

      // Check if username already exists in tenant
      const existingUser = await User.findOne({ 
        $or: [{ username }, { email }],
        tenantId 
      });
      
      if (existingUser) {
        return errorResponse(res, 'Username or email already exists in this tenant', 400);
      }

      // Check if tenant can create more users
      if (!tenant.canCreateUser()) {
        return errorResponse(res, 'User limit reached for this tenant', 403);
      }

      // Create user
      const userData = {
        username,
        email,
        password,
        firstName,
        lastName,
        role: role || 'customer',
        tenantId
      };

      const user = await AuthService.createUser(userData, tenantId);
      
      // Update tenant usage count
      await tenant.updateUsage({ userCount: tenant.usage.userCount + 1 });
      
      // Generate token for new user
      const token = AuthService.generateToken(user);
      
      const result = {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          permissions: user.getEffectivePermissions()
        },
        token
      };

      successResponse(res, result, 'User registered successfully', 201);
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Create office user - admin only endpoint
   */
  async createOfficeUser(req, res) {
    try {
      const { username, email, password, firstName, lastName } = req.body;
      const tenantId = req.user.tenantId; // Get tenantId from authenticated admin user

      // Validate required fields
      if (!username || !email || !password || !firstName || !lastName) {
        return errorResponse(res, 'All fields are required', 400);
      }

      // Check if tenant exists and is active
      const tenant = await Tenant.findOne({ tenantId, isActive: true });
      if (!tenant) {
        return errorResponse(res, 'Invalid or inactive tenant', 400);
      }

      // Check if tenant can create more users
      if (!tenant.canCreateUser()) {
        return errorResponse(res, 'User limit reached for this tenant', 403);
      }

      // Check if username already exists in tenant
      const existingUser = await User.findOne({ 
        $or: [{ username }, { email }],
        tenantId 
      });
      
      if (existingUser) {
        return errorResponse(res, 'Username or email already exists in this tenant', 400);
      }

      // Create office user (fixed role)
      const userData = {
        username,
        email,
        password,
        firstName,
        lastName,
        role: 'office', // Fixed role for admin creation
        tenantId
      };

      const user = await AuthService.createUser(userData, tenantId);
      
      // Update tenant usage count
      await tenant.updateUsage({ userCount: tenant.usage.userCount + 1 });
      
      const result = {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          permissions: user.getEffectivePermissions()
        }
      };

      successResponse(res, result, 'Office user created successfully', 201);
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Refresh token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async refreshToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return errorResponse(res, 'Token is required', 400);
      }

      const result = await AuthService.refreshToken(token);
      successResponse(res, result, 'Token refreshed successfully');
    } catch (error) {
      errorResponse(res, error.message, 401);
    }
  }

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id).select('-password');
      
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const profile = {
        _id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        permissions: user.getEffectivePermissions(),
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      };

      successResponse(res, profile, 'Profile retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Update user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateProfile(req, res) {
    try {
      const { firstName, lastName, email } = req.body;
      
      const updateData = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (email) updateData.email = email;

      if (Object.keys(updateData).length === 0) {
        return errorResponse(res, 'No fields to update', 400);
      }

      const updatedUser = await AuthService.updateUser(
        req.user._id, 
        updateData, 
        req.user.tenantId
      );

      const profile = {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        tenantId: updatedUser.tenantId,
        permissions: updatedUser.getEffectivePermissions()
      };

      successResponse(res, profile, 'Profile updated successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Change password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return errorResponse(res, 'Current password and new password are required', 400);
      }

      if (newPassword.length < 8) {
        return errorResponse(res, 'New password must be at least 8 characters long', 400);
      }

      await AuthService.changePassword(req.user._id, currentPassword, newPassword);
      
      successResponse(res, null, 'Password changed successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Logout (client-side token removal)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async logout(req, res) {
    try {
      // In a stateless JWT system, logout is handled client-side
      // But we can log the logout event for audit purposes
      successResponse(res, null, 'Logout successful');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get tenant information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTenantInfo(req, res) {
    try {
      const tenant = await Tenant.findOne({ tenantId: req.user.tenantId });
      
      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      const tenantInfo = {
        _id: tenant._id,
        tenantId: tenant.tenantId,
        name: tenant.name,
        displayName: tenant.displayName,
        description: tenant.description,
        contactEmail: tenant.contactEmail,
        contactPhone: tenant.contactPhone,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
        settings: tenant.settings,
        usage: tenant.usage,
        createdAt: tenant.createdAt
      };

      successResponse(res, tenantInfo, 'Tenant information retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Validate token (for client-side validation)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async validateToken(req, res) {
    try {
      // Token is already validated by auth middleware
      // Just return user info
      const userInfo = {
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        tenantId: req.user.tenantId,
        permissions: req.user.permissions
      };

      successResponse(res, userInfo, 'Token is valid');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }
}

module.exports = new AuthController();
