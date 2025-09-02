const express = require('express');
const router = express.Router();
const SyncService = require('../services/SyncService');
const { authenticate: auth } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validateSchema');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const syncService = new SyncService();

// Sync Routes for Offline Sync Functionality

// Get changes since last sync
router.get('/changes', auth, async (req, res) => {
  try {
    const { since, deviceId, schemas, limit, includeDeleted } = req.query;
    const tenantId = req.user.tenantId;
    
    // Validate required parameters
    if (!since || !deviceId) {
      return errorResponse(res, 'Missing required parameters: since and deviceId', 400);
    }
    
    // Parse schemas if provided
    let schemaArray = null;
    if (schemas) {
      schemaArray = schemas.split(',').map(s => s.trim());
    }
    
    // Parse limit
    const limitNum = limit ? parseInt(limit) : 1000;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10000) {
      return errorResponse(res, 'Invalid limit parameter. Must be between 1 and 10000', 400);
    }
    
    // Parse includeDeleted
    const includeDeletedBool = includeDeleted !== 'false';
    
    const options = {
      schemas: schemaArray,
      limit: limitNum,
      includeDeleted: includeDeletedBool
    };
    
    const result = await syncService.getChangesSince(
      tenantId,
      deviceId,
      parseInt(since),
      options
    );
    
    if (result.requiresFullSync) {
      return successResponse(res, {
        requiresFullSync: true,
        reason: result.reason,
        message: 'Client requires full sync'
      }, 'Success');
    }
    
    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to get changes', 500);
    }
    
    return successResponse(res, result, 'Changes retrieved successfully');
    
  } catch (error) {
    console.error('Error in /sync/changes:', error);
    return errorResponse(res, 'Failed to retrieve changes', 500);
  }
});

// Process batch of client changes
router.post('/batch', auth, async (req, res) => {
  try {
    const { deviceId, clientSyncVersion, changes, conflictResolution } = req.body;
    const tenantId = req.user.tenantId;
    
    // Validate required parameters
    if (!deviceId || clientSyncVersion === undefined || clientSyncVersion === null || !changes || !Array.isArray(changes)) {
      return errorResponse(res, 'Missing required parameters: deviceId, clientSyncVersion, and changes array', 400);
    }
    
    // Validate changes array
    if (changes.length === 0) {
      return errorResponse(res, 'Changes array cannot be empty', 400);
    }
    
    if (changes.length > 1000) {
      return errorResponse(res, 'Too many changes. Maximum allowed is 1000', 400);
    }
    
    // Validate each change
    for (const change of changes) {
      if (!change.operation || !change.schema || !change.data || !change.clientTimestamp) {
        return errorResponse(res, 'Invalid change object. Missing required fields', 400);
      }
      
      if (!['create', 'update', 'delete'].includes(change.operation)) {
        return errorResponse(res, 'Invalid operation type', 400);
      }
      
      if (change.operation !== 'create' && !change.recordId) {
        return errorResponse(res, 'Record ID required for update and delete operations', 400);
      }
    }
    
    const options = {
      conflictResolution: conflictResolution || { strategy: 'smart_merge' }
    };
    
    const result = await syncService.processClientChanges(
      tenantId,
      deviceId,
      changes,
      options
    );
    
    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to process client changes', 500);
    }
    
    return successResponse(res, result, 'Changes processed successfully');
    
  } catch (error) {
    console.error('Error in /sync/batch:', error);
    return errorResponse(res, 'Failed to process client changes', 500);
  }
});

// Get client sync state
router.get('/state', auth, async (req, res) => {
  try {
    const { deviceId } = req.query;
    const tenantId = req.user.tenantId;
    
    if (!deviceId) {
      return errorResponse(res, 'Missing deviceId parameter', 400);
    }
    
    const ClientSyncState = require('../models/ClientSyncState');
    const syncState = await ClientSyncState.findOne({ deviceId, tenantId });
    
    if (!syncState) {
      return errorResponse(res, 'Sync state not found for this device', 404);
    }
    
    return successResponse(res, syncState, 'Sync state retrieved successfully');
    
  } catch (error) {
    console.error('Error in /sync/state:', error);
    return errorResponse(res, 'Failed to retrieve sync state', 500);
  }
});

// Create or update client sync state
router.post('/state', auth, async (req, res) => {
  try {
    const { deviceId, appVersion, platform, syncIntervalMinutes, connectionType, networkQuality, preferences } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user._id;
    
    // Validate required parameters
    if (!deviceId || !appVersion || !platform) {
      return errorResponse(res, 'Missing required parameters: deviceId, appVersion, and platform', 400);
    }
    
    // Validate platform
    if (!['ios', 'android', 'web', 'desktop'].includes(platform)) {
      return errorResponse(res, 'Invalid platform. Must be one of: ios, android, web, desktop', 400);
    }
    
    const ClientSyncState = require('../models/ClientSyncState');
    
    // Create or update sync state
    const syncState = await ClientSyncState.findOneAndUpdate(
      { deviceId, tenantId },
      {
        $set: {
          userId,
          tenantId,
          deviceId,
          'clientInfo.appVersion': appVersion,
          'clientInfo.platform': platform,
          'clientInfo.lastSyncAt': new Date(),
          ...(syncIntervalMinutes && { 'clientInfo.syncIntervalMinutes': syncIntervalMinutes }),
          ...(connectionType && { 'clientInfo.connectionType': connectionType }),
          ...(networkQuality && { 'clientInfo.networkQuality': networkQuality }),
          ...(preferences && { preferences })
        }
      },
      { 
        new: true, 
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
    
    return successResponse(res, syncState, 'Sync state created/updated successfully');
    
  } catch (error) {
    console.error('Error in /sync/state POST:', error);
    return errorResponse(res, 'Failed to create/update sync state', 500);
  }
});

// Get conflicted changes
router.get('/conflicts', auth, async (req, res) => {
  try {
    const { schemas } = req.query;
    const tenantId = req.user.tenantId;
    
    let schemaArray = null;
    if (schemas) {
      schemaArray = schemas.split(',').map(s => s.trim());
    }
    
    const AuditLog = require('../models/AuditLog');
    const conflicts = await AuditLog.findConflictedChanges(tenantId, schemaArray);
    
    return successResponse(res, {
      conflicts,
      count: conflicts.length
    }, 'Conflicts retrieved successfully');
    
  } catch (error) {
    console.error('Error in /sync/conflicts:', error);
    return errorResponse(res, 'Failed to retrieve conflicted changes', 500);
  }
});

// Get sync system health
router.get('/health', auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Get sync statistics
    const ClientSyncState = require('../models/ClientSyncState');
    const SyncVersion = require('../models/SyncVersion');
    
    const [clientCount, globalVersion, tenantVersion] = await Promise.all([
      ClientSyncState.countDocuments({ tenantId }),
      SyncVersion.getCurrentVersion('global', 'global'),
      SyncVersion.getCurrentVersion('tenant', tenantId)
    ]);
    
    // Get recent sync activity
    const recentSyncs = await ClientSyncState.find({ tenantId })
      .sort({ 'clientInfo.lastSyncAt': -1 })
      .limit(10)
      .select('deviceId clientInfo.lastSyncAt stats.totalSyncs stats.lastSyncDuration');
    
    const health = {
      status: 'healthy',
      tenantId,
      statistics: {
        activeClients: clientCount,
        globalVersion,
        tenantVersion,
        recentSyncs
      },
      timestamp: new Date()
    };
    
    return successResponse(res, health, 'Sync health information retrieved successfully');
    
  } catch (error) {
    console.error('Error in /sync/health:', error);
    return errorResponse(res, 'Failed to retrieve sync health', 500);
  }
});

// ------------------------------------------------------------
// Schema-specific aliases for compatibility with test suite
// ------------------------------------------------------------

// GET /api/sync/:schema/changes -> inject schema filter and reuse logic
router.get('/:schema/changes', auth, async (req, res) => {
  try {
    const { since, deviceId, limit, includeDeleted } = req.query;
    const schema = req.params.schema;
    const tenantId = req.user.tenantId;

    if (!since || !deviceId) {
      return errorResponse(res, 'Missing required parameters: since and deviceId', 400);
    }

    const limitNum = limit ? parseInt(limit) : 1000;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10000) {
      return errorResponse(res, 'Invalid limit parameter. Must be between 1 and 10000', 400);
    }

    const includeDeletedBool = includeDeleted !== 'false';

    const options = {
      schemas: [schema],
      limit: limitNum,
      includeDeleted: includeDeletedBool
    };

    const result = await syncService.getChangesSince(
      tenantId,
      deviceId,
      parseInt(since),
      options
    );

    if (result.requiresFullSync) {
      return successResponse(res, {
        requiresFullSync: true,
        reason: result.reason,
        message: 'Client requires full sync'
      }, 'Success');
    }

    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to get changes', 500);
    }

    return successResponse(res, result, 'Changes retrieved successfully');
  } catch (error) {
    console.error('Error in /sync/:schema/changes:', error);
    return errorResponse(res, 'Failed to retrieve changes', 500);
  }
});

// POST /api/sync/:schema/changes -> alias for batch submit
router.post('/:schema/changes', auth, async (req, res) => {
  try {
    const { deviceId, clientSyncVersion, changes, conflictResolution } = req.body;
    const tenantId = req.user.tenantId;

    if (!deviceId || clientSyncVersion === undefined || clientSyncVersion === null || !changes || !Array.isArray(changes)) {
      return errorResponse(res, 'Missing required parameters: deviceId, clientSyncVersion, and changes array', 400);
    }

    if (changes.length === 0) {
      return errorResponse(res, 'Changes array cannot be empty', 400);
    }

    if (changes.length > 1000) {
      return errorResponse(res, 'Too many changes. Maximum allowed is 1000', 400);
    }

    // Optional: enforce that change.schema matches req.params.schema, otherwise reject or normalize
    const schema = req.params.schema;
    for (const change of changes) {
      if (!change.operation || !change.schema || !change.data || !change.clientTimestamp) {
        return errorResponse(res, 'Invalid change object. Missing required fields', 400);
      }
      if (!['create', 'update', 'delete'].includes(change.operation)) {
        return errorResponse(res, 'Invalid operation type', 400);
      }
      if (change.operation !== 'create' && !change.recordId) {
        return errorResponse(res, 'Record ID required for update and delete operations', 400);
      }
      // If schema mismatch, normalize to path schema
      if (change.schema !== schema) {
        change.schema = schema;
      }
    }

    const options = {
      conflictResolution: conflictResolution || { strategy: 'smart_merge' }
    };

    const result = await syncService.processClientChanges(
      tenantId,
      deviceId,
      changes,
      options
    );

    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to process client changes', 500);
    }

    return successResponse(res, result, 'Changes processed successfully');
  } catch (error) {
    console.error('Error in /sync/:schema/changes POST:', error);
    return errorResponse(res, 'Failed to process client changes', 500);
  }
});

// GET /api/sync/:schema/status -> alias to /state
router.get('/:schema/status', auth, async (req, res) => {
  try {
    const { deviceId } = req.query;
    const tenantId = req.user.tenantId;

    if (!deviceId) {
      return errorResponse(res, 'Missing deviceId parameter', 400);
    }

    const ClientSyncState = require('../models/ClientSyncState');
    const syncState = await ClientSyncState.findOne({ deviceId, tenantId });

    if (!syncState) {
      return errorResponse(res, 'Sync state not found for this device', 404);
    }

    return successResponse(res, syncState, 'Sync state retrieved successfully');
  } catch (error) {
    console.error('Error in /sync/:schema/status:', error);
    return errorResponse(res, 'Failed to retrieve sync state', 500);
  }
});

module.exports = router;
