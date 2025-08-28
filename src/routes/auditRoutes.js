const express = require('express');
const auditController = require('../controllers/auditController');
const { captureAuditContext, validateRevertPermissions, validateVersionNumber } = require('../middleware/Audit');
const { schemaExists, validateRecordId, validatePagination } = require('../middleware/validateSchema');
const { authenticate, requireTenantAccess, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply audit context capture to all routes
router.use(captureAuditContext);

// Apply authentication and tenant access to all routes
router.use(authenticate);
router.use(requireTenantAccess);

// Apply authorization to all routes
router.use(authorize('audit', 'read'));

// Get audit history for a specific document
router.get('/:schemaName/:documentId/history', 
  schemaExists, 
  validateRecordId, 
  validatePagination, 
  auditController.getDocumentAuditHistory
);

// Get audit history for all documents in a schema
router.get('/:schemaName/history', 
  schemaExists, 
  validatePagination, 
  auditController.getSchemaAuditHistory
);

// Get document at a specific version
router.get('/:schemaName/:documentId/versions/:version', 
  schemaExists, 
  validateRecordId, 
  validateVersionNumber, 
  auditController.getDocumentAtVersion
);

// Get all versions of a document
router.get('/:schemaName/:documentId/versions', 
  schemaExists, 
  validateRecordId, 
  validatePagination, 
  auditController.getDocumentVersions
);

// Compare two versions of a document
router.get('/:schemaName/:documentId/compare', 
  schemaExists, 
  validateRecordId, 
  auditController.compareDocumentVersions
);

// Get audit statistics for a schema
router.get('/:schemaName/stats', 
  schemaExists, 
  auditController.getAuditStats
);

// Get audit summary for a schema
router.get('/:schemaName/summary', 
  schemaExists, 
  auditController.getAuditSummary
);

// Revert document to a specific version (requires write permission)
router.post('/:schemaName/:documentId/revert/:version', 
  authorize('audit', 'write'),
  schemaExists, 
  validateRecordId, 
  validateVersionNumber, 
  validateRevertPermissions, 
  auditController.revertDocumentToVersion
);

// Bulk revert multiple documents (requires write permission)
router.post('/:schemaName/bulk-revert', 
  authorize('audit', 'write'),
  schemaExists, 
  auditController.bulkRevertDocuments
);

// Cleanup old audit logs (requires admin permission)
router.post('/:schemaName/cleanup', 
  authorize('audit', 'admin'),
  schemaExists, 
  auditController.cleanupAuditLogs
);

// Job status and queue management routes
router.get('/jobs/:jobId/status', auditController.getAuditJobStatus);
router.get('/queue/status', auditController.getAuditQueueStatus);

module.exports = router;