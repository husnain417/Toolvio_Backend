const AuditService = require('../services/AuditService');
const CollectionGenerator = require('../services/CollectionGenerator');

/**
 * Middleware to capture audit information from request
 * This should be used before any CRUD operations
 */
const captureAuditContext = (req, res, next) => {
  console.log('🔍 Capturing audit context');
  
  // Extract user information from request
  // This assumes you have authentication middleware that sets user info
  req.auditContext = {
    userId: req.user?.id || req.headers['x-user-id'] || null,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
    timestamp: new Date(),
    sessionId: req.sessionID || req.headers['x-session-id'] || null
  };
  
  console.log('Audit context captured:', {
    userId: req.auditContext.userId,
    ipAddress: req.auditContext.ipAddress,
    userAgent: req.auditContext.userAgent?.substring(0, 50) + '...'
  });
  
  next();
};

/**
 * Middleware to log audit trail for document operations
 * This should be used after successful CRUD operations
 */
const logAuditTrail = (operation) => {
  return async (req, res, next) => {
    console.log(`🔍 Setting up audit trail for operation: ${operation}`);
    
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Call original json method first
      originalJson.call(this, data);
      
      // Then log audit trail asynchronously
      setImmediate(async () => {
        try {
          await logOperationAudit(req, operation, data);
        } catch (error) {
          console.error('❌ Error logging audit trail:', error);
          // Don't fail the request if audit logging fails
        }
      });
    };
    
    next();
  };
};

/**
 * Log audit information for a specific operation
 * @param {Object} req - Express request object
 * @param {string} operation - Operation type (create, update, delete)
 * @param {Object} responseData - Response data from the operation
 */
async function logOperationAudit(req, operation, responseData) {
  console.log(`📝 Logging audit for ${operation} operation`);
  
  try {
    const { schemaName, recordId } = req.params;
    const auditContext = req.auditContext || {};
    
    if (!schemaName) {
      console.log('⚠️  No schema name found, skipping audit');
      return;
    }

    // Get the model for querying current/previous states
    const Model = CollectionGenerator.getDynamicModel(schemaName);
    if (!Model) {
      console.log('⚠️  No dynamic model found, skipping audit');
      return;
    }

    let auditData = {
      schemaName,
      collectionName: Model.collection.name,
      operation,
      userId: auditContext.userId,
      userAgent: auditContext.userAgent,
      ipAddress: auditContext.ipAddress,
      metadata: {
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        timestamp: auditContext.timestamp
      }
    };

    switch (operation) {
      case 'create':
        if (responseData.success && responseData.data) {
          auditData.documentId = responseData.data._id;
          auditData.currentState = responseData.data;
          auditData.previousState = null;
        }
        break;

      case 'update':
        if (recordId && responseData.success && responseData.data) {
          auditData.documentId = recordId;
          auditData.currentState = responseData.data;
          
          // Try to get previous state from stored data (if available)
          // This would require modifying the update method to store previous state
          auditData.previousState = req.previousDocumentState || null;
        }
        break;

      case 'delete':
        if (recordId && responseData.success) {
          auditData.documentId = recordId;
          auditData.currentState = null;
          
          // Try to get previous state from stored data (if available)
          auditData.previousState = req.previousDocumentState || null;
        }
        break;
    }

    // Only log if we have essential data
    if (auditData.documentId) {
      await AuditService.logChange(auditData);
      console.log('✅ Audit trail logged successfully');
    } else {
      console.log('⚠️  Missing document ID, skipping audit');
    }
    
  } catch (error) {
    console.error('❌ Error in logOperationAudit:', error);
    // Don't throw - audit logging shouldn't fail the main operation
  }
}

/**
 * Middleware to capture document state before modification
 * This should be used before update/delete operations
 */
const captureDocumentState = async (req, res, next) => {
  console.log('🔍 Capturing document state before modification');
  
  try {
    const { schemaName, recordId } = req.params;
    
    if (!recordId || !schemaName) {
      console.log('⚠️  Missing recordId or schemaName, skipping state capture');
      return next();
    }

    const Model = CollectionGenerator.getDynamicModel(schemaName);
    if (!Model) {
      console.log('⚠️  No dynamic model found, skipping state capture');
      return next();
    }

    // Get current document state
    const currentDocument = await Model.findById(recordId);
    if (currentDocument) {
      req.previousDocumentState = currentDocument.toObject();
      console.log('✅ Document state captured');
    } else {
      console.log('⚠️  Document not found, unable to capture state');
    }
    
  } catch (error) {
    console.error('❌ Error capturing document state:', error);
    // Don't fail the request if state capture fails
  }
  
  next();
};

/**
 * Middleware to validate revert permissions
 * This should be used before revert operations
 */
const validateRevertPermissions = (req, res, next) => {
  console.log('🔍 Validating revert permissions');
  
  // Here you can add your permission validation logic
  // For example, check if user has revert permissions for the schema
  
  const userRole = req.user?.role || req.headers['x-user-role'];
  const allowedRoles = ['admin', 'super_admin']; // Configure as needed
  
  if (!userRole || !allowedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions to revert documents'
    });
  }
  
  console.log('✅ Revert permissions validated');
  next();
};

/**
 * Middleware to validate version number format
 */
const validateVersionNumber = (req, res, next) => {
  const { version } = req.params;
  
  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Version number is required'
    });
  }
  
  const versionNum = parseInt(version);
  if (isNaN(versionNum) || versionNum < 1) {
    return res.status(400).json({
      success: false,
      error: 'Version must be a positive integer'
    });
  }
  
  req.targetVersion = versionNum;
  next();
};

module.exports = {
  captureAuditContext,
  logAuditTrail,
  captureDocumentState,
  validateRevertPermissions,
  validateVersionNumber
};