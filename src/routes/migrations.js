const express = require('express');
const router = express.Router();
const MigrationService = require('../services/MigrationService');
const { authenticate, requireTenantAccess, authorize } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// Apply authentication and tenant access to all routes
router.use(authenticate);
router.use(requireTenantAccess);

// Get migration history
router.get('/:tenant/:schema', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        status
      };

      const history = await MigrationService.getMigrationHistory(tenant, schema, options);

      successResponse(res, history, 'Migration history retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Create new migration
router.post('/:tenant/:schema', 
  authorize('schemas', 'write'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;
      const { fromVersion, toVersion, migrationScript, dryRun = false, estimatedDuration } = req.body;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      // Validate required fields
      if (!fromVersion || !toVersion) {
        return errorResponse(res, 'From version and to version are required', 400);
      }

      const options = {
        dryRun: dryRun === true,
        estimatedDuration: estimatedDuration || null
      };

      const migration = await MigrationService.createMigration(
        tenant,
        schema,
        fromVersion,
        toVersion,
        migrationScript,
        req.user._id,
        options
      );

      successResponse(res, migration, 'Migration created successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Run migration
router.post('/:tenant/:schema/run/:migrationId', 
  authorize('schemas', 'write'),
  async (req, res) => {
    try {
      const { tenant, schema, migrationId } = req.params;
      const { dryRun = false, batchSize = 1000 } = req.body;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const options = {
        dryRun: dryRun === true,
        batchSize: parseInt(batchSize)
      };

      const result = await MigrationService.runMigration(migrationId, options);

      if (result.success) {
        successResponse(res, result, 'Migration completed successfully');
      } else {
        errorResponse(res, result.error, 500);
      }
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Rollback migration
router.post('/:tenant/:schema/rollback/:migrationId', 
  authorize('schemas', 'write'),
  async (req, res) => {
    try {
      const { tenant, schema, migrationId } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const result = await MigrationService.rollbackMigration(migrationId, req.user._id);

      if (result.success) {
        successResponse(res, result, 'Migration rolled back successfully');
      } else {
        errorResponse(res, result.error, 500);
      }
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get migration status
router.get('/:tenant/:schema/status/:migrationId', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema, migrationId } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const status = await MigrationService.getMigrationStatus(migrationId);

      successResponse(res, status, 'Migration status retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Validate migration script
router.post('/:tenant/:schema/validate', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;
      const { script, sampleData } = req.body;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      if (!script) {
        return errorResponse(res, 'Migration script is required', 400);
      }

      if (!sampleData) {
        return errorResponse(res, 'Sample data is required for validation', 400);
      }

      const validation = await MigrationService.validateMigration(script, sampleData);

      if (validation.valid) {
        successResponse(res, validation, 'Migration script is valid');
      } else {
        errorResponse(res, validation.message, 400, validation);
      }
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get pending migrations
router.get('/:tenant/:schema/pending', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const pendingMigrations = await MigrationService.getPendingMigrations(tenant, schema);

      successResponse(res, pendingMigrations, 'Pending migrations retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get running migrations
router.get('/:tenant/:schema/running', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const runningMigrations = await MigrationService.getRunningMigrations(tenant, schema);

      successResponse(res, runningMigrations, 'Running migrations retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get failed migrations
router.get('/:tenant/:schema/failed', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const failedMigrations = await MigrationService.getFailedMigrations(tenant, schema);

      successResponse(res, failedMigrations, 'Failed migrations retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Generate migration script
router.post('/:tenant/:schema/generate-script', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, schema } = req.params;
      const { oldSchema, newSchema } = req.body;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      if (!oldSchema || !newSchema) {
        return errorResponse(res, 'Both old and new schemas are required', 400);
      }

      const script = MigrationService.generateMigrationScript(oldSchema, newSchema);

      successResponse(res, { script }, 'Migration script generated successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

module.exports = router;
