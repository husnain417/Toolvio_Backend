const mongoose = require('mongoose');
const AuditService = require('./AuditService');
const SchemaService = require('./SchemaService');

class ChangeStreamService {
  constructor() {
    this.changeStreams = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize change streams for all dynamic collections
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('📡 Change streams already initialized');
      return;
    }

    try {
      console.log('📡 Initializing change streams...');
      
      // Get all active schemas
      const schemas = await SchemaService.getAllSchemas({ active: true });
      
      // Initialize change stream for each schema
      for (const schema of schemas) {
        await this.initializeSchemaChangeStream(schema);
      }
      
      // Watch for new collections (when new schemas are created)
      this.initializeGlobalChangeStream();
      
      this.isInitialized = true;
      console.log(`✅ Initialized change streams for ${schemas.length} schemas`);
      
    } catch (error) {
      console.error('❌ Error initializing change streams:', error);
      throw error;
    }
  }

  /**
   * Initialize change stream for a specific schema
   * @param {Object} schema - Schema definition
   */
  async initializeSchemaChangeStream(schema) {
    const collectionName = schema.collectionName;
    
    try {
      console.log(`📡 Setting up change stream for collection: ${collectionName}`);
      
      // Get the collection
      const collection = mongoose.connection.db.collection(collectionName);
      
      // Create change stream with options
      const changeStream = collection.watch([
        {
          $match: {
            'fullDocument._schemaName': schema.name,
            operationType: { $in: ['insert', 'update', 'delete'] }
          }
        }
      ], {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable'
      });
      
      // Handle change events
      changeStream.on('change', async (change) => {
        await this.handleChangeEvent(change, schema);
      });
      
      // Handle errors
      changeStream.on('error', (error) => {
        console.error(`❌ Change stream error for ${collectionName}:`, error);
        this.handleChangeStreamError(schema.name, error);
      });
      
      // Handle close
      changeStream.on('close', () => {
        console.log(`📡 Change stream closed for ${collectionName}`);
        this.changeStreams.delete(schema.name);
      });
      
      // Store the change stream
      this.changeStreams.set(schema.name, {
        changeStream,
        schema,
        collectionName,
        status: 'active',
        startedAt: new Date()
      });
      
      console.log(`✅ Change stream active for ${collectionName}`);
      
    } catch (error) {
      console.error(`❌ Error setting up change stream for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Initialize global change stream to watch for new collections
   */
  initializeGlobalChangeStream() {
    try {
      console.log('📡 Setting up global change stream...');
      
      // Watch for database-level changes
      const globalChangeStream = mongoose.connection.db.watch([
        {
          $match: {
            'ns.coll': { $regex: '^dynamic_' }, // Only dynamic collections
            operationType: { $in: ['insert', 'update', 'delete'] }
          }
        }
      ], {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable'
      });
      
      globalChangeStream.on('change', async (change) => {
        await this.handleGlobalChangeEvent(change);
      });
      
      globalChangeStream.on('error', (error) => {
        console.error('❌ Global change stream error:', error);
      });
      
      this.globalChangeStream = globalChangeStream;
      console.log('✅ Global change stream initialized');
      
    } catch (error) {
      console.error('❌ Error setting up global change stream:', error);
    }
  }

  /**
   * Handle individual change events
   * @param {Object} change - MongoDB change event
   * @param {Object} schema - Schema definition
   */
  async handleChangeEvent(change, schema) {
    try {
      const { operationType, documentKey, fullDocument, fullDocumentBeforeChange } = change;
      
      console.log(`📝 Change detected: ${operationType} in ${schema.name}`);
      
      // Extract document information
      const documentId = documentKey._id;
      
      // Prepare audit data based on operation type
      let auditData = {
        documentId,
        schemaName: schema.name,
        collectionName: schema.collectionName,
        operation: this.mapOperationType(operationType),
        metadata: {
          source: 'changeStream',
          operationType,
          timestamp: new Date()
        }
      };

      // Handle different operation types
      switch (operationType) {
        case 'insert':
          auditData.currentState = fullDocument;
          auditData.previousState = null;
          break;
          
        case 'update':
          auditData.currentState = fullDocument;
          auditData.previousState = fullDocumentBeforeChange;
          break;
          
        case 'delete':
          auditData.currentState = null;
          auditData.previousState = fullDocumentBeforeChange;
          break;
          
        default:
          console.log(`⚠️  Unhandled operation type: ${operationType}`);
          return;
      }

      // Log the audit trail
      await AuditService.logChange(auditData);
      console.log(`✅ Audit logged for ${operationType} on document ${documentId}`);
      
    } catch (error) {
      console.error('❌ Error handling change event:', error);
      // Don't throw - we don't want to crash the change stream
    }
  }

  /**
   * Handle global change events (for new collections)
   * @param {Object} change - MongoDB change event
   */
  async handleGlobalChangeEvent(change) {
    try {
      const collectionName = change.ns.coll;
      
      // Check if this is a new dynamic collection
      if (collectionName.startsWith('dynamic_')) {
        const schemaName = collectionName.replace('dynamic_', '');
        
        // Check if we already have a change stream for this schema
        if (!this.changeStreams.has(schemaName)) {
          console.log(`🔍 New dynamic collection detected: ${collectionName}`);
          
          // Try to get the schema and initialize change stream
          const schema = await SchemaService.getSchemaByName(schemaName);
          if (schema) {
            await this.initializeSchemaChangeStream(schema);
            console.log(`✅ Auto-initialized change stream for new schema: ${schemaName}`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error handling global change event:', error);
    }
  }

  /**
   * Handle change stream errors with retry logic
   * @param {string} schemaName - Schema name
   * @param {Error} error - Error object
   */
  async handleChangeStreamError(schemaName, error) {
    console.error(`❌ Change stream error for ${schemaName}:`, error.message);
    
    const streamInfo = this.changeStreams.get(schemaName);
    if (!streamInfo) return;
    
    // Mark as error state
    streamInfo.status = 'error';
    streamInfo.lastError = error;
    streamInfo.errorAt = new Date();
    
    // Implement retry logic
    setTimeout(async () => {
      try {
        console.log(`🔄 Retrying change stream for ${schemaName}...`);
        
        // Close existing stream if still open
        if (streamInfo.changeStream && !streamInfo.changeStream.closed) {
          streamInfo.changeStream.close();
        }
        
        // Remove from map
        this.changeStreams.delete(schemaName);
        
        // Reinitialize
        const schema = await SchemaService.getSchemaByName(schemaName);
        if (schema) {
          await this.initializeSchemaChangeStream(schema);
          console.log(`✅ Successfully restarted change stream for ${schemaName}`);
        }
        
      } catch (retryError) {
        console.error(`❌ Failed to restart change stream for ${schemaName}:`, retryError);
      }
    }, 5000); // Retry after 5 seconds
  }

  /**
   * Map MongoDB operation types to audit operation types
   * @param {string} operationType - MongoDB operation type
   * @returns {string} - Audit operation type
   */
  mapOperationType(operationType) {
    const mapping = {
      'insert': 'create',
      'update': 'update',
      'delete': 'delete'
    };
    
    return mapping[operationType] || operationType;
  }

  /**
   * Add change stream for a new schema
   * @param {Object} schema - Schema definition
   */
  async addSchemaChangeStream(schema) {
    try {
      if (this.changeStreams.has(schema.name)) {
        console.log(`⚠️  Change stream already exists for ${schema.name}`);
        return;
      }
      
      await this.initializeSchemaChangeStream(schema);
      console.log(`✅ Added change stream for new schema: ${schema.name}`);
      
    } catch (error) {
      console.error(`❌ Error adding change stream for ${schema.name}:`, error);
      throw error;
    }
  }

  /**
   * Remove change stream for a schema
   * @param {string} schemaName - Schema name
   */
  async removeSchemaChangeStream(schemaName) {
    try {
      const streamInfo = this.changeStreams.get(schemaName);
      if (!streamInfo) {
        console.log(`⚠️  No change stream found for ${schemaName}`);
        return;
      }
      
      // Close the change stream
      if (streamInfo.changeStream && !streamInfo.changeStream.closed) {
        streamInfo.changeStream.close();
      }
      
      // Remove from map
      this.changeStreams.delete(schemaName);
      
      console.log(`✅ Removed change stream for ${schemaName}`);
      
    } catch (error) {
      console.error(`❌ Error removing change stream for ${schemaName}:`, error);
      throw error;
    }
  }

  /**
   * Get status of all change streams
   * @returns {Object} - Status information
   */
  getStatus() {
    const status = {
      isInitialized: this.isInitialized,
      totalStreams: this.changeStreams.size,
      streams: {}
    };
    
    for (const [schemaName, streamInfo] of this.changeStreams) {
      status.streams[schemaName] = {
        status: streamInfo.status,
        startedAt: streamInfo.startedAt,
        collectionName: streamInfo.collectionName,
        lastError: streamInfo.lastError?.message,
        errorAt: streamInfo.errorAt
      };
    }
    
    return status;
  }

  /**
   * Shutdown all change streams
   */
  async shutdown() {
    console.log('📡 Shutting down change streams...');
    
    try {
      // Close global change stream
      if (this.globalChangeStream && !this.globalChangeStream.closed) {
        this.globalChangeStream.close();
      }
      
      // Close all schema change streams
      for (const [schemaName, streamInfo] of this.changeStreams) {
        if (streamInfo.changeStream && !streamInfo.changeStream.closed) {
          streamInfo.changeStream.close();
        }
      }
      
      // Clear the map
      this.changeStreams.clear();
      this.isInitialized = false;
      
      console.log('✅ All change streams shut down successfully');
      
    } catch (error) {
      console.error('❌ Error shutting down change streams:', error);
    }
  }
}

module.exports = new ChangeStreamService();