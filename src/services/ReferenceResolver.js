const SchemaService = require('./SchemaService');
const CollectionGenerator = require('./CollectionGenerator');

/**
 * Service to resolve references between schemas
 * Handles x-ref properties, reference validation, and data population
 */
class ReferenceResolver {
  constructor() {
    this.cache = new Map(); // Cache for resolved references
  }

  /**
   * Extract references from JSON Schema (updated for x-ref)
   * @param {Object} jsonSchema - JSON Schema definition
   * @returns {Object} - Object mapping field names to reference info
   */
  extractReferences(jsonSchema) {
    const references = {};
    
    if (jsonSchema.properties) {
      for (const [fieldName, fieldDef] of Object.entries(jsonSchema.properties)) {
        // Check for x-ref property
        if (fieldDef['x-ref']) {
          references[fieldName] = {
            schemaName: fieldDef['x-ref'],
            isArray: fieldDef['x-ref-type'] === 'array' || fieldDef.type === 'array'
          };
        }
        
        // Check array items for x-ref
        if (fieldDef.type === 'array' && fieldDef.items && fieldDef.items['x-ref']) {
          references[fieldName] = {
            schemaName: fieldDef.items['x-ref'],
            isArray: true
          };
        }
      }
    }
    
    return references;
  }

  /**
   * Parse schema references from JSON Schema (updated for x-ref)
   * @param {Object} jsonSchema - JSON Schema definition
   * @returns {Array} - Array of reference definitions
   */
  parseSchemaReferences(jsonSchema) {
    const references = [];
    
    if (!jsonSchema || !jsonSchema.properties) {
      return references;
    }

    for (const [fieldName, fieldDef] of Object.entries(jsonSchema.properties)) {
      // Check for x-ref property
      if (fieldDef['x-ref']) {
        references.push({
          field: fieldName,
          referencedSchema: fieldDef['x-ref'],
          referenceType: fieldDef['x-ref-type'] === 'array' || fieldDef.type === 'array' ? 'array_reference' : 'reference',
          isRequired: jsonSchema.required && jsonSchema.required.includes(fieldName)
        });
      }
      
      // Check array items for x-ref
      if (fieldDef.type === 'array' && fieldDef.items && fieldDef.items['x-ref']) {
        references.push({
          field: fieldName,
          referencedSchema: fieldDef.items['x-ref'],
          referenceType: 'array_reference',
          isRequired: jsonSchema.required && jsonSchema.required.includes(fieldName)
        });
      }

      // Keep backward compatibility with $ref (optional)
      if (fieldDef.$ref) {
        const refPath = fieldDef.$ref;
        let referencedSchema = '';
        
        if (refPath.startsWith('#/definitions/')) {
          referencedSchema = refPath.replace('#/definitions/', '');
        } else if (refPath.startsWith('#/')) {
          referencedSchema = refPath.replace('#/', '');
        } else {
          referencedSchema = refPath;
        }
        
        if (referencedSchema) {
          references.push({
            field: fieldName,
            referencedSchema: referencedSchema,
            referenceType: Array.isArray(fieldDef.type) ? 'array_reference' : 'reference',
            isRequired: jsonSchema.required && jsonSchema.required.includes(fieldName)
          });
        }
      }
    }
    
    return references;
  }

  /**
   * Resolve references in a record
   * @param {string} schemaName - Source schema name
   * @param {Object} record - Record data
   * @param {Array} populateFields - Fields to populate
   * @returns {Promise<Object>} - Record with resolved references
   */
  async resolveReferences(schemaName, record, populateFields = []) {
    try {
      const schema = await SchemaService.getSchemaByName(schemaName);
      if (!schema || !schema.relationships || schema.relationships.length === 0) {
        return record;
      }

      const resolvedRecord = { ...record };
      
      for (const relationship of schema.relationships) {
        const { field, referencedSchema, referenceType } = relationship;
        
        // Only populate if field is requested or if it's a required reference
        if (populateFields.length === 0 || populateFields.includes(field) || relationship.isRequired) {
          if (referenceType === 'array_reference') {
            // Handle array of references
            if (Array.isArray(record[field])) {
              resolvedRecord[field] = await this.resolveArrayReferences(referencedSchema, record[field]);
            }
          } else {
            // Handle single reference
            if (record[field]) {
              resolvedRecord[field] = await this.resolveSingleReference(referencedSchema, record[field]);
            }
          }
        }
      }
      
      return resolvedRecord;
    } catch (error) {
      console.error(`Error resolving references for schema ${schemaName}:`, error);
      return record; // Return original record if resolution fails
    }
  }

  /**
   * Resolve a single reference
   * @param {string} referencedSchema - Schema name to resolve
   * @param {string} recordId - Record ID to resolve
   * @returns {Promise<Object|null>} - Resolved record or null
   */
  async resolveSingleReference(referencedSchema, recordId) {
    try {
      const Model = CollectionGenerator.getDynamicModel(referencedSchema);
      if (!Model) {
        console.warn(`Model not found for schema: ${referencedSchema}`);
        return null;
      }
      
      const referencedRecord = await Model.findById(recordId).lean();
      return referencedRecord;
    } catch (error) {
      console.error(`Error resolving reference to ${referencedSchema}:${recordId}:`, error);
      return null;
    }
  }

  /**
   * Resolve an array of references
   * @param {string} referencedSchema - Schema name to resolve
   * @param {Array} recordIds - Array of record IDs to resolve
   * @returns {Promise<Array>} - Array of resolved records
   */
  async resolveArrayReferences(referencedSchema, recordIds) {
    try {
      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        return [];
      }
      
      const Model = CollectionGenerator.getDynamicModel(referencedSchema);
      if (!Model) {
        console.warn(`Model not found for schema: ${referencedSchema}`);
        return [];
      }
      
      const referencedRecords = await Model.find({
        _id: { $in: recordIds }
      }).lean();
      
      return referencedRecords;
    } catch (error) {
      console.error(`Error resolving array references to ${referencedSchema}:`, error);
      return [];
    }
  }

  /**
   * Validate that referenced records exist
   * @param {string} schemaName - Source schema name
   * @param {Object} data - Data to validate
   * @returns {Promise<Object>} - Validation result
   */
  async validateReferences(schemaName, data) {
    try {
      const schema = await SchemaService.getSchemaByName(schemaName);
      if (!schema || !schema.relationships || schema.relationships.length === 0) {
        return { valid: true, errors: [] };
      }

      const errors = [];
      
      for (const relationship of schema.relationships) {
        const { field, referencedSchema, referenceType, isRequired } = relationship;
        const fieldValue = data[field];
        
        // Check required references
        if (isRequired && !fieldValue) {
          errors.push({
            field,
            message: `Required reference field '${field}' is missing`
          });
          continue;
        }
        
        if (fieldValue) {
          if (referenceType === 'array_reference') {
            // Validate array of references
            if (!Array.isArray(fieldValue)) {
              errors.push({
                field,
                message: `Field '${field}' must be an array for array reference type`
              });
            } else {
              const validationResult = await this.validateArrayReferences(referencedSchema, fieldValue);
              errors.push(...validationResult.errors);
            }
          } else {
            // Validate single reference
            const validationResult = await this.validateSingleReference(referencedSchema, fieldValue);
            if (!validationResult.valid) {
              errors.push({
                field,
                message: `Referenced record '${fieldValue}' not found in schema '${referencedSchema}'`
              });
            }
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error(`Error validating references for schema ${schemaName}:`, error);
      return {
        valid: false,
        errors: [{ message: `Reference validation error: ${error.message}` }]
      };
    }
  }

  /**
   * Validate a single reference exists
   * @param {string} referencedSchema - Schema name to validate
   * @param {string} recordId - Record ID to validate
   * @returns {Promise<Object>} - Validation result
   */
  async validateSingleReference(referencedSchema, recordId) {
    try {
      const Model = CollectionGenerator.getDynamicModel(referencedSchema);
      if (!Model) {
        return { valid: false };
      }
      
      const record = await Model.findById(recordId);
      return { valid: !!record };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Validate array of references exist
   * @param {string} referencedSchema - Schema name to validate
   * @param {Array} recordIds - Array of record IDs to validate
   * @returns {Promise<Object>} - Validation result
   */
  async validateArrayReferences(referencedSchema, recordIds) {
    try {
      if (!Array.isArray(recordIds)) {
        return { valid: false, errors: [{ message: 'Field must be an array' }] };
      }
      
      const Model = CollectionGenerator.getDynamicModel(referencedSchema);
      if (!Model) {
        return { valid: false, errors: [{ message: `Schema '${referencedSchema}' not found` }] };
      }
      
      const foundRecords = await Model.find({
        _id: { $in: recordIds }
      }).select('_id');
      
      const foundIds = foundRecords.map(r => r._id.toString());
      const missingIds = recordIds.filter(id => !foundIds.includes(id.toString()));
      
      if (missingIds.length > 0) {
        return {
          valid: false,
          errors: [{
            message: `Referenced records not found: ${missingIds.join(', ')}`
          }]
        };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: `Array reference validation error: ${error.message}` }]
      };
    }
  }

  /**
   * Clear reference cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new ReferenceResolver();