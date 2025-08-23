const express = require('express');
const dynamicController = require('../controllers/dynamicController');
const { schemaExists, validateRecordId, validatePagination, validateDynamicData } = require('../middleware/validateSchema');
const { captureAuditContext, captureDocumentState } = require('../middleware/Audit');
const { authenticate, authorize, requireTenantAccess } = require('../middleware/auth');

const router = express.Router();

// Apply audit context capture to all routes
router.use(captureAuditContext);

// Apply authentication and tenant access to all routes
router.use(authenticate, requireTenantAccess);

// Static routes FIRST (before parameterized routes)
router.get('/:schemaName/count', 
  authorize('data', 'read'), 
  schemaExists(), 
  dynamicController.getRecordCount
);

router.get('/:schemaName/search', 
  authorize('data', 'read'), 
  schemaExists(), 
  validatePagination, 
  dynamicController.searchRecords
);

router.get('/:schemaName/stats', 
  authorize('data', 'read'), 
  schemaExists(), 
  dynamicController.getRecordStats
);

router.post('/:schemaName/bulk', 
  authorize('data', 'write'), 
  schemaExists(), 
  dynamicController.bulkCreateRecords
);

// Parameterized routes LAST
router.get('/:schemaName', 
  authorize('data', 'read'), 
  validatePagination, 
  schemaExists(), 
  dynamicController.getRecords
);

router.get('/:schemaName/:recordId', 
  authorize('data', 'read'), 
  schemaExists(), 
  validateRecordId(), 
  dynamicController.getRecordById
);

// Create record (with audit logging built into service)
router.post('/:schemaName', 
  authorize('data', 'write'),
  schemaExists(), 
  validateDynamicData, 
  dynamicController.createRecord
);

// Update record (with audit logging built into service)
router.put('/:schemaName/:recordId', 
  authorize('data', 'write'),
  schemaExists(), 
  validateRecordId(), 
  validateDynamicData,
  captureDocumentState, // Capture state before update
  dynamicController.updateRecord
);

// Patch record (with audit logging built into service)
router.patch('/:schemaName/:recordId', 
  authorize('data', 'write'),
  schemaExists(), 
  validateRecordId(),
  captureDocumentState, // Capture state before update
  dynamicController.patchRecord
);

// Delete record (with audit logging built into service)
router.delete('/:schemaName/:recordId', 
  authorize('data', 'delete'),
  schemaExists(), 
  validateRecordId(),
  captureDocumentState, // Capture state before deletion
  dynamicController.deleteRecord
);

module.exports = router;