const mongoose = require('mongoose');
const SchemaService = require('../services/SchemaService');
const CollectionGenerator = require('../services/CollectionGenerator');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * System Controller
 * Handles system-wide operations and health checks
 */
class SystemController {
  /**
   * Health check endpoint
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async healthCheck(req, res) {
    try {
      const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Craftsman Dynamic Backend',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
          status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          host: mongoose.connection.host || 'unknown',
          name: mongoose.connection.name || 'unknown'
        }
      };

      const statusCode = health.database.status === 'connected' ? 200 : 503;
      successResponse(res, health, 'Health check completed', statusCode);
    } catch (error) {
      errorResponse(res, 'Health check failed', 500);
    }
  }

  /**
   * Get system information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSystemInfo(req, res) {
    try {
      const systemInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory: {
          total: process.memoryUsage().heapTotal,
          used: process.memoryUsage().heapUsed,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss
        },
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid,
        title: process.title,
        argv: process.argv,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT
        }
      };

      successResponse(res, systemInfo, 'System information retrieved successfully');
    } catch (error) {
      errorResponse(res, 'Failed to get system information', 500);
    }
  }

  /**
   * Get database statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDatabaseStats(req, res) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return errorResponse(res, 'Database not connected', 503);
      }

      const db = mongoose.connection.db;
      const adminDb = db.admin();

      // Get database stats
      const dbStats = await db.stats();
      
      // Get collection list
      const collections = await db.listCollections().toArray();
      
      // Get active schemas count
      const activeSchemas = await SchemaService.getAllSchemas({ active: true });
      
      // Get dynamic models info
      const dynamicModels = CollectionGenerator.dynamicModels;
      const modelStats = Array.from(dynamicModels.entries()).map(([name, model]) => ({
        name,
        collectionName: model.collection.name,
        documentCount: 0 // This would need to be calculated asynchronously
      }));

      const stats = {
        database: {
          name: dbStats.db,
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          indexSize: dbStats.indexSize
        },
        collections: collections.length,
        schemas: {
          total: activeSchemas.length,
          active: activeSchemas.length
        },
        dynamicModels: {
          count: dynamicModels.size,
          models: modelStats
        },
        connection: {
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
          readyState: mongoose.connection.readyState
        }
      };

      successResponse(res, stats, 'Database statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, `Failed to get database stats: ${error.message}`, 500);
    }
  }

  /**
   * Get API statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getApiStats(req, res) {
    try {
      const stats = {
        endpoints: {
          schemas: {
            base: '/api/schemas',
            operations: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
          },
          data: {
            base: '/api/data',
            operations: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
          },
          system: {
            base: '/health',
            operations: ['GET']
          }
        },
        features: [
          'Dynamic schema creation',
          'JSON Schema validation',
          'Dynamic CRUD operations',
          'Hot schema reloading',
          'Bulk operations',
          'Search and filtering',
          'Pagination',
          'Error handling'
        ],
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
      };

      successResponse(res, stats, 'API statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, 'Failed to get API statistics', 500);
    }
  }

  /**
   * Initialize system (load existing schemas)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async initializeSystem(req, res) {
    try {
      // Initialize dynamic models for existing schemas
      await SchemaService.initializeDynamicModels();
      
      successResponse(res, { message: 'System initialized successfully' }, 'System initialization completed');
    } catch (error) {
      errorResponse(res, `System initialization failed: ${error.message}`, 500);
    }
  }

  /**
   * Get system logs (basic implementation)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSystemLogs(req, res) {
    try {
      const { level = 'info', limit = 100 } = req.query;
      
      // This is a basic implementation - in production you'd want a proper logging system
      const logs = {
        message: 'Log retrieval not implemented in this version',
        level,
        limit: parseInt(limit),
        timestamp: new Date().toISOString()
      };

      successResponse(res, logs, 'System logs retrieved successfully');
    } catch (error) {
      errorResponse(res, 'Failed to get system logs', 500);
    }
  }
}

module.exports = new SystemController();
