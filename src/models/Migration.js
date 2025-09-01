const mongoose = require('mongoose');

const MigrationSchema = new mongoose.Schema({
  // Tenant isolation
  tenantId: {
    type: String,
    required: true,
    index: true
  },

  // Schema identification
  schemaName: {
    type: String,
    required: true,
    index: true
  },

  // Version information
  fromVersion: {
    type: String,
    required: true,
    index: true
  },

  toVersion: {
    type: String,
    required: true,
    index: true
  },

  // Migration script (JavaScript code)
  migrationScript: {
    type: String,
    required: true
  },

  // Migration status
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'],
    default: 'PENDING',
    index: true
  },

  // Execution metadata
  startedAt: {
    type: Date,
    default: null
  },

  completedAt: {
    type: Date,
    default: null
  },

  // Error information
  error: {
    type: String,
    default: null
  },

  // Progress tracking
  progress: {
    current: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },

  // Affected documents count
  affectedDocuments: {
    type: Number,
    default: 0
  },

  // Migration metadata
  metadata: {
    dryRun: {
      type: Boolean,
      default: false
    },
    backupCreated: {
      type: Boolean,
      default: false
    },
    backupLocation: {
      type: String,
      default: null
    },
    estimatedDuration: {
      type: Number, // in milliseconds
      default: null
    },
    actualDuration: {
      type: Number, // in milliseconds
      default: null
    }
  },

  // Execution context
  executedBy: {
    type: String,
    required: true,
    index: true
  },

  // Rollback information
  rollback: {
    canRollback: {
      type: Boolean,
      default: true
    },
    rollbackScript: {
      type: String,
      default: null
    },
    rolledBackAt: {
      type: Date,
      default: null
    },
    rolledBackBy: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true,
  collection: 'migrations'
});

// Compound indexes for efficient queries
MigrationSchema.index({ tenantId: 1, schemaName: 1, status: 1 });
MigrationSchema.index({ tenantId: 1, schemaName: 1, createdAt: -1 });
MigrationSchema.index({ status: 1, createdAt: -1 });

// Instance method to start migration
MigrationSchema.methods.start = async function() {
  this.status = 'RUNNING';
  this.startedAt = new Date();
  return this.save();
};

// Instance method to complete migration
MigrationSchema.methods.complete = async function(affectedCount, duration) {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  this.affectedDocuments = affectedCount;
  this.progress.current = this.progress.total;
  this.progress.percentage = 100;
  this.metadata.actualDuration = duration;
  return this.save();
};

// Instance method to fail migration
MigrationSchema.methods.fail = async function(error, duration) {
  this.status = 'FAILED';
  this.completedAt = new Date();
  this.error = error;
  this.metadata.actualDuration = duration;
  return this.save();
};

// Instance method to update progress
MigrationSchema.methods.updateProgress = async function(current, total) {
  this.progress.current = current;
  this.progress.total = total;
  this.progress.percentage = Math.round((current / total) * 100);
  return this.save();
};

// Instance method to rollback migration
MigrationSchema.methods.performRollback = async function(rolledBackBy) {
  this.status = 'ROLLED_BACK';
  this.rollback.rolledBackAt = new Date();
  this.rollback.rolledBackBy = rolledBackBy;
  return this.save();
};

// Static method to get pending migrations
MigrationSchema.statics.getPendingMigrations = function(tenantId, schemaName = null) {
  const query = { tenantId, status: 'PENDING' };
  if (schemaName) query.schemaName = schemaName;
  
  return this.find(query)
    .sort({ createdAt: 1 })
    .lean();
};

// Static method to get running migrations
MigrationSchema.statics.getRunningMigrations = function(tenantId, schemaName = null) {
  const query = { tenantId, status: 'RUNNING' };
  if (schemaName) query.schemaName = schemaName;
  
  return this.find(query)
    .sort({ startedAt: 1 })
    .lean();
};

// Static method to get failed migrations
MigrationSchema.statics.getFailedMigrations = function(tenantId, schemaName = null) {
  const query = { tenantId, status: 'FAILED' };
  if (schemaName) query.schemaName = schemaName;
  
  return this.find(query)
    .sort({ completedAt: -1 })
    .lean();
};

// Static method to get migration history
MigrationSchema.statics.getMigrationHistory = function(tenantId, schemaName = null, options = {}) {
  const { page = 1, limit = 20, status } = options;
  
  const query = { tenantId };
  if (schemaName) query.schemaName = schemaName;
  if (status) query.status = status;
  
  const skip = (page - 1) * limit;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Pre-save middleware to validate migration script
MigrationSchema.pre('save', function(next) {
  // Validate migration script is not empty
  if (!this.migrationScript || this.migrationScript.trim().length === 0) {
    return next(new Error('Migration script cannot be empty'));
  }
  
  // Validate version format (basic semver check)
  if (!/^\d+\.\d+\.\d+$/.test(this.fromVersion) || !/^\d+\.\d+\.\d+$/.test(this.toVersion)) {
    return next(new Error('Version must be in semver format (e.g., 1.2.3)'));
  }
  
  // Ensure fromVersion is different from toVersion
  if (this.fromVersion === this.toVersion) {
    return next(new Error('From version and to version must be different'));
  }
  
  next();
});

module.exports = mongoose.model('Migration', MigrationSchema);
