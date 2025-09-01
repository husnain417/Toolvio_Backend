const mongoose = require('mongoose');

const syncVersionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['global', 'tenant', 'schema'],
    required: true,
    index: true
  },
  identifier: {
    type: String,
    required: true,
    index: true
  },
  currentVersion: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    totalChanges: {
      type: Number,
      default: 0
    },
    activeClients: {
      type: Number,
      default: 0
    },
    lastSyncClient: String
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
syncVersionSchema.index({ type: 1, identifier: 1 }, { unique: true });

// Static method to get next version atomically
syncVersionSchema.statics.getNextVersion = async function(type, identifier) {
  const result = await this.findOneAndUpdate(
    { type, identifier },
    { 
      $inc: { currentVersion: 1, 'metadata.totalChanges': 1 },
      $set: { lastUpdated: new Date() }
    },
    { 
      new: true, 
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
  
  return result.currentVersion;
};

// Static method to get current version
syncVersionSchema.statics.getCurrentVersion = async function(type, identifier) {
  const version = await this.findOne({ type, identifier });
  return version ? version.currentVersion : 0;
};

// Static method to update metadata
syncVersionSchema.statics.updateMetadata = async function(type, identifier, metadata) {
  return await this.findOneAndUpdate(
    { type, identifier },
    { 
      $set: { 
        'metadata.lastSyncClient': metadata.lastSyncClient,
        lastUpdated: new Date()
      },
      $inc: { 'metadata.activeClients': metadata.activeClientsDelta || 0 }
    },
    { new: true }
  );
};

module.exports = mongoose.model('SyncVersion', syncVersionSchema);
