const mongoose = require('mongoose');

/**
 * Base Dynamic Model Class
 * Provides common functionality for all dynamic models
 */
class DynamicModel {
  constructor(schemaName, collectionName) {
    this.schemaName = schemaName;
    this.collectionName = collectionName;
    this.model = null;
  }

  /**
   * Get the Mongoose model instance
   * @returns {Object} Mongoose model
   */
  getModel() {
    return this.model;
  }

  /**
   * Get the collection name
   * @returns {string} Collection name
   */
  getCollectionName() {
    return this.collectionName;
  }

  /**
   * Get the schema name
   * @returns {string} Schema name
   */
  getSchemaName() {
    return this.schemaName;
  }

  /**
   * Check if model is initialized
   * @returns {boolean} True if model is initialized
   */
  isInitialized() {
    return this.model !== null;
  }

  /**
   * Get model statistics
   * @returns {Promise<Object>} Model statistics
   */
  async getStats() {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      const totalCount = await this.model.countDocuments();
      const recentCount = await this.model.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      return {
        schemaName: this.schemaName,
        collectionName: this.collectionName,
        totalRecords: totalCount,
        recordsLast24h: recentCount,
        isActive: true
      };
    } catch (error) {
      throw new Error(`Failed to get model stats: ${error.message}`);
    }
  }

  /**
   * Create indexes for the model
   * @returns {Promise<Array>} Created indexes
   */
  async createIndexes() {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      const indexes = await this.model.createIndexes();
      return indexes;
    } catch (error) {
      throw new Error(`Failed to create indexes: ${error.message}`);
    }
  }

  /**
   * Drop the collection
   * @returns {Promise<boolean>} True if dropped
   */
  async dropCollection() {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      await this.model.collection.drop();
      return true;
    } catch (error) {
      throw new Error(`Failed to drop collection: ${error.message}`);
    }
  }

  /**
   * Get collection info
   * @returns {Promise<Object>} Collection information
   */
  async getCollectionInfo() {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      const stats = await this.model.collection.stats();
      return {
        name: stats.ns,
        count: stats.count,
        size: stats.size,
        avgObjSize: stats.avgObjSize,
        storageSize: stats.storageSize,
        indexes: stats.nindexes,
        totalIndexSize: stats.totalIndexSize
      };
    } catch (error) {
      throw new Error(`Failed to get collection info: ${error.message}`);
    }
  }
}

/**
 * Dynamic Model Instance Factory
 * Creates instances of DynamicModel for specific schemas
 */
class DynamicModelFactory {
  constructor() {
    this.models = new Map();
  }

  /**
   * Create a new dynamic model instance
   * @param {string} schemaName - Schema name
   * @param {string} collectionName - Collection name
   * @returns {DynamicModel} Dynamic model instance
   */
  createModel(schemaName, collectionName) {
    const model = new DynamicModel(schemaName, collectionName);
    this.models.set(schemaName, model);
    return model;
  }

  /**
   * Get a dynamic model instance
   * @param {string} schemaName - Schema name
   * @returns {DynamicModel|null} Dynamic model instance or null
   */
  getModel(schemaName) {
    return this.models.get(schemaName) || null;
  }

  /**
   * Remove a dynamic model instance
   * @param {string} schemaName - Schema name
   * @returns {boolean} True if removed
   */
  removeModel(schemaName) {
    return this.models.delete(schemaName);
  }

  /**
   * Get all model instances
   * @returns {Array<DynamicModel>} Array of model instances
   */
  getAllModels() {
    return Array.from(this.models.values());
  }

  /**
   * Get model count
   * @returns {number} Number of models
   */
  getModelCount() {
    return this.models.size;
  }
}

module.exports = {
  DynamicModel,
  DynamicModelFactory: new DynamicModelFactory()
};
