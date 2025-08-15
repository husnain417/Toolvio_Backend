const CollectionGenerator = require('./CollectionGenerator');
const SchemaService = require('./SchemaService');
const schemaValidator = require('../utils/schemaValidator');

class DynamicCrudService {
  /**
   * Create a new record
   * @param {string} schemaName - Schema name
   * @param {Object} data - Record data
   * @returns {Promise<Object>} - Created record
   */
  async createRecord(schemaName, data) {
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
  
      console.log('Step 7: Converting to object...');
      const result = savedRecord.toObject();
      console.log('Final result:', JSON.stringify(result, null, 2));
  
      return result;
    } catch (error) {
      console.error('DynamicCrudService.createRecord ERROR:', error);
      throw error;
    }
  }

  /**
   * Get records with pagination and filtering
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
   * Get single record by ID
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
   * Update a record
   * @param {string} schemaName - Schema name
   * @param {string} recordId - Record ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object|null>} - Updated record
   */
  async updateRecord(schemaName, recordId, updateData) {
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

    // Update record
    const updatedRecord = await Model.findOneAndUpdate(
      { _id: recordId, _schemaName: schemaName },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedRecord) {
      throw new Error(`Record with ID '${recordId}' not found`);
    }

    return updatedRecord;
  }

  /**
   * Delete a record
   * @param {string} schemaName - Schema name
   * @param {string} recordId - Record ID
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteRecord(schemaName, recordId) {
    const schema = await SchemaService.getSchemaByName(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    const Model = CollectionGenerator.getDynamicModel(schemaName);
    if (!Model) {
      throw new Error(`Dynamic model for schema '${schemaName}' not found`);
    }

    const result = await Model.findOneAndDelete({ _id: recordId, _schemaName: schemaName });
    
    if (!result) {
      throw new Error(`Record with ID '${recordId}' not found`);
    }

    return true;
  }

  /**
   * Bulk create records
   * @param {string} schemaName - Schema name
   * @param {Array} recordsData - Array of record data
   * @returns {Promise<Array>} - Created records
   */
  async bulkCreateRecords(schemaName, recordsData) {
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
    return createdRecords.map(record => record.toObject());
  }

  /**
   * Get record count for a schema
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
}

module.exports = new DynamicCrudService();