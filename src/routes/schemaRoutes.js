const express = require('express');
const schemaController = require('../controllers/schemaController');
const { validateSchemaDefinition } = require('../middleware/validateSchema');

const router = express.Router();

// Get all schemas
router.get('/', schemaController.getAllSchemas);

// Get schema by name
router.get('/:name', schemaController.getSchemaByName);

// Create new schema
router.post('/', validateSchemaDefinition, schemaController.createSchema);

// Update schema
router.put('/:name', validateSchemaDefinition, schemaController.updateSchema);

// Delete schema (soft delete)
router.delete('/:name', schemaController.deleteSchema);

// Hot reload schema
router.post('/:name/reload', schemaController.hotReloadSchema);

// Get schema statistics
router.get('/:name/stats', schemaController.getSchemaStats);

// Validate schema definition
router.post('/validate', schemaController.validateSchemaDefinition);

module.exports = router;