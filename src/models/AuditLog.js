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
  }
}, {
  timestamps: false, // We handle timestamps manually
  collection: 'audit_logs'
});

// Compound indexes for better query performance
AuditLogSchema.index({ documentId: 1, timestamp: -1 });
AuditLogSchema.index({ schemaName: 1, timestamp: -1 });
AuditLogSchema.index({ operation: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });

// TTL index to automatically delete old audit logs (optional)
// Uncomment and adjust as needed
// AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // 1 year

module.exports = mongoose.model('AuditLog', AuditLogSchema);