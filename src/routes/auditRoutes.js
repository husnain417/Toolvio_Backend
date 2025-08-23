const express = require('express');
const auditController = require('../controllers/auditController');
const { 
  schemaExists, 
  validateRecordId, 
  validatePagination 
} = require('../middleware/validateSchema');
const { 
  validateRevertPermissions, 
  validateVersionNumber,
  captureAuditContext 
} = require('../middleware/Audit');
const { authenticate, authorize, requireTenantAccess } = require('../middleware/auth');

const router = express.Router();

// Apply audit context capture to all routes
router.use(captureAuditContext);

// Apply authentication and tenant access to all routes
router.use(authenticate, requireTenantAccess);

// Schema-level audit routes (no record ID required)
router.get('/:schemaName/history', 
  authorize('audit', 'read'),
  schemaExists(), 
  validatePagination, 
  auditController.getSchemaAuditHistory
);

router.get('/:schemaName/stats', 
  authorize('audit', 'read'),
  schemaExists(), 
  auditController.getAuditStats
);

router.get('/:schemaName/summary', 
  authorize('audit', 'read'),
  schemaExists(), 
  auditController.getAuditSummary
);

router.post('/:schemaName/cleanup', 
  authorize('audit', 'rollback'),
  schemaExists(), 
  //validateRevertPermissions,
  auditController.cleanupAuditLogs
);

router.post('/:schemaName/bulk-revert', 
  authorize('audit', 'rollback'),
  schemaExists(), 
  validateRevertPermissions,
  auditController.bulkRevertDocuments
);

// Document-specific audit routes
router.get('/:schemaName/:recordId/history', 
  authorize('audit', 'read'),
  schemaExists(), 
  validateRecordId(), 
  validatePagination,
  auditController.getDocumentAuditHistory
);

router.get('/:schemaName/:recordId/versions', 
  authorize('audit', 'read'),
  schemaExists(), 
  validateRecordId(), 
  validatePagination,
  auditController.getDocumentVersions
);

router.get('/:schemaName/:recordId/version/:version', 
  authorize('audit', 'read'),
  schemaExists(), 
  validateRecordId(), 
  validateVersionNumber,
  auditController.getDocumentAtVersion
);

router.get('/:schemaName/:recordId/compare', 
  authorize('audit', 'read'),
  schemaExists(), 
  validateRecordId(),
  auditController.compareDocumentVersions
);

router.post('/:schemaName/:recordId/revert/:version', 
  authorize('audit', 'rollback'),
  schemaExists(), 
  validateRecordId(), 
  validateVersionNumber,
  //validateRevertPermissions,
  auditController.revertDocumentToVersion
);

module.exports = router;