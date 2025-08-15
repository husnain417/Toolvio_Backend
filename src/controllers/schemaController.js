const SchemaService = require('../services/SchemaService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Schema Controller
 * Handles all schema-related operations
 */
class SchemaController {
  /**
   * Get all schemas with optional filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllSchemas(req, res) {
    try {
      const { active } = req.query;
      const filters = {};
      
      if (active !== undefined) {
        filters.active = active === 'true';
      }

      const schemas = await SchemaService.getAllSchemas(filters);
      successResponse(res, schemas, 'Schemas retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get schema by name
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSchemaByName(req, res) {
    try {
      const { name } = req.params;
      const schema = await SchemaService.getSchemaByName(name);
      
      if (!schema) {
        return errorResponse(res, `Schema '${name}' not found`, 404);
      }

      successResponse(res, schema, 'Schema retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Create new schema
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createSchema(req, res) {
    try {
      const { name, displayName, description, collectionName, jsonSchema } = req.body;

      // Basic validation
      if (!name || !displayName || !jsonSchema) {
        return errorResponse(res, 'Name, displayName, and jsonSchema are required', 400);
      }

      const schema = await SchemaService.createSchema({
        name,
        displayName,
        description,
        collectionName,
        jsonSchema
      });

      successResponse(res, schema, 'Schema created successfully', 201);
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Update schema
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateSchema(req, res) {
    try {
      const { name } = req.params;
      const { displayName, description, jsonSchema } = req.body;

      const updatedSchema = await SchemaService.updateSchema(name, {
        displayName,
        description,
        jsonSchema
      });

      successResponse(res, updatedSchema, 'Schema updated successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Delete schema (soft delete)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteSchema(req, res) {
    try {
      const { name } = req.params;
      await SchemaService.deleteSchema(name);
      successResponse(res, null, 'Schema deleted successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Hot reload schema
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async hotReloadSchema(req, res) {
    try {
      const { name } = req.params;
      const reloaded = await SchemaService.hotReloadSchema(name);
      
      if (!reloaded) {
        return errorResponse(res, `Schema '${name}' not found or could not be reloaded`, 404);
      }

      successResponse(res, null, `Schema '${name}' reloaded successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get schema statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSchemaStats(req, res) {
    try {
      const { name } = req.params;
      const schema = await SchemaService.getSchemaByName(name);
      
      if (!schema) {
        return errorResponse(res, `Schema '${name}' not found`, 404);
      }

      // Get basic stats
      const stats = {
        name: schema.name,
        displayName: schema.displayName,
        version: schema.version,
        isActive: schema.isActive,
        createdAt: schema.createdAt,
        updatedAt: schema.updatedAt,
        collectionName: schema.collectionName
      };

      successResponse(res, stats, 'Schema statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Validate schema definition
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async validateSchemaDefinition(req, res) {
    try {
      const { jsonSchema } = req.body;

      if (!jsonSchema) {
        return errorResponse(res, 'JSON Schema is required', 400);
      }

      const schemaValidator = require('../utils/schemaValidator');
      const validation = schemaValidator.validateSchema(jsonSchema);

      if (validation.valid) {
        successResponse(res, { valid: true }, 'Schema definition is valid');
      } else {
        const errors = schemaValidator.formatErrors(validation.errors);
        errorResponse(res, 'Schema definition is invalid', 400, errors);
      }
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new SchemaController();
