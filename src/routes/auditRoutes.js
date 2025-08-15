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

const router = express.Router();

// Apply audit context capture to all routes
router.use(captureAuditContext);

// Schema-level audit routes (no record ID required)
router.get('/:schemaName/history', 
  schemaExists(), 
  validatePagination, 
  auditController.getSchemaAuditHistory
);

router.get('/:schemaName/stats', 
  schemaExists(), 
  auditController.getAuditStats
);

router.get('/:schemaName/summary', 
  schemaExists(), 
  auditController.getAuditSummary
);

router.post('/:schemaName/cleanup', 
  schemaExists(), 
  //validateRevertPermissions,
  auditController.cleanupAuditLogs
);

router.post('/:schemaName/bulk-revert', 
  schemaExists(), 
  validateRevertPermissions,
  auditController.bulkRevertDocuments
);

// Document-specific audit routes
router.get('/:schemaName/:recordId/history', 
  schemaExists(), 
  validateRecordId(), 
  validatePagination,
  auditController.getDocumentAuditHistory
);

router.get('/:schemaName/:recordId/versions', 
  schemaExists(), 
  validateRecordId(), 
  validatePagination,
  auditController.getDocumentVersions
);

router.get('/:schemaName/:recordId/version/:version', 
  schemaExists(), 
  validateRecordId(), 
  validateVersionNumber,
  auditController.getDocumentAtVersion
);

router.get('/:schemaName/:recordId/compare', 
  schemaExists(), 
  validateRecordId(),
  auditController.compareDocumentVersions
);

router.post('/:schemaName/:recordId/revert/:version', 
  schemaExists(), 
  validateRecordId(), 
  validateVersionNumber,
  //validateRevertPermissions,
  auditController.revertDocumentToVersion
);

module.exports = router;