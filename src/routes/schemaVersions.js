const express = require('express');
const router = express.Router();
const SchemaVersionService = require('../services/SchemaVersionService');
const { authenticate, requireTenantAccess, authorize } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// Apply authentication and tenant access to all routes
router.use(authenticate);
router.use(requireTenantAccess);

// Get schema version history
router.get('/:tenant/:schema', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;
      const { page = 1, limit = 20, includeSchema = false } = req.query;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        includeSchema: includeSchema === 'true'
      };

      const history = await SchemaVersionService.getSchemaVersionHistory(
        tenant,
        schema,
        options
      );

      successResponse(res, history, 'Schema version history retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Create new schema version
router.post('/:tenant/:schema', 
  authorize('schemas', 'write'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;
      const { schema: newSchema, changelog, activate = false, migrationScript } = req.body;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      // Validate required fields
      if (!newSchema || !changelog) {
        return errorResponse(res, 'Schema and changelog are required', 400);
      }

      const options = {
        activate: activate === true,
        migrationScript: migrationScript || null
      };

      const schemaVersion = await SchemaVersionService.createSchemaVersion(
        tenant,
        schema,
        newSchema,
        changelog,
        req.user._id,
        options
      );

      successResponse(res, schemaVersion, 'Schema version created successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Activate specific schema version
router.put('/:tenant/:schema/activate/:version', 
  authorize('schemas', 'write'),
  async (req, res) => {
    try {
      const { tenant, schema, version } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const activatedVersion = await SchemaVersionService.activateSchemaVersion(
        tenant,
        schema,
        version
      );

      successResponse(res, activatedVersion, 'Schema version activated successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Compare two schema versions
router.get('/:tenant/:schema/diff/:version1/:version2', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema, version1, version2 } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const comparison = await SchemaVersionService.compareSchemaVersions(
        tenant,
        schema,
        version1,
        version2
      );

      successResponse(res, comparison, 'Schema versions compared successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get current active schema version
router.get('/:tenant/:schema/current', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const activeVersion = await SchemaVersionService.getActiveSchemaVersion(tenant, schema);

      if (!activeVersion) {
        return errorResponse(res, 'No active schema version found', 404);
      }

      successResponse(res, activeVersion, 'Active schema version retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get specific schema version
router.get('/:tenant/:schema/version/:version', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema, version } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const schemaVersion = await SchemaVersionService.getSchemaVersion(tenant, schema, version);

      if (!schemaVersion) {
        return errorResponse(res, 'Schema version not found', 404);
      }

      successResponse(res, schemaVersion, 'Schema version retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Delete schema version (only if not active)
router.delete('/:tenant/:schema/version/:version', 
  authorize('schemas', 'write'),
  async (req, res) => {
    try {
      const { tenant, schema, version } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      await SchemaVersionService.deleteSchemaVersion(tenant, schema, version);

      successResponse(res, { deleted: true }, 'Schema version deleted successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get schema compatibility analysis
router.post('/:tenant/:schema/compatibility', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;
      const { newSchema } = req.body;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      if (!newSchema) {
        return errorResponse(res, 'New schema is required', 400);
      }

      // Get current active version
      const currentVersion = await SchemaVersionService.getActiveSchemaVersion(tenant, schema);
      
      if (!currentVersion) {
        return errorResponse(res, 'No active schema version found for comparison', 404);
      }

      const compatibility = SchemaVersionService.checkSchemaCompatibility(
        currentVersion.schema,
        newSchema
      );

      successResponse(res, compatibility, 'Compatibility analysis completed');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

module.exports = router;
