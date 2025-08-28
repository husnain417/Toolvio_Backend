const AuditService = require('../services/AuditService');
const QueueService = require('../services/QueueService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Audit Controller
 * Handles audit trail operations and rollback functionality
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
    this.getAuditJobStatus = this.getAuditJobStatus.bind(this);
    this.getAuditQueueStatus = this.getAuditQueueStatus.bind(this);
  }

  /**
   * Get audit history for a specific document
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDocumentAuditHistory(req, res) {
    try {
      const { documentId, schemaName } = req.params;
      const { page = 1, limit = 50, operation, startDate, endDate } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        operation,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      const auditHistory = await AuditService.getAuditHistory(documentId, schemaName, options);
      successResponse(res, auditHistory, 'Audit history retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get audit history for all documents in a schema
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSchemaAuditHistory(req, res) {
    try {
      const { schemaName } = req.params;
      const { page = 1, limit = 50, operation, startDate, endDate, documentId } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        operation,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        documentId
      };

      const auditHistory = await AuditService.getSchemaAuditHistory(schemaName, options);
      successResponse(res, auditHistory, 'Schema audit history retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get a document at a specific version
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDocumentAtVersion(req, res) {
    try {
      const { documentId, schemaName, version } = req.params;

      const document = await AuditService.getDocumentAtVersion(documentId, schemaName, parseInt(version));
      if (!document) {
        return errorResponse(res, 'Document version not found', 404);
      }

      successResponse(res, document, 'Document version retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Revert a document to a specific version
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async revertDocumentToVersion(req, res) {
    try {
      const { documentId, schemaName, version } = req.params;
      const { reason } = req.body;
      const auditContext = {
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { reason }
      };

      const result = await AuditService.revertToVersion(
        documentId,
        schemaName,
        parseInt(version),
        auditContext
      );

      successResponse(res, result, 'Document reverted successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
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
      const { timeframe = '30d', operation } = req.query;

      const stats = await AuditService.getAuditStats(schemaName, { timeframe, operation });
      successResponse(res, stats, 'Audit statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get all versions of a document
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDocumentVersions(req, res) {
    try {
      const { documentId, schemaName } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const versions = await AuditService.getDocumentVersions(documentId, schemaName, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      successResponse(res, versions, 'Document versions retrieved successfully');
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
      const { documentId, schemaName } = req.params;
      const { version1, version2 } = req.query;

      if (!version1 || !version2) {
        return errorResponse(res, 'Both version1 and version2 are required', 400);
      }

      const comparison = await AuditService.compareDocumentVersions(
        documentId,
        schemaName,
        parseInt(version1),
        parseInt(version2)
      );

      successResponse(res, comparison, 'Document versions compared successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Bulk revert multiple documents
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async bulkRevertDocuments(req, res) {
    try {
      const { documents } = req.body;
      const { reason } = req.body;
      const auditContext = {
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { reason, bulkOperation: true }
      };

      if (!Array.isArray(documents) || documents.length === 0) {
        return errorResponse(res, 'Documents array is required and must not be empty', 400);
      }

      const results = await AuditService.bulkRevertDocuments(documents, auditContext);
      successResponse(res, results, 'Bulk revert completed successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Cleanup old audit logs
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async cleanupAuditLogs(req, res) {
    try {
      const { olderThan = 365, schemaName, operation, dryRun = false } = req.body;

      const result = await AuditService.cleanupOldAuditLogs({
        olderThan: parseInt(olderThan),
        schemaName,
        operation,
        dryRun: dryRun === true
      });

      successResponse(res, result, 'Audit cleanup completed successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get audit summary for a schema
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAuditSummary(req, res) {
    try {
      const { schemaName } = req.params;
      const { timeframe = '30d' } = req.query;

      const summary = await AuditService.getAuditSummary(schemaName, { timeframe });
      successResponse(res, summary, 'Audit summary retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get status of a specific audit job
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAuditJobStatus(req, res) {
    try {
      const { jobId } = req.params;

      const job = await QueueService.getJob(jobId, 'audit');
      if (!job) {
        return errorResponse(res, 'Audit job not found', 404);
      }

      const jobStatus = {
        id: job.id,
        name: job.name,
        data: job.data,
        status: await job.getState(),
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        delay: job.delay,
        priority: job.priority
      };

      successResponse(res, jobStatus, 'Audit job status retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get status of the audit queue
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAuditQueueStatus(req, res) {
    try {
      const queueStatus = await QueueService.getQueueStatus('audit');
      successResponse(res, queueStatus, 'Audit queue status retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new AuditController();