const DynamicCrudService = require('../services/DynamicCrudService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Dynamic Data Controller with Audit Trail Integration
 * Handles all dynamic data CRUD operations with audit logging
 */
class DynamicController {
  /**
   * Get all records for a schema with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRecords(req, res) {
    try {
      const { schemaName } = req.params;
      const { page, limit, sort, includeAudit, populate, ...filter } = req.query;
      
      console.log('Raw filter from query:', filter);
      
      // Process filter to handle nested fields and type conversion
      const processedFilter = {};
      Object.keys(filter).forEach(key => {
        let value = filter[key];
        
        // Convert string booleans to actual booleans
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        
        // Convert string numbers to actual numbers
        if (!isNaN(value) && value !== '' && typeof value === 'string') {
          const numValue = Number(value);
          if (Number.isInteger(numValue)) {
            value = numValue;
          }
        }
        
        // Handle dot notation for nested fields (like features.invoicing)
        processedFilter[key] = value;
      });
      
      console.log('Processed filter:', processedFilter);
      
      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        filter: processedFilter
      };

      // Handle population parameter
      if (populate) {
        options.populate = populate.split(',').map(field => field.trim());
      }
      
      // Handle sort parameter
      if (sort) {
        try {
          options.sort = JSON.parse(sort);
        } catch (error) {
          options.sort = { createdAt: -1 };
        }
      }
      
      console.log('Options being passed to service:', options);
      
      // Choose service method based on includeAudit flag
      const result = includeAudit === 'true' 
        ? await DynamicCrudService.getRecordsWithAudit(schemaName, options)
        : await DynamicCrudService.getRecords(schemaName, options);
      
      successResponse(res, result, 'Records retrieved successfully');
    } catch (error) {
      console.error('Controller error:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get single record by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRecordById(req, res) {
    try {
      const { schemaName, recordId } = req.params;
      const { populate } = req.query;
      
      // Parse population fields
      const populateFields = populate ? populate.split(',').map(field => field.trim()) : [];
      
      const record = await DynamicCrudService.getRecordById(schemaName, recordId, populateFields);
      
      if (!record) {
        return errorResponse(res, `Record with ID '${recordId}' not found`, 404);
      }

      successResponse(res, record, 'Record retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Create a new record with audit logging
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createRecord(req, res) {
    console.log('=== CONTROLLER CREATE RECORD START ===');
    const startTime = Date.now();
    
    try {
      const { schemaName } = req.params;
      const recordData = req.body;
      
      console.log('Schema name:', schemaName);
      console.log('Request body keys:', Object.keys(recordData));
      
      // Basic validation
      if (!schemaName) {
        return res.status(400).json({
          success: false,
          error: 'Schema name is required'
        });
      }
      
      if (!recordData || Object.keys(recordData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Record data is required'
        });
      }

      console.log('Calling DynamicCrudService.createRecord...');
      
      // Get audit context
      const auditContext = req.auditContext || {};
      
      // Simple service call with timeout
      const createPromise = DynamicCrudService.createRecord(schemaName, recordData, auditContext);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Create record operation timed out after 10 seconds'));
        }, 10000);
      });

      const record = await Promise.race([createPromise, timeoutPromise]);
      
      if (!record) {
        return res.status(500).json({
          success: false,
          error: 'Failed to create record - service returned null'
        });
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`Record created successfully in ${totalTime}ms`);
      
      // Send response
      res.status(201).json({
        success: true,
        message: 'Record created successfully',
        data: record,
        meta: {
          schemaName,
          recordId: record._id,
          createdAt: record.createdAt || new Date().toISOString(),
          processingTime: `${totalTime}ms`,
          auditLogged: true
        }
      });
      
      console.log('=== CONTROLLER CREATE RECORD END ===');
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('=== CONTROLLER CREATE RECORD ERROR ===');
      console.error(`Error after ${totalTime}ms:`, error.message);
      
      // Make sure we haven't already sent a response
      if (!res.headersSent) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          details: {
            schemaName: req.params.schemaName,
            processingTime: `${totalTime}ms`,
            timestamp: new Date().toISOString()
          }
        });
      }
    }
  }

  /**
   * Update record with audit logging
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateRecord(req, res) {
    console.log('=== CONTROLLER UPDATE RECORD START ===');
    
    try {
      const { schemaName, recordId } = req.params;
      const updateData = req.body;
      
      // Get audit context
      const auditContext = req.auditContext || {};

      const updatedRecord = await DynamicCrudService.updateRecord(
        schemaName, 
        recordId, 
        updateData, 
        auditContext
      );
      
      successResponse(res, updatedRecord, 'Record updated successfully', 200, {
        auditLogged: true,
        recordId,
        schemaName
      });
    } catch (error) {
      console.error('Update record error:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Patch record (partial update) with audit logging
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async patchRecord(req, res) {
    console.log('=== CONTROLLER PATCH RECORD START ===');
    
    try {
      const { schemaName, recordId } = req.params;
      const updateData = req.body;

      // Get existing record first
      const existingRecord = await DynamicCrudService.getRecordById(schemaName, recordId);
      if (!existingRecord) {
        return errorResponse(res, `Record with ID '${recordId}' not found`, 404);
      }

      // Merge with existing data for partial update
      const mergedData = { ...existingRecord, ...updateData };
      
      // Remove system fields from merged data
      delete mergedData._id;
      delete mergedData.__v;
      delete mergedData._schemaName;
      delete mergedData.createdAt;
      delete mergedData.updatedAt;

      // Get audit context
      const auditContext = req.auditContext || {};

      const updatedRecord = await DynamicCrudService.updateRecord(
        schemaName, 
        recordId, 
        mergedData, 
        auditContext
      );
      
      successResponse(res, updatedRecord, 'Record updated successfully', 200, {
        auditLogged: true,
        recordId,
        schemaName,
        patchOperation: true
      });
    } catch (error) {
      console.error('Patch record error:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Delete record with audit logging
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteRecord(req, res) {
    console.log('=== CONTROLLER DELETE RECORD START ===');
    
    try {
      const { schemaName, recordId } = req.params;
      
      // Get audit context
      const auditContext = req.auditContext || {};
      
      await DynamicCrudService.deleteRecord(schemaName, recordId, auditContext);
      
      successResponse(res, null, 'Record deleted successfully', 200, {
        auditLogged: true,
        recordId,
        schemaName,
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete record error:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Bulk create records with audit logging
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async bulkCreateRecords(req, res) {
    console.log('=== CONTROLLER BULK CREATE RECORDS START ===');
    
    try {
      const { schemaName } = req.params;
      const { records } = req.body;

      if (!records || !Array.isArray(records)) {
        return errorResponse(res, 'Records array is required', 400);
      }

      // Get audit context
      const auditContext = req.auditContext || {};

      const createdRecords = await DynamicCrudService.bulkCreateRecords(
        schemaName, 
        records, 
        auditContext
      );
      
      successResponse(res, createdRecords, `${createdRecords.length} records created successfully`, 201, {
        auditLogged: true,
        schemaName,
        bulkOperation: true,
        recordCount: createdRecords.length
      });
    } catch (error) {
      console.error('Bulk create records error:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get record count for a schema (unchanged)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRecordCount(req, res) {
    try {
      const { schemaName } = req.params;
      const filter = req.query;

      const count = await DynamicCrudService.getRecordCount(schemaName, filter);
      successResponse(res, { count }, 'Record count retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Search records with advanced querying (unchanged)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchRecords(req, res) {
    try {
      const { schemaName } = req.params;
      const { q, fields, page, limit, sort } = req.query;

      if (!q) {
        return errorResponse(res, 'Search query is required', 400);
      }

      // Build search filter
      const searchFilter = {};
      if (fields) {
        const fieldArray = fields.split(',');
        const searchConditions = fieldArray.map(field => ({
          [field]: { $regex: q, $options: 'i' }
        }));
        searchFilter.$or = searchConditions;
      } else {
        // Search in all string fields
        searchFilter.$text = { $search: q };
      }

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        filter: searchFilter
      };

      if (sort) {
        try {
          options.sort = JSON.parse(sort);
        } catch (error) {
          options.sort = { createdAt: -1 };
        }
      }

      const result = await DynamicCrudService.getRecords(schemaName, options);
      successResponse(res, result, 'Search completed successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get record statistics for a schema (unchanged)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRecordStats(req, res) {
    try {
      const { schemaName } = req.params;
      const { timeframe } = req.query;

      // Calculate time range
      let timeRange = {};
      if (timeframe) {
        const now = new Date();
        switch (timeframe) {
          case '24h':
            timeRange = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
            break;
          case '7d':
            timeRange = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
            break;
          case '30d':
            timeRange = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
            break;
          default:
            timeRange = {};
        }
      }

      const totalCount = await DynamicCrudService.getRecordCount(schemaName);
      const recentCount = await DynamicCrudService.getRecordCount(schemaName, {
        createdAt: timeRange
      });

      const stats = {
        schemaName,
        totalRecords: totalCount,
        recentRecords: recentCount,
        timeframe: timeframe || 'all'
      };

      successResponse(res, stats, 'Record statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new DynamicController();