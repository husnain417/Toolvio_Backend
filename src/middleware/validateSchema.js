const SchemaService = require('../services/SchemaService');
const { errorResponse } = require('../utils/responseHelper');

/**
 * Clean and working schemaExists middleware
 */
const schemaExists = (paramName = 'schemaName') => {
  return async (req, res, next) => {
    console.log('=== SCHEMA EXISTS MIDDLEWARE START ===');
    
    try {
      const schemaName = req.params[paramName];
      
      if (!schemaName) {
        console.log('ERROR: Schema name missing');
        return res.status(400).json({
          success: false,
          error: 'Schema name is required'
        });
      }

      console.log('Getting schema:', schemaName);
      const schema = await SchemaService.getSchemaByName(schemaName);
      
      if (!schema) {
        console.log('ERROR: Schema not found');
        return res.status(404).json({
          success: false,
          error: `Schema '${schemaName}' not found`
        });
      }

      console.log('Schema found, attaching to request');
      req.schemaDefinition = schema;
      
      console.log('=== SCHEMA EXISTS MIDDLEWARE END - CALLING NEXT ===');
      next();
      
    } catch (error) {
      console.error('Schema middleware error:', error.message);
      return res.status(500).json({
        success: false,
        error: `Schema check error: ${error.message}`
      });
    }
  };
};

/**
 * Clean and working validateDynamicData middleware
 */
const validateDynamicData = async (req, res, next) => {
  console.log('=== VALIDATE DYNAMIC DATA MIDDLEWARE START ===');
  
  try {
    // Check schema exists
    if (!req.schemaDefinition) {
      console.log('ERROR: No schema definition in request');
      return res.status(500).json({
        success: false,
        error: 'Schema not found in request context'
      });
    }

    // Check data exists
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      console.log('ERROR: No data in request body');
      return res.status(400).json({
        success: false,
        error: 'Request body cannot be empty'
      });
    }

    console.log('Validating data against schema...');
    
    // Load validator and validate
    const schemaValidator = require('../utils/schemaValidator');
    const validation = schemaValidator.validateData(req.schemaDefinition.jsonSchema, data);
    
    if (!validation.valid) {
      console.log('Validation failed');
      const errors = schemaValidator.formatErrors(validation.errors);
      return res.status(400).json({
        success: false,
        error: 'Data validation failed',
        details: errors
      });
    }

    // Attach validated data
    console.log('Validation passed, attaching data to request');
    req.validatedData = data;
    
    console.log('=== VALIDATE DYNAMIC DATA MIDDLEWARE END - CALLING NEXT ===');
    next();
    
  } catch (error) {
    console.error('Validation middleware error:', error.message);
    return res.status(500).json({
      success: false,
      error: `Data validation error: ${error.message}`
    });
  }
};

/**
 * Validate record ID format
 */
const validateRecordId = (paramName = 'recordId') => {
  return (req, res, next) => {
    console.log('=== VALIDATE RECORD ID MIDDLEWARE START ===');
    
    const recordId = req.params[paramName];
    
    if (!recordId) {
      return res.status(400).json({
        success: false,
        error: 'Record ID is required'
      });
    }

    // Validate MongoDB ObjectId format
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(recordId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid record ID format'
      });
    }

    console.log('Record ID validation passed');
    next();
  };
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  console.log('=== VALIDATE PAGINATION MIDDLEWARE START ===');
  
  try {
    const { page, limit } = req.query;
    
    if (page !== undefined) {
      const pageNum = parseInt(page);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({
          success: false,
          error: 'Page must be a positive integer'
        });
      }
    }

    if (limit !== undefined) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be between 1 and 100'
        });
      }
    }

    console.log('Pagination validation passed');
    next();
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Pagination validation error: ${error.message}`
    });
  }
};
/**
 * Validate schema definition (for schema creation/updates)
 */
const validateSchemaDefinition = (req, res, next) => {
  console.log('=== VALIDATE SCHEMA DEFINITION MIDDLEWARE START ===');
  
  try {
    // Get name from params (for update) or body (for create)
    const name = req.params.name || req.body.name;
    const { displayName, jsonSchema } = req.body;
    
    // Basic required field validation
    if (!name || !displayName || !jsonSchema) {
      return res.status(400).json({
        success: false,
        error: 'Name, displayName, and jsonSchema are required'
      });
    }

    // Validate schema name format
    const nameRegex = /^[a-z][a-z0-9_]*$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({
        success: false,
        error: 'Schema name must start with letter and contain only lowercase letters, numbers, and underscores'
      });
    }

    // Validate JSON Schema structure
    const schemaValidator = require('../utils/schemaValidator');
    const validation = schemaValidator.validateSchema(jsonSchema);
    
    if (!validation.valid) {
      const errors = validation.errors.map(e => e.message);
      return res.status(400).json({
        success: false,
        error: `Invalid JSON Schema: ${errors.join(', ')}`
      });
    }

    console.log('Schema definition validation passed');
    next();
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Schema validation error: ${error.message}`
    });
  }
};

module.exports = {
  schemaExists,
  validateDynamicData,
  validateRecordId,
  validatePagination,
  validateSchemaDefinition
};