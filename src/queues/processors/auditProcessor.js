const AuditService = require('../../services/AuditService');
const SchemaService = require('../../services/SchemaService');
const CollectionGenerator = require('../../services/CollectionGenerator');

/**
 * Process audit jobs from the queue
 * @param {Object} job - BullMQ job object
 * @returns {Promise<Object>} - Job result
 */
async function processJob(job) {
  const { name, data } = job;
  
  console.log(`🔄 Processing audit job ${job.id}: ${name}`);
  
  try {
    switch (name) {
      case 'process-audit':
        return await processAuditCreate(data);
        
      case 'audit:bulk-create':
        return await processBulkAuditCreate(data);
        
      case 'audit:cleanup':
        return await processAuditCleanup(data);
        
      case 'audit:rollback':
        return await processAuditRollback(data);
        
      default:
        throw new Error(`Unknown audit job type: ${name}`);
    }
  } catch (error) {
    console.error(`❌ Audit job ${job.id} failed:`, error);
    
    // Log the error for debugging
    job.log(`Audit job failed: ${error.message}`);
    
    // Re-throw to trigger retry mechanism
    throw error;
  }
}

/**
 * Process single audit creation job
 * @param {Object} data - Audit data
 * @returns {Promise<Object>} - Created audit log
 */
async function processAuditCreate(data) {
  console.log('📝 Processing audit creation job');
  
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
  } = data;

  // Validate required fields
  if (!documentId || !schemaName || !operation) {
    throw new Error('Missing required audit fields: documentId, schemaName, operation');
  }

  // Create audit log entry
  const auditLog = await AuditService.logChange({
    documentId,
    schemaName,
    collectionName,
    operation,
    previousState,
    currentState,
    userId,
    userAgent,
    ipAddress,
    tenantId, // CRITICAL: Pass tenantId from job data
    metadata: {
      ...metadata,
      processedBy: 'queue',
      jobTimestamp: new Date().toISOString()
    }
  });

  console.log(`✅ Audit log created successfully: ${auditLog._id}`);
  
  return {
    success: true,
    auditLogId: auditLog._id,
    version: auditLog.version,
    timestamp: auditLog.timestamp
  };
}

/**
 * Process bulk audit creation job
 * @param {Object} data - Bulk audit data
 * @returns {Promise<Object>} - Bulk creation result
 */
async function processBulkAuditCreate(data) {
  console.log('📝 Processing bulk audit creation job');
  
  const { audits } = data;
  
  if (!Array.isArray(audits) || audits.length === 0) {
    throw new Error('Bulk audit data must be a non-empty array');
  }

  const results = [];
  const errors = [];
  
  // Process each audit entry
  for (let i = 0; i < audits.length; i++) {
    try {
      const auditData = audits[i];
      const result = await processAuditCreate(auditData);
      results.push({
        index: i,
        success: true,
        ...result
      });
    } catch (error) {
      errors.push({
        index: i,
        error: error.message
      });
    }
  }

  const summary = {
    total: audits.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors
  };

  console.log(`✅ Bulk audit creation completed: ${results.length}/${audits.length} successful`);
  
  return summary;
}

/**
 * Process audit cleanup job
 * @param {Object} data - Cleanup options
 * @returns {Promise<Object>} - Cleanup result
 */
async function processAuditCleanup(data) {
  console.log('🧹 Processing audit cleanup job');
  
  const {
    olderThan = 365, // days
    schemaName,
    operation,
    dryRun = false
  } = data;

  // Perform cleanup
  const result = await AuditService.cleanupOldAuditLogs({
    olderThan,
    schemaName,
    operation,
    dryRun
  });

  console.log(`✅ Audit cleanup completed: ${dryRun ? 'dry run' : 'actual cleanup'}`);
  
  return {
    success: true,
    dryRun,
    result
  };
}

/**
 * Process audit rollback job
 * @param {Object} data - Rollback data
 * @returns {Promise<Object>} - Rollback result
 */
async function processAuditRollback(data) {
  console.log('🔄 Processing audit rollback job');
  
  const {
    documentId,
    schemaName,
    targetVersion,
    userId,
    userAgent,
    ipAddress,
    reason
  } = data;

  // Validate required fields
  if (!documentId || !schemaName || !targetVersion) {
    throw new Error('Missing required rollback fields: documentId, schemaName, targetVersion');
  }

  // Perform rollback
  const result = await AuditService.revertToVersion(
    documentId,
    schemaName,
    targetVersion,
    {
      userId,
      userAgent,
      ipAddress,
      reason: reason || 'Queue-initiated rollback'
    }
  );

  console.log(`✅ Audit rollback completed: document ${documentId} reverted to version ${targetVersion}`);
  
  return {
    success: true,
    documentId,
    targetVersion,
    newVersion: result.auditLog.version,
    timestamp: result.auditLog.timestamp
  };
}

/**
 * Process change stream event job
 * @param {Object} data - Change stream event data
 * @returns {Promise<Object>} - Processing result
 */
async function processChangeStreamEvent(data) {
  console.log('📡 Processing change stream event job');
  
  const {
    operationType,
    documentKey,
    fullDocument,
    fullDocumentBeforeChange,
    schemaName,
    collectionName
  } = data;

  // Map operation type to audit operation
  const operationMap = {
    'insert': 'create',
    'update': 'update',
    'delete': 'delete'
  };

  const operation = operationMap[operationType];
  if (!operation) {
    throw new Error(`Unknown operation type: ${operationType}`);
  }

  // Prepare audit data
  const auditData = {
    documentId: documentKey._id,
    schemaName,
    collectionName,
    operation,
    currentState: fullDocument,
    previousState: fullDocumentBeforeChange,
    metadata: {
      source: 'changeStream',
      operationType,
      processedBy: 'queue'
    }
  };

  // Create audit log
  const result = await processAuditCreate(auditData);
  
  return {
    success: true,
    operationType,
    documentId: documentKey._id,
    ...result
  };
}

module.exports = {
  processJob,
  processAuditCreate,
  processBulkAuditCreate,
  processAuditCleanup,
  processAuditRollback,
  processChangeStreamEvent
};
