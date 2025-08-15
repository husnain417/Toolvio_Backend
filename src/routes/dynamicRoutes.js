const express = require('express');
const dynamicController = require('../controllers/dynamicController');
const { schemaExists, validateRecordId, validatePagination, validateDynamicData } = require('../middleware/validateSchema');

const router = express.Router();

// Static routes FIRST (before parameterized routes)
router.get('/:schemaName/count', schemaExists(), dynamicController.getRecordCount);
router.get('/:schemaName/search', schemaExists(), validatePagination, dynamicController.searchRecords);
router.get('/:schemaName/stats', schemaExists(), dynamicController.getRecordStats);
router.post('/:schemaName/bulk', schemaExists(), dynamicController.bulkCreateRecords);

// Parameterized routes LAST
router.get('/:schemaName', validatePagination, schemaExists(), dynamicController.getRecords);
router.get('/:schemaName/:recordId', schemaExists(), validateRecordId(), dynamicController.getRecordById);
router.post('/:schemaName', schemaExists(), validateDynamicData, dynamicController.createRecord);
router.put('/:schemaName/:recordId', schemaExists(), validateRecordId(), validateDynamicData, dynamicController.updateRecord);
router.patch('/:schemaName/:recordId', schemaExists(), validateRecordId(), dynamicController.patchRecord);
router.delete('/:schemaName/:recordId', schemaExists(), validateRecordId(), dynamicController.deleteRecord);

module.exports = router;