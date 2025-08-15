const mongoose = require('mongoose');

class CollectionGenerator {
  constructor() {
    this.dynamicModels = new Map();
  }

  /**
   * Generate MongoDB schema from JSON Schema
   * @param {Object} jsonSchema - JSON Schema definition
   * @returns {Object} - Mongoose schema definition
   */
  generateMongooseSchema(jsonSchema) {
    const mongooseSchema = {};

    if (jsonSchema.properties) {
      for (const [fieldName, fieldDef] of Object.entries(jsonSchema.properties)) {
        mongooseSchema[fieldName] = this.convertFieldType(fieldDef);
      }
    }

    // Add system fields
    mongooseSchema._schemaName = {
      type: String,
      required: true,
      index: true
    };
    mongooseSchema.createdAt = {
      type: Date,
      default: Date.now,
      index: true
    };
    mongooseSchema.updatedAt = {
      type: Date,
      default: Date.now
    };

    // Handle required fields from JSON Schema
    if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
      for (const requiredField of jsonSchema.required) {
        if (mongooseSchema[requiredField]) {
          mongooseSchema[requiredField].required = true;
        }
      }
    }

    return mongooseSchema;
  }

  /**
   * Convert JSON Schema field type to Mongoose type
   * @param {Object} fieldDef - JSON Schema field definition
   * @returns {Object} - Mongoose field definition
   */
  convertFieldType(fieldDef) {
    const mongooseField = {};

    // Handle different JSON Schema types
    switch (fieldDef.type) {
      case 'string':
        mongooseField.type = String;
        if (fieldDef.maxLength) mongooseField.maxlength = fieldDef.maxLength;
        if (fieldDef.minLength) mongooseField.minlength = fieldDef.minLength;
        if (fieldDef.pattern) mongooseField.match = new RegExp(fieldDef.pattern);
        if (fieldDef.enum) mongooseField.enum = fieldDef.enum;
        break;

      case 'number':
      case 'integer':
        mongooseField.type = Number;
        if (fieldDef.minimum !== undefined) mongooseField.min = fieldDef.minimum;
        if (fieldDef.maximum !== undefined) mongooseField.max = fieldDef.maximum;
        break;

      case 'boolean':
        mongooseField.type = Boolean;
        break;

      case 'array':
        mongooseField.type = [this.convertFieldType(fieldDef.items || { type: 'string' })];
        break;

      case 'object':
        mongooseField.type = mongoose.Schema.Types.Mixed;
        break;

      default:
        mongooseField.type = mongoose.Schema.Types.Mixed;
    }

    // Handle common properties
    if (fieldDef.default !== undefined) {
      mongooseField.default = fieldDef.default;
    }

    // Required field validation is handled at the schema level
    // based on the JSON Schema 'required' array

    return mongooseField;
  }

  /**
   * Create or update dynamic model for a schema
   * @param {Object} schemaDefinition - Schema definition from database
   * @returns {Object} - Mongoose model
   */
  createDynamicModel(schemaDefinition) {
    const { name, collectionName, jsonSchema } = schemaDefinition;

    // Remove existing model if it exists
    if (mongoose.models[name]) {
      delete mongoose.models[name];
    }

    // Generate Mongoose schema
    const mongooseSchemaDefinition = this.generateMongooseSchema(jsonSchema);
    const mongooseSchema = new mongoose.Schema(mongooseSchemaDefinition, {
      collection: collectionName,
      timestamps: false // We handle timestamps manually
    });

    // Add pre-save middleware to update timestamps
    mongooseSchema.pre('save', function(next) {
      if (this.isModified()) {
        this.updatedAt = new Date();
      }
      next();
    });

    // Create and cache the model
    const model = mongoose.model(name, mongooseSchema);
    this.dynamicModels.set(name, model);

    return model;
  }

  /**
   * Get dynamic model by schema name
   * @param {string} schemaName - Name of the schema
   * @returns {Object|null} - Mongoose model or null if not found
   */
  getDynamicModel(schemaName) {
    return this.dynamicModels.get(schemaName) || mongoose.models[schemaName] || null;
  }

  /**
   * Remove dynamic model
   * @param {string} schemaName - Name of the schema
   */
  removeDynamicModel(schemaName) {
    if (mongoose.models[schemaName]) {
      delete mongoose.models[schemaName];
    }
    this.dynamicModels.delete(schemaName);
  }

  /**
   * Check if collection exists
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<boolean>} - True if collection exists
   */
  async collectionExists(collectionName) {
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      return collections.some(col => col.name === collectionName);
    } catch (error) {
      console.error('Error checking collection existence:', error);
      return false;
    }
  }
}

module.exports = new CollectionGenerator();