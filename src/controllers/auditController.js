const AuditService = require('../services/AuditService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Audit Controller
 * Handles all audit trail and rollback operations
 */
class AuditController {
  constructor() {
    // Bind all methods to preserve 'this' context
    this.getDocumentAuditHistory = this.getDocumentAuditHistory.bind(this);
    this.getSchemaAuditHistory = this.getSchemaAuditHistory.bind(this);
    this.getDocumentAtVersion = this.getDocumentAtVersion.bind(this);
    this.revertDocumentToVersion = this.revertDocumentToVersion.bind(this);
    this.getAuditStats = this.getAuditStats.bind(this);
    this.getDocumentVersions = this.getDocumentVersions.bind(this);
    this.compareDocumentVersions = this.compareDocumentVersions.bind(this);
    this.bulkRevertDocuments = this.bulkRevertDocuments.bind(this);
    this.cleanupAuditLogs = this.cleanupAuditLogs.bind(this);
    this.getAuditSummary = this.getAuditSummary.bind(this);
  }

  /**
   * Get audit history for a specific document
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDocumentAuditHistory(req, res) {
    try {
      const { schemaName, recordId } = req.params;
      const { page, limit, operation, startDate, endDate } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        operation,
        startDate,
        endDate
      };

      const result = await AuditService.getAuditHistory(recordId, schemaName, options);
      
      successResponse(res, result, 'Document audit history retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get audit history for all documents of a schema
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSchemaAuditHistory(req, res) {
    try {
      const { schemaName } = req.params;
      const { page, limit, operation, userId, startDate, endDate } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        operation,
        userId,
        startDate,
        endDate
      };

      const result = await AuditService.getSchemaAuditHistory(schemaName, options);
      
      successResponse(res, result, 'Schema audit history retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get document state at a specific version
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDocumentAtVersion(req, res) {
    try {
      const { schemaName, recordId } = req.params;
      const { version } = req.params;

      const versionNum = parseInt(version);
      if (isNaN(versionNum) || versionNum < 1) {
        return errorResponse(res, 'Invalid version number', 400);
      }

      const documentAtVersion = await AuditService.getDocumentAtVersion(
        recordId, 
        schemaName, 
        versionNum
      );

      if (!documentAtVersion) {
        return errorResponse(res, `Version ${versionNum} not found for document`, 404);
      }

      successResponse(res, documentAtVersion, 'Document version retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Revert document to a specific version
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async revertDocumentToVersion(req, res) {
    try {
      const { schemaName, recordId } = req.params;
      const { version } = req.params;
      const { reason } = req.body;

      const versionNum = parseInt(version);
      if (isNaN(versionNum) || versionNum < 1) {
        return errorResponse(res, 'Invalid version number', 400);
      }

      // Get audit context from middleware
      const auditContext = req.auditContext || {};

      const revertOptions = {
        userId: auditContext.userId,
        userAgent: auditContext.userAgent,
        ipAddress: auditContext.ipAddress,
        reason: reason || `Reverted to version ${versionNum}`
      };

      const result = await AuditService.revertToVersion(
        recordId,
        schemaName,
        versionNum,
        revertOptions
      );

      successResponse(res, result, `Document reverted to version ${versionNum} successfully`);
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get audit statistics for a schema
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAuditStats(req, res) {
    try {
      const { schemaName } = req.params;
      const { timeframe } = req.query;

      const options = { timeframe: timeframe || '30d' };
      const stats = await AuditService.getAuditStats(schemaName, options);
      
      successResponse(res, stats, 'Audit statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get all versions for a specific document
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDocumentVersions(req, res) {
    try {
      const { schemaName, recordId } = req.params;
      const { page, limit } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      };

      const result = await AuditService.getAuditHistory(recordId, schemaName, options);
      
      // Transform audit logs to version format
      const versions = result.auditLogs.map(log => ({
        version: log.version,
        operation: log.operation,
        timestamp: log.timestamp,
        userId: log.userId,
        changedFields: log.changedFields,
        canRevert: log.canRevert,
        metadata: log.metadata
      }));

      const response = {
        versions,
        pagination: result.pagination
      };

      successResponse(res, response, 'Document versions retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Compare two versions of a document
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async compareDocumentVersions(req, res) {
    try {
      const { schemaName, recordId } = req.params;
      const { fromVersion, toVersion } = req.query;

      if (!fromVersion || !toVersion) {
        return errorResponse(res, 'Both fromVersion and toVersion are required', 400);
      }

      const fromVersionNum = parseInt(fromVersion);
      const toVersionNum = parseInt(toVersion);

      if (isNaN(fromVersionNum) || isNaN(toVersionNum)) {
        return errorResponse(res, 'Version numbers must be integers', 400);
      }

      // Get both versions
      const fromDoc = await AuditService.getDocumentAtVersion(recordId, schemaName, fromVersionNum);
      const toDoc = await AuditService.getDocumentAtVersion(recordId, schemaName, toVersionNum);

      if (!fromDoc) {
        return errorResponse(res, `Version ${fromVersionNum} not found`, 404);
      }

      if (!toDoc) {
        return errorResponse(res, `Version ${toVersionNum} not found`, 404);
      }

      // Calculate differences
      const differences = this.calculateVersionDifferences(fromDoc.state, toDoc.state);

      const comparison = {
        fromVersion: fromVersionNum,
        toVersion: toVersionNum,
        fromTimestamp: fromDoc.timestamp,
        toTimestamp: toDoc.timestamp,
        differences,
        totalChanges: differences.length
      };

      successResponse(res, comparison, 'Version comparison completed successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Bulk revert multiple documents to their previous versions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async bulkRevertDocuments(req, res) {
    try {
      const { schemaName } = req.params;
      const { documents, reason } = req.body;

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return errorResponse(res, 'Documents array is required and cannot be empty', 400);
      }

      const auditContext = req.auditContext || {};
      const revertOptions = {
        userId: auditContext.userId,
        userAgent: auditContext.userAgent,
        ipAddress: auditContext.ipAddress,
        reason: reason || 'Bulk revert operation'
      };

      const results = [];
      const errors = [];

      // Process each document
      for (const doc of documents) {
        try {
          const { recordId, targetVersion } = doc;
          
          if (!recordId || !targetVersion) {
            errors.push({
              recordId,
              error: 'recordId and targetVersion are required'
            });
            continue;
          }

          const result = await AuditService.revertToVersion(
            recordId,
            schemaName,
            targetVersion,
            revertOptions
          );

          results.push({
            recordId,
            targetVersion,
            success: true,
            newVersion: result.auditLog.version
          });
        } catch (error) {
          errors.push({
            recordId: doc.recordId,
            error: error.message
          });
        }
      }

      const response = {
        successful: results,
        failed: errors,
        totalProcessed: documents.length,
        successCount: results.length,
        errorCount: errors.length
      };

      successResponse(res, response, 'Bulk revert operation completed');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Clean up old audit logs
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async cleanupAuditLogs(req, res) {
    try {
      const { schemaName } = req.params;
      const { olderThan, operation, dryRun } = req.query;

      const options = {
        schemaName,
        olderThan: parseInt(olderThan) || 365, // days
        operation,
        dryRun: dryRun === 'true'
      };

      const result = await AuditService.cleanupOldAuditLogs(options);
      
      const message = options.dryRun 
        ? 'Audit cleanup dry run completed' 
        : 'Audit logs cleaned up successfully';

      successResponse(res, result, message);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get audit summary for dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAuditSummary(req, res) {
    try {
      const { schemaName } = req.params;
      const { timeframe } = req.query;

      // Get basic stats
      const stats = await AuditService.getAuditStats(schemaName, { timeframe });
      
      // Get recent activity (last 10 changes)
      const recentActivity = await AuditService.getSchemaAuditHistory(schemaName, {
        page: 1,
        limit: 10
      });

      const summary = {
        stats,
        recentActivity: recentActivity.auditLogs,
        summary: {
          totalOperations: stats.totalAuditLogs,
          uniqueDocuments: stats.uniqueDocuments,
          mostFrequentOperation: this.getMostFrequentOperation(stats.operations),
          timeframe: timeframe || '30d'
        }
      };

      successResponse(res, summary, 'Audit summary retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Calculate differences between two document states
   * @private
   * @param {Object} fromState - From document state
   * @param {Object} toState - To document state
   * @returns {Array} - Array of differences
   */
  calculateVersionDifferences(fromState, toState) {
    const differences = [];
    const allFields = new Set([
      ...Object.keys(fromState || {}),
      ...Object.keys(toState || {})
    ]);

    for (const field of allFields) {
      // Skip system fields
      if (['_id', '__v', 'createdAt', 'updatedAt', '_schemaName'].includes(field)) {
        continue;
      }

      const fromValue = fromState[field];
      const toValue = toState[field];

      if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
        differences.push({
          field,
          fromValue,
          toValue,
          changeType: this.getChangeType(fromValue, toValue)
        });
      }
    }

    return differences;
  }

  /**
   * Determine the type of change between two values
   * @private
   * @param {*} fromValue - Original value
   * @param {*} toValue - New value
   * @returns {string} - Change type
   */
  getChangeType(fromValue, toValue) {
    if (fromValue === undefined && toValue !== undefined) return 'added';
    if (fromValue !== undefined && toValue === undefined) return 'removed';
    return 'modified';
  }

  /**
   * Get the most frequent operation from stats
   * @private
   * @param {Object} operations - Operations object with counts
   * @returns {string} - Most frequent operation
   */
  getMostFrequentOperation(operations) {
    let maxCount = 0;
    let mostFrequent = 'none';

    for (const [operation, count] of Object.entries(operations)) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = operation;
      }
    }

    return mostFrequent;
  }
}

module.exports = new AuditController();