const SchemaService = require('./SchemaService');
const CollectionGenerator = require('./CollectionGenerator');
const ReferenceResolver = require('./ReferenceResolver');

/**
 * Service to handle change propagation when referenced records are updated
 * Automatically updates dependent records to maintain data consistency
 */
class ChangePropagation {
  constructor() {
    this.dependencyCache = new Map(); // Cache for dependency tracking
  }

  /**
   * Track dependencies between records
   * @param {string} schemaName - Schema name
   * @param {string} recordId - Record ID
   * @param {Object} recordData - Record data with references
   * @returns {Promise<void>}
   */
  async trackDependencies(schemaName, recordId, recordData) {
    try {
      const schema = await SchemaService.getSchemaByName(schemaName);
      if (!schema || !schema.relationships || schema.relationships.length === 0) {
        return;
      }

      const dependencies = [];
      
      for (const relationship of schema.relationships) {
        const { field, referencedSchema } = relationship;
        const fieldValue = recordData[field];
        
        if (fieldValue) {
          if (Array.isArray(fieldValue)) {
            // Array of references
            for (const refId of fieldValue) {
              dependencies.push({
                sourceSchema: schemaName,
                sourceRecordId: recordId,
                targetSchema: referencedSchema,
                targetRecordId: refId,
                relationshipType: 'array_reference',
                field: field
              });
            }
          } else {
            // Single reference
            dependencies.push({
              sourceSchema: schemaName,
              sourceRecordId: recordId,
              targetSchema: referencedSchema,
              targetRecordId: fieldValue,
              relationshipType: 'reference',
              field: field
            });
          }
        }
      }

      // Store dependencies for later use
      if (dependencies.length > 0) {
        this.dependencyCache.set(`${schemaName}:${recordId}`, dependencies);
      }
    } catch (error) {
      console.error(`Error tracking dependencies for ${schemaName}:${recordId}:`, error);
    }
  }

  /**
   * Find records that reference a specific record
   * @param {string} schemaName - Schema name of the referenced record
   * @param {string} recordId - ID of the referenced record
   * @returns {Promise<Array>} - Array of dependent records
   */
  async findDependentRecords(schemaName, recordId) {
    try {
      const dependentRecords = [];
      
      // Get all schemas to check for references
      const allSchemas = await SchemaService.getAllSchemas({ active: true });
      
      for (const schema of allSchemas) {
        if (schema.relationships && schema.relationships.length > 0) {
          const dependentSchema = schema.name;
          const Model = CollectionGenerator.getDynamicModel(dependentSchema);
          
          if (!Model) continue;
          
          // Find records that reference this record
          for (const relationship of schema.relationships) {
            if (relationship.referencedSchema === schemaName) {
              const query = {};
              
              if (relationship.referenceType === 'array_reference') {
                // Array reference - check if recordId is in the array
                query[relationship.field] = { $in: [recordId] };
              } else {
                // Single reference - check if field equals recordId
                query[relationship.field] = recordId;
              }
              
              const dependentRecordsInSchema = await Model.find(query).lean();
              
              for (const record of dependentRecordsInSchema) {
                dependentRecords.push({
                  schemaName: dependentSchema,
                  recordId: record._id,
                  field: relationship.field,
                  relationshipType: relationship.referenceType,
                  record: record
                });
              }
            }
          }
        }
      }
      
      return dependentRecords;
    } catch (error) {
      console.error(`Error finding dependent records for ${schemaName}:${recordId}:`, error);
      return [];
    }
  }

  /**
   * Propagate changes to dependent records
   * @param {string} schemaName - Schema name of the changed record
   * @param {string} recordId - ID of the changed record
   * @param {Object} changes - Changes made to the record
   * @returns {Promise<Object>} - Propagation result
   */
  async propagateChanges(schemaName, recordId, changes) {
    try {
      console.log(`🔄 Propagating changes for ${schemaName}:${recordId}`);
      
      const dependentRecords = await this.findDependentRecords(schemaName, recordId);
      
      if (dependentRecords.length === 0) {
        console.log(`✅ No dependent records found for ${schemaName}:${recordId}`);
        return {
          propagated: 0,
          errors: [],
          dependentRecords: []
        };
      }

      const propagationResults = [];
      const errors = [];
      
      for (const dependentRecord of dependentRecords) {
        try {
          const result = await this.updateDependentRecord(dependentRecord, changes);
          propagationResults.push(result);
        } catch (error) {
          console.error(`Error propagating to ${dependentRecord.schemaName}:${dependentRecord.recordId}:`, error);
          errors.push({
            schemaName: dependentRecord.schemaName,
            recordId: dependentRecord.recordId,
            error: error.message
          });
        }
      }
      
      console.log(`✅ Propagated changes to ${propagationResults.length} dependent records`);
      
      return {
        propagated: propagationResults.length,
        errors: errors,
        dependentRecords: dependentRecords.map(dr => ({
          schemaName: dr.schemaName,
          recordId: dr.recordId,
          field: dr.field,
          relationshipType: dr.relationshipType
        }))
      };
    } catch (error) {
      console.error(`Error propagating changes for ${schemaName}:${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Update a dependent record with propagated changes
   * @param {Object} dependentRecord - Dependent record info
   * @param {Object} changes - Changes to propagate
   * @returns {Promise<Object>} - Update result
   */
  async updateDependentRecord(dependentRecord, changes) {
    try {
      const { schemaName, recordId, field, relationshipType } = dependentRecord;
      const Model = CollectionGenerator.getDynamicModel(schemaName);
      
      if (!Model) {
        throw new Error(`Model not found for schema ${schemaName}`);
      }
      
      // Get the current record
      const currentRecord = await Model.findById(recordId);
      if (!currentRecord) {
        throw new Error(`Dependent record ${recordId} not found`);
      }
      
      // Determine what to update based on the relationship type
      let updateData = {};
      
      if (relationshipType === 'array_reference') {
        // For array references, we might want to update metadata or trigger recalculation
        // This is schema-specific logic
        updateData = {
          [`${field}_lastUpdated`]: new Date(),
          [`${field}_version`]: (currentRecord[`${field}_version`] || 0) + 1
        };
      } else {
        // For single references, we might want to update metadata
        updateData = {
          [`${field}_lastUpdated`]: new Date(),
          [`${field}_version`]: (currentRecord[`${field}_version`] || 0) + 1
        };
      }
      
      // Update the dependent record
      const updatedRecord = await Model.findByIdAndUpdate(
        recordId,
        { $set: updateData },
        { new: true }
      );
      
      return {
        schemaName,
        recordId,
        field,
        updated: true,
        changes: updateData
      };
    } catch (error) {
      console.error(`Error updating dependent record:`, error);
      throw error;
    }
  }

  /**
   * Get dependency statistics
   * @returns {Object} - Dependency statistics
   */
  getDependencyStats() {
    const totalDependencies = this.dependencyCache.size;
    const totalRelationships = Array.from(this.dependencyCache.values())
      .reduce((sum, deps) => sum + deps.length, 0);
    
    return {
      totalDependencies,
      totalRelationships,
      cacheSize: this.dependencyCache.size
    };
  }

  /**
   * Clear dependency cache
   */
  clearCache() {
    this.dependencyCache.clear();
  }
}

module.exports = new ChangePropagation();
