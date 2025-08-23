const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Tenant identification
  tenantId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50,
    match: [/^[a-zA-Z0-9_-]+$/, 'Tenant ID can only contain letters, numbers, hyphens, and underscores']
  },
  
  // Tenant information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Contact information
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  contactPhone: {
    type: String,
    trim: true,
    maxlength: 20
  },
  
  // Configuration
  settings: {
    maxUsers: {
      type: Number,
      default: 100,
      min: 1,
      max: 10000
    },
    maxSchemas: {
      type: Number,
      default: 50,
      min: 1,
      max: 1000
    },
    maxStorageGB: {
      type: Number,
      default: 10,
      min: 1,
      max: 1000
    },
    features: {
      auditTrail: { type: Boolean, default: true },
      changeStreams: { type: Boolean, default: true },
      offlineSync: { type: Boolean, default: true },
      apiRateLimit: { type: Boolean, default: true }
    }
  },
  
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  isTrial: {
    type: Boolean,
    default: true
  },
  trialExpiresAt: {
    type: Date
  },
  subscriptionPlan: {
    type: String,
    enum: ['trial', 'basic', 'professional', 'enterprise'],
    default: 'trial'
  },
  subscriptionExpiresAt: {
    type: Date
  },
  
  // Usage tracking
  usage: {
    userCount: { type: Number, default: 0 },
    schemaCount: { type: Number, default: 0 },
    storageUsedGB: { type: Number, default: 0 },
    apiCallsThisMonth: { type: Number, default: 0 },
    lastUsageUpdate: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Indexes for performance
tenantSchema.index({ tenantId: 1 });
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ subscriptionPlan: 1 });

// Virtual for subscription status
tenantSchema.virtual('subscriptionStatus').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isTrial && this.trialExpiresAt && this.trialExpiresAt < Date.now()) return 'trial_expired';
  if (this.subscriptionExpiresAt && this.subscriptionExpiresAt < Date.now()) return 'subscription_expired';
  if (this.isTrial) return 'trial';
  return 'active';
});

// Check if tenant can create more users
tenantSchema.methods.canCreateUser = function() {
  return this.usage.userCount < this.settings.maxUsers;
};

// Check if tenant can create more schemas
tenantSchema.methods.canCreateSchema = function() {
  return this.usage.schemaCount < this.settings.maxSchemas;
};

// Check if tenant has enough storage
tenantSchema.methods.hasStorageAvailable = function(requiredGB) {
  return (this.usage.storageUsedGB + requiredGB) <= this.settings.maxStorageGB;
};

// Check if feature is enabled
tenantSchema.methods.isFeatureEnabled = function(feature) {
  return this.settings.features[feature] || false;
};

// Update usage statistics
tenantSchema.methods.updateUsage = function(updates) {
  const allowedUpdates = ['userCount', 'schemaCount', 'storageUsedGB', 'apiCallsThisMonth'];
  const filteredUpdates = {};
  
  allowedUpdates.forEach(key => {
    if (updates[key] !== undefined) {
      filteredUpdates[`usage.${key}`] = updates[key];
    }
  });
  
  filteredUpdates['usage.lastUsageUpdate'] = Date.now();
  
  return this.updateOne({ $set: filteredUpdates });
};

module.exports = mongoose.model('Tenant', tenantSchema);
