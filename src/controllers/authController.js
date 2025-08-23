const AuthService = require('../services/AuthService');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Authentication Controller
 * Handles user authentication, registration, and token management
 */
class AuthController {
  /**
   * User login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    try {
      const { identifier, password, tenantId } = req.body;

      // Validate required fields
      if (!identifier || !password || !tenantId) {
        return errorResponse(res, 'Username/email, password, and tenant ID are required', 400);
      }

      // Authenticate user
      const result = await AuthService.authenticateUser(identifier, password, tenantId);
      
      successResponse(res, result, 'Login successful');
    } catch (error) {
      errorResponse(res, error.message, 401);
    }
  }

  /**
   * User registration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async register(req, res) {
    try {
      const { username, email, password, firstName, lastName, role, tenantId } = req.body;

      // Validate required fields
      if (!username || !email || !password || !firstName || !lastName || !tenantId) {
        return errorResponse(res, 'All fields are required', 400);
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
