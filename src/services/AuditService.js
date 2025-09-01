const AuditLog = require('../models/AuditLog');
const CollectionGenerator = require('./CollectionGenerator');
const SchemaService = require('./SchemaService');
const SyncVersion = require('../models/SyncVersion');

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
        tenantId,
        metadata = {}
      } = auditData;

      // Validate required fields
      if (!documentId || !schemaName || !operation) {
        throw new Error('Missing required audit fields: documentId, schemaName, operation');
      }

      // Generate deduplication key to prevent duplicate audit logs
      const deduplicationKey = this.generateDeduplicationKey(documentId, operation, metadata);

      // Check if audit log already exists for this operation
      const existingAudit = await AuditLog.findOne({ deduplicationKey });
      if (existingAudit) {
        console.log('⚠️  Duplicate audit log detected, skipping:', deduplicationKey);
        return existingAudit;
      }

      // Calculate version number
      const latestVersion = await this.getLatestVersion(documentId, schemaName);
      const version = latestVersion + 1;

      // Calculate changed fields for update operations
      let changedFields = [];
      if (operation === 'update' && previousState && currentState) {
        changedFields = this.calculateChangedFields(previousState, currentState);
      }

      // Get sync versions for this change
      const [globalVersion, tenantVersion, schemaVersion] = await Promise.all([
        SyncVersion.getNextVersion('global', 'global'),
        SyncVersion.getNextVersion('tenant', tenantId || 'default'),
        SyncVersion.getNextVersion('schema', `${tenantId || 'default'}:${schemaName}`)
      ]);

      // Create audit log entry with sync versions
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
        timestamp: new Date(),
        deduplicationKey,
        // Sync-specific fields
        globalSyncVersion: globalVersion,
        tenantSyncVersion: tenantVersion,
        schemaSyncVersion: schemaVersion,
        tenantId: tenantId || 'default',
        syncStatus: 'pending'
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
   * Generate deduplication key for audit logs
   * @param {string} documentId - Document ID
   * @param {string} operation - Operation type
   * @param {Object} metadata - Metadata
   * @returns {string} - Deduplication key
   */
  generateDeduplicationKey(documentId, operation, metadata = {}) {
    const source = metadata.source || 'unknown';
    const timestamp = Math.floor(Date.now() / 1000); // Round to nearest second
    return `${documentId}:${operation}:${source}:${timestamp}`;
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
        tenantId: revertOptions.tenantId,
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
    const { timeframe = '30d', operation } = options;

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

    // Add operation filter if specified
    if (operation) {
      baseQuery.operation = operation;
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
      operation: operation || 'all',
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

  /**
   * Get all versions of a document
   * @param {string} documentId - Document ID
   * @param {string} schemaName - Schema name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Document versions with pagination
   */
  async getDocumentVersions(documentId, schemaName, options = {}) {
    const { page = 1, limit = 50 } = options;

    const query = { documentId, schemaName };
    const skip = (page - 1) * limit;
    const total = await AuditLog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const versions = await AuditLog.find(query)
      .select('version timestamp operation currentState changedFields metadata userId')
      .sort({ version: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      documentId,
      schemaName,
      versions: versions.map(version => ({
        version: version.version,
        timestamp: version.timestamp,
        operation: version.operation,
        state: version.currentState,
        changedFields: version.changedFields,
        metadata: version.metadata,
        userId: version.userId
      })),
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
   * Compare two versions of a document
   * @param {string} documentId - Document ID
   * @param {string} schemaName - Schema name
   * @param {number} version1 - First version number
   * @param {number} version2 - Second version number
   * @returns {Promise<Object>} - Comparison result
   */
  async compareDocumentVersions(documentId, schemaName, version1, version2) {
    // Validate version numbers
    if (version1 === version2) {
      throw new Error('Cannot compare a version with itself');
    }

    if (version1 < 0 || version2 < 0) {
      throw new Error('Version numbers must be positive integers');
    }

    // Get both versions
    const [version1Data, version2Data] = await Promise.all([
      AuditLog.findOne({ documentId, schemaName, version: version1 }).lean(),
      AuditLog.findOne({ documentId, schemaName, version: version2 }).lean()
    ]);

    if (!version1Data) {
      throw new Error(`Version ${version1} not found for document ${documentId}`);
    }

    if (!version2Data) {
      throw new Error(`Version ${version2} not found for document ${documentId}`);
    }

    // Determine which version is newer
    const newerVersion = version1 > version2 ? version1 : version2;
    const olderVersion = version1 > version2 ? version2 : version1;
    const newerData = version1 > version2 ? version1Data : version2Data;
    const olderData = version1 > version2 ? version2Data : version1Data;

    // Compare the states
    const comparison = this.compareStates(olderData.currentState, newerData.currentState);

    return {
      documentId,
      schemaName,
      comparison: {
        olderVersion: {
          version: olderVersion,
          timestamp: olderData.timestamp,
          operation: olderData.operation,
          state: olderData.currentState
        },
        newerVersion: {
          version: newerVersion,
          timestamp: newerData.timestamp,
          operation: newerData.operation,
          state: newerData.currentState
        },
        differences: comparison.differences,
        addedFields: comparison.addedFields,
        removedFields: comparison.removedFields,
        modifiedFields: comparison.modifiedFields
      }
    };
  }

  /**
   * Compare two document states and identify differences
   * @param {Object} oldState - Older document state
   * @param {Object} newState - Newer document state
   * @returns {Object} - Comparison result
   */
  compareStates(oldState, newState) {
    const differences = [];
    const addedFields = [];
    const removedFields = [];
    const modifiedFields = [];

    const allFields = new Set([
      ...Object.keys(oldState || {}),
      ...Object.keys(newState || {})
    ]);

    for (const field of allFields) {
      // Skip system fields
      if (['_id', '__v', 'createdAt', 'updatedAt', '_schemaName'].includes(field)) {
        continue;
      }

      const oldValue = oldState[field];
      const newValue = newState[field];

      if (!(field in oldState)) {
        // Field was added
        addedFields.push({
          field,
          value: newValue
        });
        differences.push({
          type: 'added',
          field,
          value: newValue
        });
      } else if (!(field in newState)) {
        // Field was removed
        removedFields.push({
          field,
          value: oldValue
        });
        differences.push({
          type: 'removed',
          field,
          value: oldValue
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        // Field was modified
        modifiedFields.push({
          field,
          oldValue,
          newValue
        });
        differences.push({
          type: 'modified',
          field,
          oldValue,
          newValue
        });
      }
    }

    return {
      differences,
      addedFields,
      removedFields,
      modifiedFields,
      totalChanges: differences.length
    };
  }

  /**
   * Bulk revert multiple documents
   * @param {Array} documents - Array of documents to revert
   * @param {Object} auditContext - Audit context for the revert operation
   * @returns {Promise<Object>} - Bulk revert results
   */
  async bulkRevertDocuments(documents, auditContext) {
    console.log(`🔄 Starting bulk revert of ${documents.length} documents`);

    const results = [];
    const errors = [];

    for (const doc of documents) {
      try {
        const { documentId, schemaName, version, reason } = doc;

        if (!documentId || !schemaName || !version) {
          throw new Error('Missing required fields: documentId, schemaName, or version');
        }

        const revertOptions = {
          ...auditContext,
          reason: reason || auditContext.metadata?.reason || 'Bulk revert operation'
        };

        const result = await this.revertToVersion(documentId, schemaName, version, revertOptions);
        
        results.push({
          documentId,
          schemaName,
          version,
          success: true,
          result
        });

        console.log(`✅ Successfully reverted document ${documentId} to version ${version}`);
      } catch (error) {
        console.error(`❌ Failed to revert document ${doc.documentId}:`, error.message);
        
        errors.push({
          documentId: doc.documentId,
          schemaName: doc.schemaName,
          version: doc.version,
          success: false,
          error: error.message
        });
      }
    }

    const summary = {
      totalDocuments: documents.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };

    console.log(`📊 Bulk revert completed: ${results.length} successful, ${errors.length} failed`);

    return summary;
  }

  /**
   * Get audit summary for a schema
   * @param {string} schemaName - Schema name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Audit summary
   */
  async getAuditSummary(schemaName, options = {}) {
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
      case '90d':
        timeRange = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case '1y':
        timeRange = { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
        break;
      default:
        timeRange = {};
    }

    const baseQuery = { schemaName };
    if (Object.keys(timeRange).length > 0) {
      baseQuery.timestamp = timeRange;
    }

    // Get comprehensive summary using aggregation
    const summary = await AuditLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalOperations: { $sum: 1 },
          uniqueDocuments: { $addToSet: '$documentId' },
          uniqueUsers: { $addToSet: '$userId' },
          operations: {
            $push: {
              operation: '$operation',
              timestamp: '$timestamp',
              userId: '$userId'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalOperations: 1,
          uniqueDocuments: { $size: '$uniqueDocuments' },
          uniqueUsers: { $size: '$uniqueUsers' },
          operations: 1
        }
      }
    ]);

    // Get operation breakdown
    const operationBreakdown = await AuditLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$operation',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity
    const recentActivity = await AuditLog.find(baseQuery)
      .select('operation timestamp userId documentId')
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    // Get top users by activity
    const topUsers = await AuditLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$userId',
          operationCount: { $sum: 1 }
        }
      },
      { $sort: { operationCount: -1 } },
      { $limit: 5 }
    ]);

    const summaryData = summary[0] || {
      totalOperations: 0,
      uniqueDocuments: 0,
      uniqueUsers: 0
    };

    // Format operation breakdown
    const operations = {};
    operationBreakdown.forEach(op => {
      operations[op._id] = op.count;
    });

    return {
      schemaName,
      timeframe,
      summary: {
        totalOperations: summaryData.totalOperations,
        uniqueDocuments: summaryData.uniqueDocuments,
        uniqueUsers: summaryData.uniqueUsers
      },
      operations: {
        create: operations.create || 0,
        update: operations.update || 0,
        delete: operations.delete || 0
      },
      recentActivity,
      topUsers,
      generatedAt: new Date()
    };
  }
}

module.exports = new AuditService();