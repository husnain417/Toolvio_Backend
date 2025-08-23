const express = require('express');
const schemaController = require('../controllers/schemaController');
const { validateSchemaDefinition } = require('../middleware/validateSchema');
const { authenticate, authorize, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all schemas (requires schema read permission)
router.get('/', authenticate, authorize('schemas', 'read'), schemaController.getAllSchemas);

// Get schema by name (requires schema read permission)
router.get('/:name', authenticate, authorize('schemas', 'read'), schemaController.getSchemaByName);

// Create new schema (requires schema write permission + admin/office role)
router.post('/', 
  authenticate, 
  requireRole(['admin', 'office']), 
  authorize('schemas', 'write'), 
  validateSchemaDefinition, 
  schemaController.createSchema
);

// Update schema (requires schema write permission + admin/office role)
router.put('/:name', 
  authenticate, 
  requireRole(['admin', 'office']), 
  authorize('schemas', 'write'), 
  validateSchemaDefinition, 
  schemaController.updateSchema
);

// Delete schema (requires schema delete permission + admin role only)
router.delete('/:name', 
  authenticate, 
  requireRole(['admin']), 
  authorize('schemas', 'delete'), 
  schemaController.deleteSchema
);

// Hot reload schema (requires schema write permission + admin/office role)
router.post('/:name/reload', 
  authenticate, 
  requireRole(['admin', 'office']), 
  authorize('schemas', 'write'), 
  schemaController.hotReloadSchema
);

// Get schema statistics (requires schema read permission)
router.get('/:name/stats', 
  authenticate, 
  authorize('schemas', 'read'), 
  schemaController.getSchemaStats
);

// Validate schema definition (requires schema read permission)
router.post('/validate', 
  authenticate, 
  authorize('schemas', 'read'), 
  schemaController.validateSchemaDefinition
);

module.exports = router;