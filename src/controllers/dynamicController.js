const DynamicCrudService = require('../services/DynamicCrudService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Dynamic Data Controller
 * Handles all dynamic data CRUD operations
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
    const { page, limit, sort, ...filter } = req.query;
    
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
    
    // Handle sort parameter
    if (sort) {
      try {
        options.sort = JSON.parse(sort);
      } catch (error) {
        options.sort = { createdAt: -1 };
      }
    }
    
    console.log('Options being passed to service:', options);
    
    const result = await DynamicCrudService.getRecords(schemaName, options);
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
      const record = await DynamicCrudService.getRecordById(schemaName, recordId);
      
      if (!record) {
        return errorResponse(res, `Record with ID '${recordId}' not found`, 404);
      }

      successResponse(res, record, 'Record retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get single record by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
/**
 * Simplified and Fixed Create Record Method
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
    
    // Simple service call with timeout
    const createPromise = DynamicCrudService.createRecord(schemaName, recordData);
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
        processingTime: `${totalTime}ms`
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
   * Update record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateRecord(req, res) {
    try {
      const { schemaName, recordId } = req.params;
      const updateData = req.body;

      const updatedRecord = await DynamicCrudService.updateRecord(schemaName, recordId, updateData);
      successResponse(res, updatedRecord, 'Record updated successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Patch record (partial update)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async patchRecord(req, res) {
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

      const updatedRecord = await DynamicCrudService.updateRecord(schemaName, recordId, mergedData);
      successResponse(res, updatedRecord, 'Record updated successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Delete record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteRecord(req, res) {
    try {
      const { schemaName, recordId } = req.params;
      await DynamicCrudService.deleteRecord(schemaName, recordId);
      successResponse(res, null, 'Record deleted successfully');
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Bulk create records
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async bulkCreateRecords(req, res) {
    try {
      const { schemaName } = req.params;
      const { records } = req.body;

      if (!records || !Array.isArray(records)) {
        return errorResponse(res, 'Records array is required', 400);
      }

      const createdRecords = await DynamicCrudService.bulkCreateRecords(schemaName, records);
      successResponse(res, createdRecords, `${createdRecords.length} records created successfully`, 201);
    } catch (error) {
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get record count for a schema
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
   * Search records with advanced querying
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
   * Get record statistics for a schema
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
