const express = require('express');
const dynamicController = require('../controllers/dynamicController');
const { schemaExists, validateRecordId, validatePagination, validateDynamicData } = require('../middleware/validateSchema');
const { captureAuditContext, captureDocumentState } = require('../middleware/Audit');

const router = express.Router();

// Apply audit context capture to all routes
router.use(captureAuditContext);

// Static routes FIRST (before parameterized routes)
router.get('/:schemaName/count', schemaExists(), dynamicController.getRecordCount);
router.get('/:schemaName/search', schemaExists(), validatePagination, dynamicController.searchRecords);
router.get('/:schemaName/stats', schemaExists(), dynamicController.getRecordStats);
router.post('/:schemaName/bulk', schemaExists(), dynamicController.bulkCreateRecords);

// Parameterized routes LAST
router.get('/:schemaName', validatePagination, schemaExists(), dynamicController.getRecords);
router.get('/:schemaName/:recordId', schemaExists(), validateRecordId(), dynamicController.getRecordById);

// Create record (with audit logging built into service)
router.post('/:schemaName', 
  schemaExists(), 
  validateDynamicData, 
  dynamicController.createRecord
);

// Update record (with audit logging built into service)
router.put('/:schemaName/:recordId', 
  schemaExists(), 
  validateRecordId(), 
  validateDynamicData,
  captureDocumentState, // Capture state before update
  dynamicController.updateRecord
);

// Patch record (with audit logging built into service)
router.patch('/:schemaName/:recordId', 
  schemaExists(), 
  validateRecordId(),
  captureDocumentState, // Capture state before update
  dynamicController.patchRecord
);

// Delete record (with audit logging built into service)
router.delete('/:schemaName/:recordId', 
  schemaExists(), 
  validateRecordId(),
  captureDocumentState, // Capture state before deletion
  dynamicController.deleteRecord
);

module.exports = router;