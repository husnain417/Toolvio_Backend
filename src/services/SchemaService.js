const SchemaDefinition = require('../models/Schema');
const CollectionGenerator = require('./CollectionGenerator');
const schemaValidator = require('../utils/schemaValidator');

class SchemaService {
  /**
   * Create a new schema definition
   * @param {Object} schemaData - Schema data
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} - Created schema
   */
  async createSchema(schemaData, tenantId) {
    const { name, displayName, description, jsonSchema } = schemaData;

    // Validate JSON Schema
    const validation = schemaValidator.validateSchema(jsonSchema);
    if (!validation.valid) {
      throw new Error(`Invalid JSON Schema: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Check if schema name already exists within tenant
    const existingSchema = await SchemaDefinition.findOne({ tenantId, name });
    if (existingSchema) {
      throw new Error(`Schema with name '${name}' already exists in this tenant`);
    }

    // Create schema definition
    const schema = new SchemaDefinition({
      tenantId,
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
   * Get all schema definitions for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} - Array of schemas
   */
  async getAllSchemas(tenantId, filters = {}) {
    const query = { tenantId };
    
    if (filters.active !== undefined) {
      query.isActive = filters.active;
    }

    return await SchemaDefinition.find(query)
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get all schema definitions across all tenants (for system-wide operations)
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} - Array of schemas
   */
  async getAllSchemasSystemWide(filters = {}) {
    const query = {};
    
    if (filters.active !== undefined) {
      query.isActive = filters.active;
    }

    return await SchemaDefinition.find(query)
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get schema by name within a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} name - Schema name
   * @returns {Promise<Object|null>} - Schema definition or null
   */
  async getSchemaByName(tenantId, name) {
    return await SchemaDefinition.findOne({ tenantId, name, isActive: true }).lean();
  }

  /**
   * Get schema by name across all tenants (for system-wide operations)
   * @param {string} name - Schema name
   * @returns {Promise<Object|null>} - Schema definition or null
   */
  async getSchemaByNameSystemWide(name) {
    return await SchemaDefinition.findOne({ name, isActive: true }).lean();
  }

  /**
   * Update schema definition
   * @param {string} tenantId - Tenant ID
   * @param {string} name - Schema name
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated schema
   */
  async updateSchema(tenantId, name, updateData) {
    const { displayName, description, jsonSchema } = updateData;

    // Find existing schema within tenant
    const existingSchema = await SchemaDefinition.findOne({ tenantId, name });
    if (!existingSchema) {
      throw new Error(`Schema '${name}' not found in this tenant`);
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
      { tenantId, name },
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
   * @param {string} tenantId - Tenant ID
   * @param {string} name - Schema name
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteSchema(tenantId, name) {
    const schema = await SchemaDefinition.findOne({ tenantId, name });
    if (!schema) {
      throw new Error(`Schema '${name}' not found in this tenant`);
    }

    // Hard delete - completely remove the schema
    await SchemaDefinition.findOneAndDelete({ tenantId, name });
    
    // Also remove the dynamic collection if it exists
    try {
      const Model = CollectionGenerator.getDynamicModel(name);
      if (Model) {
        await Model.collection.drop();
        console.log(`🗑️  Dropped collection for schema: ${name}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not drop collection for schema ${name}:`, error.message);
    }

    // Remove dynamic model from memory
    CollectionGenerator.removeDynamicModel(name);

    console.log(`✅ Schema '${name}' deleted successfully`);
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
   * @param {string} tenantId - Tenant ID
   * @param {string} name - Schema name
   * @returns {Promise<boolean>} - True if reloaded
   */
  async hotReloadSchema(tenantId, name) {
    const schema = await this.getSchemaByName(tenantId, name);
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