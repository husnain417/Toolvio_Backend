const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  // Reference to the document that was changed
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Schema name for the document
  schemaName: {
    type: String,
    required: true,
    index: true
  },
  
  // Collection name where the document exists
  collectionName: {
    type: String,
    required: true,
    index: true
  },
  
  // Type of operation performed
  operation: {
    type: String,
    enum: ['create', 'update', 'delete'],
    required: true,
    index: true
  },
  
  // Complete document state before the change (null for create operations)
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Complete document state after the change (null for delete operations)  
  currentState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Specific fields that were changed (for update operations)
  changedFields: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  
  // User information (if available)
  userId: {
    type: String,
    default: null,
    index: true
  },
  
  userAgent: {
    type: String,
    default: null
  },
  
  ipAddress: {
    type: String,
    default: null
  },
  
  // Metadata
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Version number for the document
  version: {
    type: Number,
    required: true,
    default: 1,
    index: true
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Whether this change can be reverted
  canRevert: {
    type: Boolean,
    default: true
  },
  
  // If this is a revert operation, reference to the original audit log
  revertedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog',
    default: null
  },
  
  // ===== SYNC-SPECIFIC FIELDS =====
  
  // Sync versioning for ordering changes
  globalSyncVersion: {
    type: Number,
    required: true,
    index: true
  },
  tenantSyncVersion: {
    type: Number,
    required: true,
    index: true
  },
  schemaSyncVersion: {
    type: Number,
    required: true,
    index: true
  },
  
  // Client context for offline changes
  deviceId: {
    type: String,
    default: null,
    index: true
  },
  clientTimestamp: {
    type: Date,
    default: null
  },
  clientVersion: {
    type: String,
    default: null
  },
  
  // Sync status tracking
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'conflicted', 'resolved'],
    default: 'pending',
    index: true
  },
  
  // Conflict resolution data
  conflictData: {
    hasConflict: {
      type: Boolean,
      default: false
    },
    conflictType: {
      type: String,
      enum: ['concurrent', 'schema', 'deleted', 'reference_integrity', null],
      default: null,
      required: false
    },
    serverValue: mongoose.Schema.Types.Mixed,
    clientValue: mongoose.Schema.Types.Mixed,
    resolution: {
      type: String,
      enum: ['server_wins', 'client_wins', 'merged', 'manual', null],
      default: null,
      required: false
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: Date
  },
  
  // Tombstone for deleted records
  isTombstone: {
    type: Boolean,
    default: false,
    index: true
  },
  tombstoneData: {
    originalId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  
  // Tenant isolation
  tenantId: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: false, // We handle timestamps manually
  collection: 'audit_logs'
});

// Enhanced compound indexes for sync queries
AuditLogSchema.index({ documentId: 1, timestamp: -1 });
AuditLogSchema.index({ schemaName: 1, timestamp: -1 });
AuditLogSchema.index({ operation: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });

// Sync-specific indexes
AuditLogSchema.index({ tenantId: 1, globalSyncVersion: 1 });
AuditLogSchema.index({ tenantId: 1, schemaName: 1, globalSyncVersion: 1 });
AuditLogSchema.index({ tenantId: 1, syncStatus: 1, globalSyncVersion: 1 });
AuditLogSchema.index({ deviceId: 1, tenantId: 1, globalSyncVersion: 1 });

// TTL index to automatically delete old audit logs (optional)
// Uncomment and adjust as needed
// AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // 1 year

// Instance method to mark as synced
AuditLogSchema.methods.markAsSynced = function() {
  this.syncStatus = 'synced';
  return this.save();
};

// Instance method to mark as conflicted
AuditLogSchema.methods.markAsConflicted = function(conflictType, serverValue, clientValue) {
  this.syncStatus = 'conflicted';
  this.conflictData = {
    hasConflict: true,
    conflictType,
    serverValue,
    clientValue,
    hasConflict: true
  };
  return this.save();
};

// Instance method to resolve conflict
AuditLogSchema.methods.resolveConflict = function(resolution, resolvedBy, resolvedData = null) {
  this.syncStatus = 'resolved';
  this.conflictData.resolution = resolution;
  this.conflictData.resolvedBy = resolvedBy;
  this.conflictData.resolvedAt = new Date();
  
  if (resolvedData) {
    this.conflictData.serverValue = resolvedData;
  }
  
  return this.save();
};

// Static method to find changes since version
AuditLogSchema.statics.findChangesSince = function(tenantId, sinceVersion, schemas = null, limit = 1000) {
  const query = {
    tenantId,
    globalSyncVersion: { $gt: sinceVersion },
    syncStatus: { $ne: 'conflicted' } // Exclude unresolved conflicts
  };
  
  if (schemas && schemas.length > 0) {
    query.schemaName = { $in: schemas };
  }
  
  return this.find(query)
    .sort({ globalSyncVersion: 1 })
    .limit(limit)
    .select('-previousState -changedFields -metadata'); // Optimize payload
};

// Static method to find conflicted changes
AuditLogSchema.statics.findConflictedChanges = function(tenantId, schemas = null) {
  const query = {
    tenantId,
    'conflictData.hasConflict': true,
    syncStatus: 'conflicted'
  };
  
  if (schemas && schemas.length > 0) {
    query.schemaName = { $in: schemas };
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .populate('resolvedBy', 'username email');
};

module.exports = mongoose.model('AuditLog', AuditLogSchema);