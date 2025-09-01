const express = require('express');
const schemaController = require('../controllers/schemaController');
const { validateSchemaDefinition } = require('../middleware/validateSchema');
const { authenticate, authorize, requireRole, requireTenantAccess } = require('../middleware/auth');

const router = express.Router();

// Get all schemas (requires schema read permission + tenant access)
router.get('/', authenticate, requireTenantAccess, authorize('schemas', 'read'), schemaController.getAllSchemas);

// Get schema by name (requires schema read permission + tenant access)
router.get('/:name', authenticate, requireTenantAccess, authorize('schemas', 'read'), schemaController.getSchemaByName);

// Create new schema (requires schema write permission + admin role only + tenant access)
router.post('/', 
  authenticate, 
  requireTenantAccess,
  requireRole(['admin']), 
  authorize('schemas', 'write'), 
  validateSchemaDefinition, 
  schemaController.createSchema
);

// Update schema (requires schema write permission + admin role only + tenant access)
router.put('/:name', 
  authenticate, 
  requireTenantAccess,
  requireRole(['admin']), 
  authorize('schemas', 'write'), 
  validateSchemaDefinition, 
  schemaController.updateSchema
);

// Delete schema (requires schema delete permission + admin role only + tenant access)
router.delete('/:name', 
  authenticate, 
  requireTenantAccess,
  requireRole(['admin']), 
  authorize('schemas', 'delete'), 
  schemaController.deleteSchema
);

// Hot reload schema (requires schema write permission + admin role only + tenant access)
router.post('/:name/reload', 
  authenticate, 
  requireTenantAccess,
  requireRole(['admin']), 
  authorize('schemas', 'write'), 
  schemaController.hotReloadSchema
);

// Get schema statistics (requires schema read permission + tenant access)
router.get('/:name/stats', 
  authenticate, 
  requireTenantAccess,
  authorize('schemas', 'read'), 
  schemaController.getSchemaStats
);

// Validate schema definition (requires schema read permission + tenant access)
router.post('/validate', 
  authenticate, 
  requireTenantAccess,
  authorize('schemas', 'read'), 
  schemaController.validateSchemaDefinition
);

module.exports = router;