const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

class AuthService {
  /**
   * Generate JWT token for user
   * @param {Object} user - User object
   * @returns {string} - JWT token
   */
  generateToken(user) {
    const payload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      permissions: user.getEffectivePermissions()
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'toolvio-backend',
      audience: 'toolvio-app'
    });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} - Decoded token payload
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'toolvio-backend',
        audience: 'toolvio-app'
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Authenticate user with username/email and password
   * @param {string} identifier - Username or email
   * @param {string} password - Password
   * @param {string} tenantId - Tenant ID
   * @returns {Object} - User object and token
   */
  async authenticateUser(identifier, password, tenantId) {
    // Find user by username or email within tenant
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ],
      tenantId: tenantId,
      isActive: true
    });

    if (!user) {
      throw new Error('Invalid credentials or user not found');
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new Error('Account is temporarily locked due to multiple failed login attempts');
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      // Increment login attempts
      await user.incLoginAttempts();
      throw new Error('Invalid credentials');
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Generate token
    const token = this.generateToken(user);

    return {
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
  }

  /**
   * Refresh user token
   * @param {string} token - Current JWT token
   * @returns {Object} - New token and user info
   */
  async refreshToken(token) {
    const decoded = this.verifyToken(token);
    
    // Get fresh user data
    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Generate new token
    const newToken = this.generateToken(user);

    return {
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
      token: newToken
    };
  }

  /**
   * Create new user
   * @param {Object} userData - User data
   * @param {string} creatorTenantId - Tenant ID of creator
   * @returns {Object} - Created user
   */
  async createUser(userData, creatorTenantId) {
    // Check if creator can create users in this tenant
    if (userData.tenantId !== creatorTenantId) {
      throw new Error('Cannot create users in different tenant');
    }

    // Check tenant limits
    const tenant = await Tenant.findOne({ tenantId: userData.tenantId });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    if (!tenant.canCreateUser()) {
      throw new Error('Tenant user limit reached');
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Update tenant usage
    await tenant.updateUsage({ userCount: tenant.usage.userCount + 1 });

    return user;
  }

  /**
   * Update user
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @param {string} updaterTenantId - Tenant ID of updater
   * @returns {Object} - Updated user
   */
  async updateUser(userId, updateData, updaterTenantId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check tenant access
    if (user.tenantId !== updaterTenantId) {
      throw new Error('Cannot update users in different tenant');
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    return updatedUser;
  }

  /**
   * Delete user
   * @param {string} userId - User ID
   * @param {string} deleterTenantId - Tenant ID of deleter
   * @returns {boolean} - Success status
   */
  async deleteUser(userId, deleterTenantId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check tenant access
    if (user.tenantId !== deleterTenantId) {
      throw new Error('Cannot delete users in different tenant');
    }

    // Soft delete (mark as inactive)
    await User.findByIdAndUpdate(userId, { isActive: false });

    // Update tenant usage
    const tenant = await Tenant.findOne({ tenantId: deleterTenantId });
    if (tenant) {
      await tenant.updateUsage({ userCount: Math.max(0, tenant.usage.userCount - 1) });
    }

    return true;
  }

  /**
   * Get users by tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Query filters
   * @returns {Array} - Array of users
   */
  async getUsersByTenant(tenantId, filters = {}) {
    const query = { tenantId, ...filters };
    
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.role) {
      query.role = filters.role;
    }

    return await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} - Success status
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return true;
  }

  /**
   * Reset user password (admin function)
   * @param {string} userId - User ID
   * @param {string} newPassword - New password
   * @param {string} adminTenantId - Admin tenant ID
   * @returns {boolean} - Success status
   */
  async resetPassword(userId, newPassword, adminTenantId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check tenant access
    if (user.tenantId !== adminTenantId) {
      throw new Error('Cannot reset password for users in different tenant');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return true;
  }
}

module.exports = new AuthService();
