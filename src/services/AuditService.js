const AuditLog = require('../models/AuditLog');
const CollectionGenerator = require('./CollectionGenerator');
const SchemaService = require('./SchemaService');

class AuditService {
  /**
   * Log an audit entry for a document change
   * @param {Object} auditData - Audit log data
   * @returns {Promise<Object>} - Created audit log entry
   */
  async logChange(auditData) {
    console.log('🔍 Logging audit change:', auditData.operation);
    
    try {
      const {
        documentId,
        schemaName,
        collectionName,
        operation,
        previousState,
        currentState,
        userId,
        userAgent,
        ipAddress,
        metadata = {}
      } = auditData;

      // Calculate version number
      const latestVersion = await this.getLatestVersion(documentId, schemaName);
      const version = latestVersion + 1;

      // Calculate changed fields for update operations
      let changedFields = [];
      if (operation === 'update' && previousState && currentState) {
        changedFields = this.calculateChangedFields(previousState, currentState);
      }

      // Create audit log entry
      const auditLog = new AuditLog({
        documentId,
        schemaName,
        collectionName,
        operation,
        previousState,
        currentState,
        changedFields,
        userId,
        userAgent,
        ipAddress,
        version,
        metadata,
        timestamp: new Date()
      });

      const savedAuditLog = await auditLog.save();
      console.log('✅ Audit log created with version:', version);
      
      return savedAuditLog;
    } catch (error) {
      console.error('❌ Error logging audit change:', error);
      throw new Error(`Failed to log audit change: ${error.message}`);
    }
  }

  /**
   * Get audit history for a specific document
   * @param {string} documentId - Document ID
   * @param {string} schemaName - Schema name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Audit history with pagination
   */
  async getAuditHistory(documentId, schemaName, options = {}) {
    const {
      page = 1,
      limit = 20,
      operation,
      startDate,
      endDate
    } = options;

    const query = { documentId, schemaName };

    // Filter by operation type
    if (operation) {
      query.operation = operation;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const total = await AuditLog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const auditLogs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      auditLogs,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    };
  }

  /**
   * Get audit history for all documents of a schema
   * @param {string} schemaName - Schema name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Audit history with pagination
   */
  async getSchemaAuditHistory(schemaName, options = {}) {
    const {
      page = 1,
      limit = 50,
      operation,
      userId,
      startDate,
      endDate
    } = options;

    const query = { schemaName };

    // Filter by operation type
    if (operation) {
      query.operation = operation;
    }

    // Filter by user
    if (userId) {
      query.userId = userId;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const total = await AuditLog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const auditLogs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      auditLogs,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    };
  }

  /**
   * Revert a document to a specific version
   * @param {string} documentId - Document ID
   * @param {string} schemaName - Schema name
   * @param {number} targetVersion - Version to revert to
   * @param {Object} revertOptions - Revert options
   * @returns {Promise<Object>} - Reverted document and audit log
   */
  async revertToVersion(documentId, schemaName, targetVersion, revertOptions = {}) {
    console.log(`🔄 Reverting document ${documentId} to version ${targetVersion}`);
    
    try {
      // Get the target version audit log
      const targetAuditLog = await AuditLog.findOne({
        documentId,
        schemaName,
        version: targetVersion
      });

      if (!targetAuditLog) {
        throw new Error(`Version ${targetVersion} not found for document ${documentId}`);
      }

      if (!targetAuditLog.canRevert) {
        throw new Error(`Version ${targetVersion} cannot be reverted`);
      }

      // Get the target state
      const targetState = targetAuditLog.currentState;
      if (!targetState) {
        throw new Error(`No state available for version ${targetVersion}`);
      }

      // Get the dynamic model
      const Model = CollectionGenerator.getDynamicModel(schemaName);
      if (!Model) {
        throw new Error(`Dynamic model for schema '${schemaName}' not found`);
      }

      // Get current document state
      const currentDocument = await Model.findById(documentId);
      if (!currentDocument) {
        throw new Error(`Document ${documentId} not found`);
      }

      const currentState = currentDocument.toObject();

      // Prepare revert data (exclude system fields from target state)
      const revertData = { ...targetState };
      delete revertData._id;
      delete revertData.__v;
      delete revertData.createdAt;
      delete revertData.updatedAt;
      delete revertData._schemaName;

      // Update the document
      const revertedDocument = await Model.findByIdAndUpdate(
        documentId,
        { ...revertData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      // Log the revert operation
      const revertAuditLog = await this.logChange({
        documentId,
        schemaName,
        collectionName: Model.collection.name,
        operation: 'update',
        previousState: currentState,
        currentState: revertedDocument.toObject(),
        userId: revertOptions.userId,
        userAgent: revertOptions.userAgent,
        ipAddress: revertOptions.ipAddress,
        metadata: {
          isRevert: true,
          revertedToVersion: targetVersion,
          revertReason: revertOptions.reason || 'Manual revert'
        }
      });

      // Update the revert reference
      await AuditLog.findByIdAndUpdate(revertAuditLog._id, {
        revertedFrom: targetAuditLog._id
      });

      console.log('✅ Document reverted successfully');

      return {
        document: revertedDocument.toObject(),
        auditLog: revertAuditLog,
        revertedFromVersion: targetVersion
      };
    } catch (error) {
      console.error('❌ Error reverting document:', error);
      throw new Error(`Failed to revert document: ${error.message}`);
    }
  }

  /**
   * Get document at a specific version
   * @param {string} documentId - Document ID
   * @param {string} schemaName - Schema name
   * @param {number} version - Version number
   * @returns {Promise<Object|null>} - Document state at version
   */
  async getDocumentAtVersion(documentId, schemaName, version) {
    const auditLog = await AuditLog.findOne({
      documentId,
      schemaName,
      version
    });

    if (!auditLog) {
      return null;
    }

    return {
      version: auditLog.version,
      timestamp: auditLog.timestamp,
      operation: auditLog.operation,
      state: auditLog.currentState,
      changedFields: auditLog.changedFields,
      metadata: auditLog.metadata
    };
  }

  /**
   * Get audit statistics for a schema
   * @param {string} schemaName - Schema name
   * @param {Object} options - Options
   * @returns {Promise<Object>} - Audit statistics
   */
  async getAuditStats(schemaName, options = {}) {
    const { timeframe = '30d' } = options;

    // Calculate time range
    let timeRange = {};
    const now = new Date();
    switch (timeframe) {
      case '24h':
        timeRange = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
        break;
      case '7d':
        timeRange = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        timeRange = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      default:
        timeRange = {};
    }

    const baseQuery = { schemaName };
    if (Object.keys(timeRange).length > 0) {
      baseQuery.timestamp = timeRange;
    }

    // Aggregate statistics
    const stats = await AuditLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$operation',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalAuditLogs = await AuditLog.countDocuments(baseQuery);
    const uniqueDocuments = await AuditLog.distinct('documentId', baseQuery);

    // Format stats
    const operationStats = {};
    stats.forEach(stat => {
      operationStats[stat._id] = stat.count;
    });

    return {
      schemaName,
      timeframe,
      totalAuditLogs,
      uniqueDocuments: uniqueDocuments.length,
      operations: {
        create: operationStats.create || 0,
        update: operationStats.update || 0,
        delete: operationStats.delete || 0
      }
    };
  }

  /**
   * Calculate changed fields between two states
   * @param {Object} previousState - Previous document state
   * @param {Object} currentState - Current document state
   * @returns {Array} - Array of changed fields
   */
  calculateChangedFields(previousState, currentState) {
    const changedFields = [];
    const allFields = new Set([
      ...Object.keys(previousState || {}),
      ...Object.keys(currentState || {})
    ]);

    for (const field of allFields) {
      // Skip system fields
      if (['_id', '__v', 'createdAt', 'updatedAt', '_schemaName'].includes(field)) {
        continue;
      }

      const oldValue = previousState[field];
      const newValue = currentState[field];

      // Deep comparison for objects and arrays
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changedFields.push({
          field,
          oldValue,
          newValue
        });
      }
    }

    return changedFields;
  }

  /**
   * Get latest version number for a document
   * @param {string} documentId - Document ID
   * @param {string} schemaName - Schema name
   * @returns {Promise<number>} - Latest version number
   */
  async getLatestVersion(documentId, schemaName) {
    const latestAuditLog = await AuditLog.findOne({
      documentId,
      schemaName
    }).sort({ version: -1 });

    return latestAuditLog ? latestAuditLog.version : 0;
  }

  /**
   * Clean up old audit logs
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanupOldAuditLogs(options = {}) {
    const {
      olderThan = 365, // days
      schemaName,
      operation,
      dryRun = false
    } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThan);

    const query = { timestamp: { $lt: cutoffDate } };
    if (schemaName) query.schemaName = schemaName;
    if (operation) query.operation = operation;

    if (dryRun) {
      const count = await AuditLog.countDocuments(query);
      return { wouldDelete: count, dryRun: true };
    }

    const result = await AuditLog.deleteMany(query);
    return { deleted: result.deletedCount };
  }
}

module.exports = new AuditService();