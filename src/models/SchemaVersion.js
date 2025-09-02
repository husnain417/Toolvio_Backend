const mongoose = require('mongoose');

const SchemaVersionSchema = new mongoose.Schema({
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

  // Version information (semver format)
  version: {
    type: String,
    required: true,
    match: /^\d+\.\d+\.\d+$/, // semver format validation
    index: true
  },

  // Full schema definition (stored as JSON)
  jsonSchema: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Human-readable changelog
  changelog: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },

  // Creation metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  createdBy: {
    type: String,
    required: true,
    index: true
  },

  // Version status
  isActive: {
    type: Boolean,
    default: false,
    index: true
  },

  // Optional migration script
  migrationScript: {
    type: String,
    default: null
  },

  // Compatibility level for breaking changes
  compatibilityLevel: {
    type: String,
    enum: ['MAJOR', 'MINOR', 'PATCH'],
    required: true,
    index: true
  },

  // Link to previous version
  previousVersion: {
    type: String,
    default: null
  },

  // Additional metadata
  metadata: {
    breakingChanges: [String],
    deprecatedFields: [String],
    newFields: [String],
    modifiedFields: [String]
  }
}, {
  timestamps: true,
  collection: 'schema_versions'
});

// Compound indexes for efficient queries
SchemaVersionSchema.index({ tenantId: 1, schemaName: 1, version: 1 }, { unique: true });
SchemaVersionSchema.index({ tenantId: 1, schemaName: 1, isActive: 1 });
SchemaVersionSchema.index({ tenantId: 1, schemaName: 1, createdAt: -1 });

// Instance method to activate this version
SchemaVersionSchema.methods.activate = async function() {
  // Deactivate all other versions for this schema
  await this.constructor.updateMany(
    { 
      tenantId: this.tenantId, 
      schemaName: this.schemaName,
      _id: { $ne: this._id }
    },
    { isActive: false }
  );
  
  // Activate this version
  this.isActive = true;
  return this.save();
};

// Instance method to deactivate this version
SchemaVersionSchema.methods.deactivate = async function() {
  this.isActive = false;
  return this.save();
};

// Static method to get active version
SchemaVersionSchema.statics.getActiveVersion = function(tenantId, schemaName) {
  return this.findOne({ tenantId, schemaName, isActive: true });
};

// Static method to get version history
SchemaVersionSchema.statics.getVersionHistory = function(tenantId, schemaName) {
  return this.find({ tenantId, schemaName })
    .sort({ version: -1 })
    .select('-jsonSchema') // Exclude full schema for performance
    .lean();
};

// Static method to check if version exists
SchemaVersionSchema.statics.versionExists = function(tenantId, schemaName, version) {
  return this.exists({ tenantId, schemaName, version });
};

// Pre-save middleware to validate version format
SchemaVersionSchema.pre('save', function(next) {
  // Validate semver format
  if (!/^\d+\.\d+\.\d+$/.test(this.version)) {
    return next(new Error('Version must be in semver format (e.g., 1.2.3)'));
  }
  
  // Ensure only one active version per schema
  if (this.isActive) {
    this.constructor.updateMany(
      { 
        tenantId: this.tenantId, 
        schemaName: this.schemaName,
        _id: { $ne: this._id }
      },
      { isActive: false }
    ).exec();
  }
  
  next();
});

module.exports = mongoose.model('SchemaVersion', SchemaVersionSchema);
