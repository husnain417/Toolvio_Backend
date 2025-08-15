const SchemaDefinition = require('../models/Schema');
const CollectionGenerator = require('./CollectionGenerator');
const schemaValidator = require('../utils/schemaValidator');

class SchemaService {
  /**
   * Create a new schema definition
   * @param {Object} schemaData - Schema data
   * @returns {Promise<Object>} - Created schema
   */
  async createSchema(schemaData) {
    const { name, displayName, description, jsonSchema } = schemaData;

    // Validate JSON Schema
    const validation = schemaValidator.validateSchema(jsonSchema);
    if (!validation.valid) {
      throw new Error(`Invalid JSON Schema: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Check if schema name already exists
    const existingSchema = await SchemaDefinition.findOne({ name });
    if (existingSchema) {
      throw new Error(`Schema with name '${name}' already exists`);
    }

    // Create schema definition
    const schema = new SchemaDefinition({
      name,
      displayName,
      description,
      jsonSchema
    });

    await schema.save();

    // Generate dynamic model
    CollectionGenerator.createDynamicModel(schema);

    return schema;
  }

  /**
   * Get all schema definitions
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} - Array of schemas
   */
  async getAllSchemas(filters = {}) {
    const query = {};
    
    if (filters.active !== undefined) {
      query.isActive = filters.active;
    }

    return await SchemaDefinition.find(query)
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get schema by name
   * @param {string} name - Schema name
   * @returns {Promise<Object|null>} - Schema definition or null
   */
  async getSchemaByName(name) {
    return await SchemaDefinition.findOne({ name, isActive: true }).lean();
  }

  /**
   * Update schema definition
   * @param {string} name - Schema name
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated schema
   */
  async updateSchema(name, updateData) {
    const { displayName, description, jsonSchema } = updateData;

    // Find existing schema
    const existingSchema = await SchemaDefinition.findOne({ name });
    if (!existingSchema) {
      throw new Error(`Schema '${name}' not found`);
    }

    // Validate new JSON Schema if provided
    if (jsonSchema) {
      const validation = schemaValidator.validateSchema(jsonSchema);
      if (!validation.valid) {
        throw new Error(`Invalid JSON Schema: ${validation.errors.map(e => e.message).join(', ')}`);
      }
    }

    // Update schema
    const updateFields = {};
    if (displayName) updateFields.displayName = displayName;
    if (description) updateFields.description = description;
    if (jsonSchema) updateFields.jsonSchema = jsonSchema;

    const updatedSchema = await SchemaDefinition.findOneAndUpdate(
      { name },
      updateFields,
      { new: true, runValidators: true }
    );

    // Regenerate dynamic model if schema changed
    if (jsonSchema) {
      CollectionGenerator.removeDynamicModel(name);
      CollectionGenerator.createDynamicModel(updatedSchema);
    }

    return updatedSchema;
  }

  /**
   * Delete schema definition
   * @param {string} name - Schema name
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteSchema(name) {
    const schema = await SchemaDefinition.findOne({ name });
    if (!schema) {
      throw new Error(`Schema '${name}' not found`);
    }

    // Soft delete - mark as inactive
    await SchemaDefinition.findOneAndUpdate(
      { name },
      { isActive: false }
    );

    // Remove dynamic model
    CollectionGenerator.removeDynamicModel(name);

    return true;
  }

  /**
   * Initialize dynamic models for existing schemas
   */
  async initializeDynamicModels() {
    try {
      const schemas = await SchemaDefinition.find({ isActive: true });
      
      for (const schema of schemas) {
        CollectionGenerator.createDynamicModel(schema);
        console.log(`✅ Initialized dynamic model for schema: ${schema.name}`);
      }
      
      console.log(`🔄 Loaded ${schemas.length} dynamic schemas`);
    } catch (error) {
      console.error('❌ Error initializing dynamic models:', error);
    }
  }

  /**
   * Hot reload a specific schema
   * @param {string} name - Schema name
   * @returns {Promise<boolean>} - True if reloaded
   */
  async hotReloadSchema(name) {
    const schema = await this.getSchemaByName(name);
    if (!schema) {
      return false;
    }

    CollectionGenerator.removeDynamicModel(name);
    CollectionGenerator.createDynamicModel(schema);
    
    console.log(`🔄 Hot reloaded schema: ${name}`);
    return true;
  }
}

module.exports = new SchemaService();