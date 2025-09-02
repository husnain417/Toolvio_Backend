const Tenant = require('../models/Tenant');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Tenant Controller - Fixed Implementation
 * Handles tenant creation with proper validation and consistency
 */
class TenantController {
  /**
   * Generate a unique tenant ID from tenant name
   * This function should ALWAYS be used for tenant ID generation
   */
  generateTenantId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length
  }

  /**
   * Get default permissions for a role
   */
  getDefaultPermissions(role) {
    const basePermissions = {
      system_admin: {
        system: { manageTenants: true, systemMonitoring: true, platformConfig: true },
        schemas: { read: true, write: true, delete: true, versioning: true },
        data: { read: true, write: true, delete: true, bulk: true },
        audit: { read: true, rollback: true, export: true, admin: true },
        users: { read: true, write: true, delete: true, roles: true },
        jobs: { read: true, create: true, update: true, assign: true, complete: true },
        customers: { read: true, create: true, update: true, delete: true },
        invoices: { read: true, create: true, update: true, approve: true },
        reports: { read: true, create: true, export: true },
        sync: { offline: true, conflict: true, batch: true }
      },
      admin: {
        schemas: { read: true, write: true, delete: true, versioning: true },
        data: { read: true, write: true, delete: true, bulk: true },
        audit: { read: true, rollback: true, export: true, admin: true },
        users: { read: true, write: true, delete: true, roles: true },
        jobs: { read: true, create: true, update: true, assign: true, complete: true },
        customers: { read: true, create: true, update: true, delete: true },
        invoices: { read: true, create: true, update: true, approve: true },
        reports: { read: true, create: true, export: true },
        sync: { offline: true, conflict: true, batch: true }
      },
      office: {
        schemas: { read: true, write: false, delete: false, versioning: false },
        data: { read: true, write: true, delete: true, bulk: true },
        audit: { read: true, rollback: false, export: false },
        users: { read: true, write: false, delete: false, roles: false },
        jobs: { read: true, create: true, update: true, delete: true, assign: true, complete: false },
        customers: { read: true, create: true, update: true, delete: true },
        invoices: { read: true, create: true, update: true, approve: false },
        reports: { read: true, create: true, export: true },
        sync: { offline: false, conflict: false, batch: false }
      },
      technician: {
        schemas: { read: true, write: false, delete: false, versioning: false },
        data: { read: true, write: true, delete: false, bulk: false },
        audit: { read: true, rollback: false, export: false },
        users: { read: false, write: false, delete: false, roles: false },
        jobs: { read: true, create: false, update: true, assign: false, complete: true },
        customers: { read: true, create: false, update: false, delete: false },
        invoices: { read: false, create: false, update: false, approve: false },
        reports: { read: false, create: false, export: false },
        sync: { offline: true, conflict: true, batch: false }
      },
      customer: {
        schemas: { read: false, write: false, delete: false, versioning: false },
        data: { read: true, write: false, delete: false, bulk: false },
        audit: { read: false, rollback: false, export: false },
        users: { read: false, write: false, delete: false, roles: false },
        jobs: { read: true, create: false, update: false, assign: false, complete: false },
        customers: { read: false, create: false, update: false, delete: false },
        invoices: { read: true, create: false, update: false, approve: false },
        reports: { read: false, create: false, export: false },
        sync: { offline: false, conflict: false, batch: false }
      }
    };
    
    return basePermissions[role] || basePermissions.customer;
  }

  /**
   * Create a new tenant with admin user - FIXED VERSION
   */
  async createTenant(req, res) {
    // Start a database transaction for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        // Admin user fields
        username,
        email,
        password,
        firstName,
        lastName,
        
        // Tenant fields (simplified - single format)
        name,
        description,
        contactEmail,
        contactPhone,
        subscriptionPlan = 'trial',
        settings = {}
      } = req.body;

      // Validate required fields
      if (!username || !email || !password || !firstName || !lastName || !name) {
        await session.abortTransaction();
        return errorResponse(res, 'Username, email, password, firstName, lastName, and tenant name are required', 400);
      }

      // Generate consistent tenant ID using the function
      const tenantId = this.generateTenantId(name);
      
      if (!tenantId || tenantId.length < 3) {
        await session.abortTransaction();
        return errorResponse(res, 'Invalid tenant name - must generate valid tenant ID', 400);
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      }).session(session);

      if (existingUser) {
        await session.abortTransaction();
        return errorResponse(res, 'User with this email or username already exists', 400);
      }

      // Check if tenant already exists
      const existingTenant = await Tenant.findOne({ 
        $or: [
          { tenantId },
          { name }
        ]
      }).session(session);
      
      if (existingTenant) {
        await session.abortTransaction();
        return errorResponse(res, 'Tenant with this name already exists', 400);
      }

      // Create tenant data with consistent field mapping
      const tenantData = {
        tenantId,                           // Generated from name
        name,                               // Original name
        displayName: name,                  // Use name as display name
        domain: tenantId,                   // Domain = tenantId for consistency
        description: description || '',
        contactEmail: contactEmail || email,
        contactPhone: contactPhone || '',
        settings: {
          // Default limits based on subscription plan
          maxUsers: subscriptionPlan === 'trial' ? 25 : 
                   subscriptionPlan === 'basic' ? 50 :
                   subscriptionPlan === 'professional' ? 100 : 500,
          maxSchemas: subscriptionPlan === 'trial' ? 10 : 
                     subscriptionPlan === 'basic' ? 25 :
                     subscriptionPlan === 'professional' ? 50 : 200,
          maxStorageGB: subscriptionPlan === 'trial' ? 5 : 
                       subscriptionPlan === 'basic' ? 10 :
                       subscriptionPlan === 'professional' ? 25 : 100,
          features: {
            auditTrail: subscriptionPlan !== 'trial',
            changeStreams: true,
            offlineSync: subscriptionPlan !== 'trial',
            apiRateLimit: true
          },
          ...settings // Override with any provided settings
        },
        subscriptionPlan,
        isActive: true,
        isTrial: subscriptionPlan === 'trial',
        trialExpiresAt: subscriptionPlan === 'trial' ? 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null // 30 days trial
      };

      // Create tenant
      const [tenant] = await Tenant.create([tenantData], { session });
      console.log(`✅ Tenant created: ${tenant.name} (ID: ${tenant.tenantId})`);

      // Create admin user
      const adminUserData = {
        username,
        email,
        password, // Will be hashed by User model pre-save hook
        firstName,
        lastName,
        role: 'admin',
        tenantId: tenant.tenantId, // Use the tenant ID that was just created
        isActive: true,
        permissions: this.getDefaultPermissions('admin'),
        isSystemAdmin: false
      };

      const [adminUser] = await User.create([adminUserData], { session });
      console.log(`✅ Admin user created: ${adminUser.email} for tenant: ${tenant.tenantId}`);

      // Update tenant usage count
      await tenant.updateUsage({ userCount: 1 });

      // Commit transaction - everything succeeded
      await session.commitTransaction();

      // Generate JWT token for the new admin user
      const token = jwt.sign(
        { 
          userId: adminUser._id, 
          email: adminUser.email, 
          role: adminUser.role,
          tenantId: tenant.tenantId,
          isSystemAdmin: false
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Clean response data
      const response = {
        tenant: {
          _id: tenant._id,
          tenantId: tenant.tenantId,
          name: tenant.name,
          displayName: tenant.displayName,
          domain: tenant.domain,
          description: tenant.description,
          contactEmail: tenant.contactEmail,
          contactPhone: tenant.contactPhone,
          settings: tenant.settings,
          subscriptionPlan: tenant.subscriptionPlan,
          isActive: tenant.isActive,
          isTrial: tenant.isTrial,
          trialExpiresAt: tenant.trialExpiresAt,
          createdAt: tenant.createdAt
        },
        adminUser: {
          _id: adminUser._id,
          username: adminUser.username,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          fullName: `${adminUser.firstName} ${adminUser.lastName}`,
          role: adminUser.role,
          tenantId: adminUser.tenantId,
          isActive: adminUser.isActive,
          createdAt: adminUser.createdAt
        },
        token
      };

      successResponse(res, response, 'Tenant and admin user created successfully', 201);

    } catch (error) {
      // Rollback transaction on any error
      await session.abortTransaction();
      console.error('❌ Error creating tenant and admin user:', error);
      errorResponse(res, `Failed to create tenant: ${error.message}`, 400);
    } finally {
      // Always end the session
      session.endSession();
    }
  }

  /**
   * Get all tenants with filtering and pagination
   */
  async getAllTenants(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        plan,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter
      const filter = {};
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { tenantId: { $regex: search, $options: 'i' } },
          { contactEmail: { $regex: search, $options: 'i' } }
        ];
      }
      if (status === 'active') filter.isActive = true;
      if (status === 'inactive') filter.isActive = false;
      if (plan) filter.subscriptionPlan = plan;

      // Build sort
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const tenants = await Tenant.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v');

      const total = await Tenant.countDocuments(filter);

      const result = {
        tenants,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };

      successResponse(res, result, 'Tenants retrieved successfully');
    } catch (error) {
      errorResponse(res, `Failed to retrieve tenants: ${error.message}`, 500);
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(req, res) {
    try {
      const { tenantId } = req.params;

      const tenant = await Tenant.findOne({ tenantId }).select('-__v');
      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      // Get additional stats
      const userCount = await User.countDocuments({ tenantId, isActive: true });
      
      const tenantWithStats = {
        ...tenant.toObject(),
        currentStats: {
          userCount,
          subscriptionStatus: tenant.subscriptionStatus
        }
      };

      successResponse(res, tenantWithStats, 'Tenant retrieved successfully');
    } catch (error) {
      errorResponse(res, `Failed to retrieve tenant: ${error.message}`, 500);
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(req, res) {
    try {
      const { tenantId } = req.params;
      const updateData = { ...req.body };

      // Remove immutable fields
      delete updateData.tenantId;
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.usage; // Usage should only be updated via updateUsage method

      // If name is being changed, regenerate tenantId and domain
      if (updateData.name) {
        const newTenantId = this.generateTenantId(updateData.name);
        
        // Check if new tenantId conflicts with existing tenant
        const existingTenant = await Tenant.findOne({ 
          tenantId: newTenantId,
          _id: { $ne: await Tenant.findOne({ tenantId })._id }
        });
        
        if (existingTenant) {
          return errorResponse(res, 'Tenant name would create conflicting tenant ID', 400);
        }
        
        updateData.tenantId = newTenantId;
        updateData.domain = newTenantId;
        updateData.displayName = updateData.name;
      }

      const tenant = await Tenant.findOneAndUpdate(
        { tenantId },
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-__v');

      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      successResponse(res, tenant, 'Tenant updated successfully');
    } catch (error) {
      errorResponse(res, `Failed to update tenant: ${error.message}`, 400);
    }
  }

  /**
   * Delete tenant (soft delete)
   */
  async deleteTenant(req, res) {
    try {
      const { tenantId } = req.params;

      // Find and deactivate tenant
      const tenant = await Tenant.findOneAndUpdate(
        { tenantId },
        { 
          $set: { 
            isActive: false, 
            deletedAt: new Date(),
            // Prevent login for all users in this tenant
            'settings.features.apiRateLimit': false
          } 
        },
        { new: true }
      ).select('-__v');

      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      // Also deactivate all users in this tenant
      await User.updateMany(
        { tenantId },
        { $set: { isActive: false } }
      );

      successResponse(res, tenant, 'Tenant and all users deactivated successfully');
    } catch (error) {
      errorResponse(res, `Failed to delete tenant: ${error.message}`, 500);
    }
  }

  /**
   * Activate/deactivate tenant
   */
  async toggleTenantStatus(req, res) {
    try {
      const { tenantId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return errorResponse(res, 'isActive must be a boolean value', 400);
      }

      const tenant = await Tenant.findOneAndUpdate(
        { tenantId },
        { $set: { isActive } },
        { new: true, runValidators: true }
      ).select('-__v');

      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      const status = isActive ? 'activated' : 'deactivated';
      successResponse(res, tenant, `Tenant ${status} successfully`);
    } catch (error) {
      errorResponse(res, `Failed to toggle tenant status: ${error.message}`, 500);
    }
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantStats(req, res) {
    try {
      const { tenantId } = req.params;

      const tenant = await Tenant.findOne({ tenantId });
      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      // Get real-time user count
      const userCount = await User.countDocuments({ tenantId, isActive: true });

      // Get schema count (if Schema model exists)
      let schemaCount = 0;
      try {
        const Schema = require('../models/Schema');
        schemaCount = await Schema.countDocuments({ tenantId, isActive: true });
      } catch (err) {
        console.warn('Schema model not found, setting count to 0');
      }

      const stats = {
        tenantId: tenant.tenantId,
        name: tenant.name,
        displayName: tenant.displayName,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
        isActive: tenant.isActive,
        usage: {
          userCount,
          schemaCount,
          storageUsedGB: tenant.usage?.storageUsedGB || 0,
          apiCallsThisMonth: tenant.usage?.apiCallsThisMonth || 0
        },
        limits: {
          maxUsers: tenant.settings?.maxUsers || 100,
          maxSchemas: tenant.settings?.maxSchemas || 50,
          maxStorageGB: tenant.settings?.maxStorageGB || 10
        },
        availability: {
          canCreateUser: tenant.canCreateUser(),
          canCreateSchema: tenant.canCreateSchema(),
          hasStorageAvailable: tenant.hasStorageAvailable(1)
        },
        features: tenant.settings?.features || {}
      };

      successResponse(res, stats, 'Tenant statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, `Failed to get tenant statistics: ${error.message}`, 500);
    }
  }

  /**
   * Update tenant usage (internal method)
   */
  async updateTenantUsage(tenantId, updates) {
    try {
      const tenant = await Tenant.findOne({ tenantId });
      if (tenant) {
        await tenant.updateUsage(updates);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update tenant usage:', error);
      return false;
    }
  }

  /**
   * Validate tenant feature access
   */
  async validateFeatureAccess(tenantId, feature) {
    try {
      const tenant = await Tenant.findOne({ tenantId, isActive: true });
      if (!tenant) return false;
      
      return tenant.isFeatureEnabled(feature);
    } catch (error) {
      console.error('Failed to validate feature access:', error);
      return false;
    }
  }

  /**
   * Get all tenants summary (for dropdowns, etc.)
   */
  async getTenantsSummary(req, res) {
    try {
      const tenants = await Tenant.find({ isActive: true })
        .select('tenantId name displayName subscriptionPlan')
        .sort({ name: 1 });

      successResponse(res, tenants, 'Tenants summary retrieved successfully');
    } catch (error) {
      errorResponse(res, `Failed to get tenants summary: ${error.message}`, 500);
    }
  }
}

module.exports = new TenantController();