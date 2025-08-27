const Tenant = require('../models/Tenant');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Tenant Controller
 * Handles tenant creation, management, and CRUD operations
 */
class TenantController {
  /**
   * Create a new tenant
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createTenant(req, res) {
    try {
      const {
        tenantId,
        name,
        displayName,
        description,
        contactEmail,
        contactPhone,
        settings,
        subscriptionPlan
      } = req.body;

      // Validate required fields
      if (!tenantId || !name || !displayName) {
        return errorResponse(res, 'Tenant ID, name, and display name are required', 400);
      }

      // Check if tenant already exists
      const existingTenant = await Tenant.findOne({ tenantId });
      if (existingTenant) {
        return errorResponse(res, 'Tenant with this ID already exists', 400);
      }

      // Create tenant with default values
      const tenantData = {
        tenantId,
        name,
        displayName,
        description: description || '',
        contactEmail: contactEmail || '',
        contactPhone: contactPhone || '',
        settings: {
          maxUsers: 100,
          maxSchemas: 50,
          maxStorageGB: 10,
          features: {
            auditTrail: true,
            changeStreams: true,
            offlineSync: true,
            apiRateLimit: true
          },
          ...settings
        },
        subscriptionPlan: subscriptionPlan || 'trial',
        isActive: true,
        isTrial: true,
        trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days trial
      };

      const tenant = new Tenant(tenantData);
      await tenant.save();

      successResponse(res, tenant, 'Tenant created successfully', 201);
    } catch (error) {
      errorResponse(res, `Failed to create tenant: ${error.message}`, 400);
    }
  }

  /**
   * Get all tenants (with pagination and filtering)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
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

      // Build filter object
      const filter = {};
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { tenantId: { $regex: search, $options: 'i' } }
        ];
      }
      if (status) filter.isActive = status === 'active';
      if (plan) filter.subscriptionPlan = plan;

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const tenants = await Tenant.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v');

      // Get total count for pagination
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
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTenantById(req, res) {
    try {
      const { tenantId } = req.params;

      const tenant = await Tenant.findOne({ tenantId }).select('-__v');
      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      successResponse(res, tenant, 'Tenant retrieved successfully');
    } catch (error) {
      errorResponse(res, `Failed to retrieve tenant: ${error.message}`, 500);
    }
  }

  /**
   * Update tenant
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateTenant(req, res) {
    try {
      const { tenantId } = req.params;
      const updateData = req.body;

      // Remove immutable fields
      delete updateData.tenantId;
      delete updateData._id;
      delete updateData.createdAt;

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
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteTenant(req, res) {
    try {
      const { tenantId } = req.params;

      const tenant = await Tenant.findOneAndUpdate(
        { tenantId },
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true }
      ).select('-__v');

      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      successResponse(res, tenant, 'Tenant deactivated successfully');
    } catch (error) {
      errorResponse(res, `Failed to delete tenant: ${error.message}`, 500);
    }
  }

  /**
   * Activate/deactivate tenant
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
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
   * Get tenant statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTenantStats(req, res) {
    try {
      const { tenantId } = req.params;

      const tenant = await Tenant.findOne({ tenantId });
      if (!tenant) {
        return errorResponse(res, 'Tenant not found', 404);
      }

      // Get user count for this tenant
      const User = require('../models/User');
      const userCount = await User.countDocuments({ tenantId, isActive: true });

      // Get schema count for this tenant
      const Schema = require('../models/Schema');
      const schemaCount = await Schema.countDocuments({ tenantId, isActive: true });

      const stats = {
        tenantId: tenant.tenantId,
        name: tenant.name,
        displayName: tenant.displayName,
        subscriptionPlan: tenant.subscriptionPlan,
        isActive: tenant.isActive,
        usage: {
          userCount,
          schemaCount,
          storageUsedGB: tenant.usage?.storageUsedGB || 0,
          maxUsers: tenant.settings?.maxUsers || 100,
          maxSchemas: tenant.settings?.maxSchemas || 50,
          maxStorageGB: tenant.settings?.maxStorageGB || 10
        },
        limits: {
          userLimitReached: userCount >= (tenant.settings?.maxUsers || 100),
          schemaLimitReached: schemaCount >= (tenant.settings?.maxSchemas || 50),
          storageLimitReached: (tenant.usage?.storageUsedGB || 0) >= (tenant.settings?.maxStorageGB || 10)
        }
      };

      successResponse(res, stats, 'Tenant statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, `Failed to get tenant statistics: ${error.message}`, 500);
    }
  }

  /**
   * Get all tenants summary (for dropdowns, etc.)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
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
