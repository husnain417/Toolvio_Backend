const mongoose = require('mongoose');

const clientSyncStateSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Sync positions
  lastGlobalSyncVersion: {
    type: Number,
    default: 0,
    min: 0
  },
  lastTenantSyncVersion: {
    type: Number,
    default: 0,
    min: 0
  },
  schemaVersions: {
    type: Map,
    of: Number,
    default: new Map()
  },
  
  // Client metadata
  clientInfo: {
    appVersion: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web', 'desktop'],
      required: true
    },
    lastSyncAt: {
      type: Date,
      default: Date.now
    },
    syncIntervalMinutes: {
      type: Number,
      default: 15,
      min: 1
    },
    connectionType: {
      type: String,
      enum: ['wifi', 'cellular', 'ethernet', 'unknown'],
      default: 'unknown'
    },
    networkQuality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good'
    }
  },
  
  // Sync statistics
  stats: {
    totalSyncs: {
      type: Number,
      default: 0
    },
    lastSyncDuration: {
      type: Number, // milliseconds
      default: 0
    },
    averageSyncSize: {
      type: Number,
      default: 0
    },
    failedSyncs: {
      type: Number,
      default: 0
    },
    lastErrorAt: Date,
    lastError: String,
    consecutiveFailures: {
      type: Number,
      default: 0
    }
  },
  
  // Sync preferences
  preferences: {
    autoSync: {
      type: Boolean,
      default: true
    },
    syncOnWifiOnly: {
      type: Boolean,
      default: false
    },
    maxBatchSize: {
      type: Number,
      default: 1000,
      min: 100,
      max: 10000
    },
    conflictResolution: {
      type: String,
      enum: ['server_wins', 'client_wins', 'manual', 'smart_merge'],
      default: 'smart_merge'
    }
  },
  
  // Offline capabilities
  offlineCapabilities: {
    maxOfflineDays: {
      type: Number,
      default: 30,
      min: 1
    },
    offlineDataSize: {
      type: Number, // MB
      default: 100
    },
    lastOfflineSync: Date
  }
}, {
  timestamps: true
});

// Compound unique index
clientSyncStateSchema.index({ deviceId: 1, tenantId: 1 }, { unique: true });

// Index for efficient queries
clientSyncStateSchema.index({ tenantId: 1, lastGlobalSyncVersion: 1 });
clientSyncStateSchema.index({ userId: 1, lastSyncAt: 1 });

// Instance method to update sync position
clientSyncStateSchema.methods.updateSyncPosition = function(globalVersion, tenantVersion, schemaVersions = {}) {
  this.lastGlobalSyncVersion = Math.max(this.lastGlobalSyncVersion, globalVersion);
  this.lastTenantSyncVersion = Math.max(this.lastTenantSyncVersion, tenantVersion);
  
  // Update schema versions
  for (const [schema, version] of Object.entries(schemaVersions)) {
    const currentVersion = this.schemaVersions.get(schema) || 0;
    this.schemaVersions.set(schema, Math.max(currentVersion, version));
  }
  
  this.clientInfo.lastSyncAt = new Date();
  this.stats.totalSyncs += 1;
};

// Instance method to record sync failure
clientSyncStateSchema.methods.recordSyncFailure = function(error, duration = 0) {
  this.stats.failedSyncs += 1;
  this.stats.lastErrorAt = new Date();
  this.stats.lastError = error;
  this.stats.consecutiveFailures += 1;
  
  if (duration > 0) {
    // Update average sync duration
    const totalDuration = this.stats.averageSyncSize * (this.stats.totalSyncs - this.stats.failedSyncs);
    this.stats.averageSyncSize = (totalDuration + duration) / (this.stats.totalSyncs - this.stats.failedSyncs);
  }
};

// Instance method to record successful sync
clientSyncStateSchema.methods.recordSuccessfulSync = function(duration, syncSize) {
  this.stats.consecutiveFailures = 0;
  this.stats.lastSyncDuration = duration;
  
  if (syncSize > 0) {
    // Update average sync size
    const totalSize = this.stats.averageSyncSize * (this.stats.totalSyncs - 1);
    this.stats.averageSyncSize = (totalSize + syncSize) / this.stats.totalSyncs;
  }
};

// Static method to find clients needing sync
clientSyncStateSchema.statics.findClientsNeedingSync = function(tenantId, minVersionGap = 100) {
  return this.find({
    tenantId,
    $or: [
      { lastGlobalSyncVersion: { $lt: { $subtract: ['$currentGlobalVersion', minVersionGap] } } },
      { 'stats.consecutiveFailures': { $gte: 3 } },
      { 'clientInfo.lastSyncAt': { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // 24 hours ago
    ]
  }).sort({ 'stats.consecutiveFailures': -1, 'clientInfo.lastSyncAt': 1 });
};

// Static method to cleanup old client states
clientSyncStateSchema.statics.cleanupOldStates = function(daysOld = 90) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    'clientInfo.lastSyncAt': { $lt: cutoffDate },
    'stats.totalSyncs': { $lt: 5 } // Only cleanup if very few syncs
  });
};

module.exports = mongoose.model('ClientSyncState', clientSyncStateSchema);
