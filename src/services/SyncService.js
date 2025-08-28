const mongoose = require('mongoose');
const SyncVersion = require('../models/SyncVersion');
const ClientSyncState = require('../models/ClientSyncState');
const ConflictResolver = require('./ConflictResolver');

class SyncService {
  constructor() {
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * Get changes since last sync
   */
  async getChangesSince(tenantId, deviceId, sinceVersion, options = {}) {
    try {
      // Validate client state
      const validation = await this.validateClientState(deviceId, tenantId, sinceVersion);
      if (validation.requiresFullSync) {
        return validation;
      }

      // Fetch incremental changes
      const changes = await this.fetchIncrementalChanges(tenantId, sinceVersion, options);
      
      if (!changes.success) {
        return changes;
      }

      return {
        success: true,
        changes: changes.changes,
        nextVersion: changes.nextVersion,
        hasMore: changes.hasMore
      };

    } catch (error) {
      console.error('Error getting changes since:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process batch of client changes
   */
  async processClientChanges(tenantId, deviceId, clientChanges, options = {}) {
    const startTime = Date.now();
    const session = await mongoose.startSession();
    
    try {
      let results = [];
      
      await session.withTransaction(async () => {
        results = [];
        
        for (const change of clientChanges) {
          try {
            const result = await this.processClientChange(change, tenantId, deviceId, session);
            results.push(result);
          } catch (error) {
            console.error(`Error processing change ${change.operation} on ${change.schema}:`, error);
            results.push({
              success: false,
              error: error.message,
              change: change
            });
          }
        }
        
        // Update client sync state
        const newGlobalVersion = await SyncVersion.getNextVersion('global', 'global');
        const newTenantVersion = await SyncVersion.getNextVersion('tenant', tenantId);
        
        await ClientSyncState.findOneAndUpdate(
          { deviceId, tenantId },
          {
            $set: {
              lastGlobalSyncVersion: newGlobalVersion,
              lastTenantSyncVersion: newTenantVersion,
              'clientInfo.lastSyncAt': new Date()
            }
          },
          { session }
        );
      });
      
      const duration = Date.now() - startTime;
      await this.recordSuccessfulSync(deviceId, tenantId, duration, clientChanges.length);
      
      return {
        success: true,
        processedChanges: results.length,
        results: results,
        syncDuration: duration
      };
      
    } catch (error) {
      console.error('Error processing client changes:', error);
      await this.recordSyncFailure(deviceId, tenantId, error.message, Date.now() - startTime);
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Validate client sync state
   */
  async validateClientState(deviceId, tenantId, sinceVersion) {
    try {
      const clientState = await ClientSyncState.findOne({ deviceId, tenantId });
      const currentGlobalVersion = await SyncVersion.getCurrentVersion('global', 'global');
      
      if (!clientState) {
        return { requiresFullSync: true, reason: 'New client' };
      }
      
      // Check if client is too far behind
      const maxVersionGap = 1000; // Configurable threshold
      if (currentGlobalVersion - sinceVersion > maxVersionGap) {
        return { requiresFullSync: true, reason: 'Client too far behind' };
      }
      
      // Check if client has too many consecutive failures
      if (clientState.stats?.consecutiveFailures >= 5) {
        return { requiresFullSync: true, reason: 'Too many sync failures' };
      }
      
      return { requiresFullSync: false };
    } catch (error) {
      console.error('Error validating client state:', error);
      return { requiresFullSync: true, reason: 'Validation error' };
    }
  }

  /**
   * Fetch incremental changes since a version
   */
  async fetchIncrementalChanges(tenantId, sinceVersion, options = {}) {
    try {
      const { schemas, limit = 1000, includeDeleted = true } = options;
      
      const query = {
        tenantId,
        globalSyncVersion: { $gt: sinceVersion },
        syncStatus: { $ne: 'conflicted' }
      };
      
      if (schemas && schemas.length > 0) {
        query.schemaName = { $in: schemas };
      }
      
      const AuditLog = require('../models/AuditLog');
      const changes = await AuditLog.find(query)
        .sort({ globalSyncVersion: 1 })
        .limit(limit)
        .lean();
      
      const nextVersion = await SyncVersion.getCurrentVersion('global', 'global');
      
      return {
        success: true,
        changes: changes,
        nextVersion: nextVersion,
        hasMore: changes.length === limit
      };
      
    } catch (error) {
      console.error('Error fetching incremental changes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get schema versions for a tenant
   */
  async getSchemaVersions(tenantId) {
    try {
      const versions = {};
      const schemas = await require('../models/Schema').find({ tenantId });
      
      for (const schema of schemas) {
        const version = await SyncVersion.getCurrentVersion('schema', `${tenantId}:${schema.name}`);
        versions[schema.name] = version;
      }
      
      return versions;
    } catch (error) {
      console.error('Error getting schema versions:', error);
      return {};
    }
  }

  /**
   * Process a single client change
   */
  async processClientChange(change, tenantId, deviceId, session) {
    try {
      const { operation, schema, recordId, data, clientTimestamp, clientVersion } = change;
      
      // Validate required fields based on operation
      if (operation === 'create' && (!data || Object.keys(data).length === 0)) {
        throw new Error('Data is required for create operations');
      }
      
      if (operation === 'update' && (!data || Object.keys(data).length === 0)) {
        throw new Error('Data is required for update operations');
      }
      
      // Get next sync versions
      const globalVersion = await SyncVersion.getNextVersion('global', 'global');
      const tenantVersion = await SyncVersion.getNextVersion('tenant', tenantId);
      const schemaVersion = await SyncVersion.getNextVersion('schema', `${tenantId}:${schema}`);
      
      // Check for conflicts
      const conflictAnalysis = await this.conflictResolver.analyzeChange(change, tenantId);
      
      if (conflictAnalysis.hasConflict) {
        // Handle conflict based on client preferences
        return await this.handleConflict(change, conflictAnalysis, globalVersion, tenantVersion, schemaVersion, session);
      }
      
      // Process the change
      const result = await this.executeChange(change, tenantId, globalVersion, tenantVersion, schemaVersion, session);
      
      // Create audit log
      await this.createAuditLog(change, result, globalVersion, tenantVersion, schemaVersion, deviceId, session);
      
      return {
        success: true,
        operation: operation,
        recordId: result._id || recordId,
        result: result
      };
      
    } catch (error) {
      console.error('Error processing client change:', error);
      throw error;
    }
  }

  /**
   * Handle conflict resolution
   */
  async handleConflict(change, conflictAnalysis, globalVersion, tenantVersion, schemaVersion, session) {
    try {
      const clientState = await ClientSyncState.findOne({ 
        deviceId: change.deviceId, 
        tenantId: change.tenantId 
      });
      
      const resolutionStrategy = clientState?.preferences?.conflictResolution || 'smart_merge';
      
      // Use the enhanced conflict resolver
      const resolution = await this.conflictResolver.resolveConflicts(
        conflictAnalysis.conflicts,
        resolutionStrategy,
        change.tenantId
      );
      
      if (resolution.resolved) {
        // Execute the change with resolved conflicts
        return await this.executeChange(change, change.tenantId, globalVersion, tenantVersion, schemaVersion, session);
      } else {
        // Flag for manual resolution
        await this.flagForManualResolution(change, conflictAnalysis, globalVersion, tenantVersion, schemaVersion);
        return { 
          success: false,
          status: 'conflict_flagged', 
          message: 'Change flagged for manual resolution' 
        };
      }
    } catch (error) {
      console.error('Error handling conflict:', error);
      throw error;
    }
  }

  /**
   * Execute a change operation
   */
  async executeChange(change, tenantId, globalVersion, tenantVersion, schemaVersion, session) {
    try {
      const { operation, schema, recordId, data } = change;
      
      // Get the dynamic model
      const CollectionGenerator = require('./CollectionGenerator');
      const model = await CollectionGenerator.getDynamicModel(schema, tenantId);
      
      if (!model) {
        throw new Error(`Dynamic model not found for schema: ${schema}`);
      }
      
      switch (operation) {
        case 'create':
          const newRecord = new model({
            ...data,
            _schemaName: schema,
            tenantId
          });
          return await newRecord.save({ session });
          
        case 'update':
          return await model.findByIdAndUpdate(
            recordId,
            { ...data, updatedAt: new Date() },
            { new: true, session }
          );
          
        case 'delete':
          // Create tombstone instead of actually deleting
          await this.createTombstone(recordId, schema, tenantId, change.userId, session);
          return { deleted: true, recordId };
          
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      console.error('Error executing change:', error);
      throw error;
    }
  }

  /**
   * Create audit log for a change
   */
  async createAuditLog(change, result, globalVersion, tenantVersion, schemaVersion, deviceId, session) {
    try {
      const auditData = {
        documentId: change.recordId || result._id,
        schemaName: change.schema,
        collectionName: `dynamic_${change.tenantId || 'default'}_${change.schema}`,
        operation: change.operation,
        previousState: null, // For client changes, we don't have previous state
        currentState: change.operation === 'delete' ? null : change.data,
        userId: change.userId,
        userAgent: change.userAgent || 'offline_sync',
        ipAddress: change.ipAddress || 'offline',
        metadata: {
          tenantId: change.tenantId || 'default',
          deviceId,
          clientTimestamp: change.clientTimestamp,
          clientVersion: change.clientVersion,
          source: 'offline_sync'
        },
        globalSyncVersion: globalVersion,
        tenantSyncVersion: tenantVersion,
        schemaSyncVersion: schemaVersion,
        tenantId: change.tenantId || 'default',
        syncStatus: 'synced'
      };

      const AuditService = require('./AuditService');
      const auditService = new AuditService();
      return await auditService.logChange(auditData);
    } catch (error) {
      console.error('Error creating audit log:', error);
      // Don't throw - audit logging failure shouldn't break sync
    }
  }

  /**
   * Create tombstone for deleted record
   */
  async createTombstone(recordId, schemaName, tenantId, deletedBy, session) {
    try {
      const tombstoneData = {
        documentId: recordId,
        schemaName,
        collectionName: `dynamic_${tenantId}_${schemaName}`,
        operation: 'delete',
        previousState: null,
        currentState: null,
        userId: deletedBy,
        userAgent: 'offline_sync',
        ipAddress: 'offline',
        metadata: {
          tenantId,
          source: 'offline_sync'
        },
        isTombstone: true,
        tombstoneData: {
          originalId: recordId,
          deletedAt: new Date(),
          deletedBy
        },
        globalSyncVersion: await SyncVersion.getNextVersion('global', 'global'),
        tenantSyncVersion: await SyncVersion.getNextVersion('tenant', tenantId),
        schemaSyncVersion: await SyncVersion.getNextVersion('schema', `${tenantId}:${schemaName}`),
        tenantId: tenantId,
        syncStatus: 'synced'
      };

      const AuditService = require('./AuditService');
      const auditService = new AuditService();
      return await auditService.logChange(tombstoneData);
    } catch (error) {
      console.error('Error creating tombstone:', error);
      // Don't throw - tombstone creation failure shouldn't break sync
    }
  }

  /**
   * Flag change for manual resolution
   */
  async flagForManualResolution(change, conflictAnalysis, globalVersion, tenantVersion, schemaVersion) {
    try {
      const auditData = {
        documentId: change.recordId,
        schemaName: change.schema,
        collectionName: `dynamic_${change.tenantId}_${change.schema}`,
        operation: change.operation,
        previousState: null,
        currentState: change.data,
        userId: change.userId,
        userAgent: change.userAgent || 'offline_sync',
        ipAddress: change.ipAddress || 'offline',
        metadata: {
          tenantId: change.tenantId,
          deviceId: change.deviceId,
          clientTimestamp: change.clientTimestamp,
          clientVersion: change.clientVersion,
          source: 'offline_sync',
          conflictDetails: conflictAnalysis
        },
        globalSyncVersion: globalVersion,
        tenantSyncVersion: tenantVersion,
        schemaSyncVersion: schemaVersion,
        tenantId: change.tenantId,
        syncStatus: 'conflicted',
        conflictData: {
          hasConflict: true,
          conflictType: 'concurrent',
          serverValue: conflictAnalysis.serverState,
          clientValue: change.data,
          resolution: null
        }
      };

      const AuditService = require('./AuditService');
      const auditService = new AuditService();
      return await auditService.logChange(auditData);
    } catch (error) {
      console.error('Error flagging for manual resolution:', error);
      // Don't throw - flagging failure shouldn't break sync
    }
  }

  /**
   * Record sync failure
   */
  async recordSyncFailure(deviceId, tenantId, error, duration = 0) {
    try {
      await ClientSyncState.findOneAndUpdate(
        { deviceId, tenantId },
        { $inc: { 'stats.failedSyncs': 1 } }
      );
      
      const clientState = await ClientSyncState.findOne({ deviceId, tenantId });
      if (clientState) {
        clientState.recordSyncFailure(error, duration);
        await clientState.save();
      }
    } catch (error) {
      console.error('Error recording sync failure:', error);
    }
  }

  /**
   * Record successful sync
   */
  async recordSuccessfulSync(deviceId, tenantId, duration, syncSize) {
    try {
      const clientState = await ClientSyncState.findOne({ deviceId, tenantId });
      if (clientState) {
        clientState.recordSuccessfulSync(duration, syncSize);
        await clientState.save();
      }
    } catch (error) {
      console.error('Error recording successful sync:', error);
    }
  }

  /**
   * Update client sync state
   */
  async updateClientSyncState(deviceId, tenantId, lastVersion, changeCount) {
    try {
      await ClientSyncState.findOneAndUpdate(
        { deviceId, tenantId },
        {
          $set: {
            'clientInfo.lastSyncAt': new Date()
          },
          $inc: {
            'stats.totalSyncs': 1
          }
        }
      );
    } catch (error) {
      console.error('Error updating client sync state:', error);
    }
  }
}

module.exports = SyncService;
