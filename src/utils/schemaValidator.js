const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      removeAdditional: false,
      strict: false 
    });
    addFormats(this.ajv);
  }

  /**
   * Validate JSON Schema definition
   */
  validateSchema(jsonSchema) {
    try {
      // Basic structure validation
      if (!jsonSchema || typeof jsonSchema !== 'object') {
        return {
          valid: false,
          errors: [{ message: 'Schema must be an object' }]
        };
      }

      if (jsonSchema.type !== 'object') {
        return {
          valid: false,
          errors: [{ message: 'Schema type must be "object"' }]
        };
      }

      if (!jsonSchema.properties || typeof jsonSchema.properties !== 'object') {
        return {
          valid: false,
          errors: [{ message: 'Schema must have properties object' }]
        };
      }

      // Try to compile the schema
      const validate = this.ajv.compile(jsonSchema);
      
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: error.message }]
      };
    }
  }

  /**
   * Validate data against JSON Schema
   */
  validateData(jsonSchema, data) {
    try {
      const validate = this.ajv.compile(jsonSchema);
      const valid = validate(data);
      
      return {
        valid,
        errors: validate.errors || []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: error.message }]
      };
    }
  }

  /**
   * Format validation errors for better readability
   */
  formatErrors(errors) {
    return errors.map(error => ({
      field: error.instancePath || error.schemaPath || 'root',
      message: error.message,
      value: error.data
    }));
  }
}

module.exports = new SchemaValidator();