const CollectionGenerator = require('./CollectionGenerator');
const SchemaService = require('./SchemaService');
const AuditService = require('./AuditService');
const schemaValidator = require('../utils/schemaValidator');

class DynamicCrudService {
  /**
   * Create a new record with audit logging
   * @param {string} schemaName - Schema name
   * @param {Object} data - Record data
   * @param {Object} auditContext - Audit context (user info, etc.)
   * @returns {Promise<Object>} - Created record
   */
  async createRecord(schemaName, data, auditContext = {}) {
    console.log('=== DynamicCrudService.createRecord START ===');
    console.log('SchemaName:', schemaName);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    try {
      console.log('Step 1: Getting schema...');
      const schema = await SchemaService.getSchemaByName(schemaName);
      console.log('Schema found:', !!schema);
      
      if (!schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }
  
      console.log('Step 2: Validating data...');
      const validation = schemaValidator.validateData(schema.jsonSchema, data);
      console.log('Validation result:', validation);
      
      if (!validation.valid) {
        const errors = schemaValidator.formatErrors(validation.errors);
        throw new Error(`Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
      }
  
      console.log('Step 3: Getting dynamic model...');
      const Model = CollectionGenerator.getDynamicModel(schemaName);
      console.log('Model found:', !!Model);
      console.log('Model name:', Model?.modelName);
      
      if (!Model) {
        throw new Error(`Dynamic model for schema '${schemaName}' not found`);
      }
  
      console.log('Step 4: Adding schema name to data...');
      data._schemaName = schemaName;
      console.log('Data with schema name:', JSON.stringify(data, null, 2));
  
      console.log('Step 5: Creating record instance...');
      const record = new Model(data);
      console.log('Record instance created');
  
      console.log('Step 6: Saving record...');
      const savedRecord = await record.save();
      console.log('Record saved successfully');
  
      console.log('Step 7: Logging audit trail...');
      try {
        await AuditService.logChange({
          documentId: savedRecord._id,
          schemaName,
          collectionName: Model.collection.name,
          operation: 'create',
          previousState: null,
          currentState: savedRecord.toObject(),
          userId: auditContext.userId,
          userAgent: auditContext.userAgent,
          ipAddress: auditContext.ipAddress,
          metadata: {
            source: 'api',
            ...auditContext.metadata
          }
        });
        console.log('Audit trail logged successfully');
      } catch (auditError) {
        console.warn('Failed to log audit trail:', auditError.message);
        // Don't fail the operation if audit logging fails
      }
  
      console.log('Step 8: Converting to object...');
      const result = savedRecord.toObject();
      console.log('Final result:', JSON.stringify(result, null, 2));
  
      return result;
    } catch (error) {
      console.error('DynamicCrudService.createRecord ERROR:', error);
      throw error;
    }
  }

  /**
   * Update a record with audit logging
   * @param {string} schemaName - Schema name
   * @param {string} recordId - Record ID
   * @param {Object} updateData - Update data
   * @param {Object} auditContext - Audit context
   * @returns {Promise<Object|null>} - Updated record
   */
  async updateRecord(schemaName, recordId, updateData, auditContext = {}) {
    console.log('=== DynamicCrudService.updateRecord START ===');
    
    try {
      const schema = await SchemaService.getSchemaByName(schemaName);
      if (!schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }

      // Validate update data against JSON schema
      const validation = schemaValidator.validateData(schema.jsonSchema, updateData);
      if (!validation.valid) {
        const errors = schemaValidator.formatErrors(validation.errors);
        throw new Error(`Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
      }

      const Model = CollectionGenerator.getDynamicModel(schemaName);
      if (!Model) {
        throw new Error(`Dynamic model for schema '${schemaName}' not found`);
      }

      // Get current record state for audit
      const currentRecord = await Model.findOne({ _id: recordId, _schemaName: schemaName });
      if (!currentRecord) {
        throw new Error(`Record with ID '${recordId}' not found`);
      }

      const previousState = currentRecord.toObject();

      // Update record
      const updatedRecord = await Model.findOneAndUpdate(
        { _id: recordId, _schemaName: schemaName },
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!updatedRecord) {
        throw new Error(`Record with ID '${recordId}' not found`);
      }

      const currentState = updatedRecord.toObject();

      // Log audit trail
      try {
        await AuditService.logChange({
          documentId: recordId,
          schemaName,
          collectionName: Model.collection.name,
          operation: 'update',
          previousState,
          currentState,
          userId: auditContext.userId,
          userAgent: auditContext.userAgent,
          ipAddress: auditContext.ipAddress,
          metadata: {
            source: 'api',
            ...auditContext.metadata
          }
        });
        console.log('Update audit trail logged successfully');
      } catch (auditError) {
        console.warn('Failed to log update audit trail:', auditError.message);
      }

      return updatedRecord.toObject();
    } catch (error) {
      console.error('DynamicCrudService.updateRecord ERROR:', error);
      throw error;
    }
  }

  /**
   * Delete a record with audit logging
   * @param {string} schemaName - Schema name
   * @param {string} recordId - Record ID
   * @param {Object} auditContext - Audit context
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteRecord(schemaName, recordId, auditContext = {}) {
    console.log('=== DynamicCrudService.deleteRecord START ===');
    
    try {
      const schema = await SchemaService.getSchemaByName(schemaName);
      if (!schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }

      const Model = CollectionGenerator.getDynamicModel(schemaName);
      if (!Model) {
        throw new Error(`Dynamic model for schema '${schemaName}' not found`);
      }

      // Get current record state for audit
      const currentRecord = await Model.findOne({ _id: recordId, _schemaName: schemaName });
      if (!currentRecord) {
        throw new Error(`Record with ID '${recordId}' not found`);
      }

      const previousState = currentRecord.toObject();

      // Delete the record
      const result = await Model.findOneAndDelete({ _id: recordId, _schemaName: schemaName });
      
      if (!result) {
        throw new Error(`Record with ID '${recordId}' not found`);
      }

      // Log audit trail
      try {
        await AuditService.logChange({
          documentId: recordId,
          schemaName,
          collectionName: Model.collection.name,
          operation: 'delete',
          previousState,
          currentState: null,
          userId: auditContext.userId,
          userAgent: auditContext.userAgent,
          ipAddress: auditContext.ipAddress,
          metadata: {
            source: 'api',
            ...auditContext.metadata
          }
        });
        console.log('Delete audit trail logged successfully');
      } catch (auditError) {
        console.warn('Failed to log delete audit trail:', auditError.message);
      }

      return true;
    } catch (error) {
      console.error('DynamicCrudService.deleteRecord ERROR:', error);
      throw error;
    }
  }

  /**
   * Get records with pagination and filtering (unchanged)
   * @param {string} schemaName - Schema name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Records with pagination info
   */
  async getRecords(schemaName, options = {}) {
    const schema = await SchemaService.getSchemaByName(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    const Model = CollectionGenerator.getDynamicModel(schemaName);
    if (!Model) {
      throw new Error(`Dynamic model for schema '${schemaName}' not found`);
    }

    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
      filter = {}
    } = options;

    // Build query
    const query = { _schemaName: schemaName, ...filter };
    console.log('Final MongoDB query:', JSON.stringify(query, null, 2));
    console.log('Total documents in collection:', await Model.countDocuments({ _schemaName: schemaName }));

    // Calculate pagination
    const skip = (page - 1) * limit;
    const total = await Model.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Fetch records
    const records = await Model.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      records,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    };
  }

  /**
   * Get single record by ID (unchanged)
   * @param {string} schemaName - Schema name
   * @param {string} recordId - Record ID
   * @returns {Promise<Object|null>} - Record or null
   */
  async getRecordById(schemaName, recordId) {
    const schema = await SchemaService.getSchemaByName(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    const Model = CollectionGenerator.getDynamicModel(schemaName);
    if (!Model) {
      throw new Error(`Dynamic model for schema '${schemaName}' not found`);
    }

    const record = await Model.findOne({ _id: recordId, _schemaName: schemaName }).lean();
    return record;
  }

  /**
   * Bulk create records with audit logging
   * @param {string} schemaName - Schema name
   * @param {Array} recordsData - Array of record data
   * @param {Object} auditContext - Audit context
   * @returns {Promise<Array>} - Created records
   */
  async bulkCreateRecords(schemaName, recordsData, auditContext = {}) {
    console.log('=== DynamicCrudService.bulkCreateRecords START ===');
    
    try {
      const schema = await SchemaService.getSchemaByName(schemaName);
      if (!schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }

      if (!Array.isArray(recordsData) || recordsData.length === 0) {
        throw new Error('Records data must be a non-empty array');
      }

      // Validate all records
      const validationErrors = [];
      recordsData.forEach((data, index) => {
        const validation = schemaValidator.validateData(schema.jsonSchema, data);
        if (!validation.valid) {
          const errors = schemaValidator.formatErrors(validation.errors);
          validationErrors.push(`Record ${index}: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
      }

      const Model = CollectionGenerator.getDynamicModel(schemaName);
      if (!Model) {
        throw new Error(`Dynamic model for schema '${schemaName}' not found`);
      }

      // Add schema name to all records
      const recordsWithSchema = recordsData.map(data => ({
        ...data,
        _schemaName: schemaName
      }));

      // Bulk insert
      const createdRecords = await Model.insertMany(recordsWithSchema);
      const recordObjects = createdRecords.map(record => record.toObject());

      // Log audit trail for each created record
      try {
        const auditPromises = recordObjects.map(record => 
          AuditService.logChange({
            documentId: record._id,
            schemaName,
            collectionName: Model.collection.name,
            operation: 'create',
            previousState: null,
            currentState: record,
            userId: auditContext.userId,
            userAgent: auditContext.userAgent,
            ipAddress: auditContext.ipAddress,
            metadata: {
              source: 'api',
              bulkOperation: true,
              ...auditContext.metadata
            }
          })
        );

        await Promise.allSettled(auditPromises);
        console.log('Bulk create audit trails logged');
      } catch (auditError) {
        console.warn('Failed to log bulk create audit trails:', auditError.message);
      }

      return recordObjects;
    } catch (error) {
      console.error('DynamicCrudService.bulkCreateRecords ERROR:', error);
      throw error;
    }
  }

  /**
   * Get record count for a schema (unchanged)
   * @param {string} schemaName - Schema name
   * @param {Object} filter - Filter conditions
   * @returns {Promise<number>} - Record count
   */
  async getRecordCount(schemaName, filter = {}) {
    const schema = await SchemaService.getSchemaByName(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    const Model = CollectionGenerator.getDynamicModel(schemaName);
    if (!Model) {
      throw new Error(`Dynamic model for schema '${schemaName}' not found`);
    }

    const query = { _schemaName: schemaName, ...filter };
    return await Model.countDocuments(query);
  }

  /**
   * Get records with audit information
   * @param {string} schemaName - Schema name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Records with audit info
   */
  async getRecordsWithAudit(schemaName, options = {}) {
    const recordsResult = await this.getRecords(schemaName, options);
    
    // Get audit info for each record
    const recordsWithAudit = await Promise.allSettled(
      recordsResult.records.map(async (record) => {
        try {
          const auditHistory = await AuditService.getAuditHistory(
            record._id, 
            schemaName, 
            { page: 1, limit: 1 }
          );
          
          return {
            ...record,
            auditInfo: {
              totalVersions: auditHistory.pagination.totalRecords,
              lastModified: auditHistory.auditLogs[0]?.timestamp,
              lastModifiedBy: auditHistory.auditLogs[0]?.userId,
              canRevert: auditHistory.auditLogs[0]?.canRevert || false
            }
          };
        } catch (error) {
          return {
            ...record,
            auditInfo: {
              totalVersions: 0,
              lastModified: record.updatedAt,
              lastModifiedBy: null,
              canRevert: false
            }
          };
        }
      })
    );

    return {
      records: recordsWithAudit.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
      ),
      pagination: recordsResult.pagination
    };
  }
}

module.exports = new DynamicCrudService();