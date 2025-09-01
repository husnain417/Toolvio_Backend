const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic user information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  // Role and permissions
  role: {
    type: String,
    enum: ['system_admin', 'admin', 'office', 'technician', 'customer'],
    default: 'customer',
    required: true
  },
  
  // Tenant isolation (optional for system admin)
  tenantId: {
    type: String,
    required: function() {
      return this.role !== 'system_admin';
    },
    index: true
  },
  
  // Enhanced permissions structure
  permissions: {
    // System-level permissions (only for system_admin)
    system: {
      manageTenants: { type: Boolean, default: false },
      systemMonitoring: { type: Boolean, default: false },
      platformConfig: { type: Boolean, default: false }
    },
    // Tenant-level permissions
    schemas: {
      read: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      versioning: { type: Boolean, default: false }
    },
    data: {
      read: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      bulk: { type: Boolean, default: false }
    },
    audit: {
      read: { type: Boolean, default: false },
      rollback: { type: Boolean, default: false },
      export: { type: Boolean, default: false }
    },
    users: {
      read: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      roles: { type: Boolean, default: false }
    },
    // Business-specific permissions
    jobs: {
      read: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      assign: { type: Boolean, default: false },
      complete: { type: Boolean, default: false }
    },
    customers: {
      read: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    invoices: {
      read: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      approve: { type: Boolean, default: false }
    },
    reports: {
      read: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      export: { type: Boolean, default: false }
    },
    // Offline sync permissions
    sync: {
      offline: { type: Boolean, default: false },
      conflict: { type: Boolean, default: false },
      batch: { type: Boolean, default: false }
    }
  },
  
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  
  // System admin specific fields
  isSystemAdmin: {
    type: Boolean,
    default: false
  },
  
  // Last system-wide action (for system admin audit)
  lastSystemAction: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ tenantId: 1, isActive: 1 });
userSchema.index({ email: 1, tenantId: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ isSystemAdmin: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Check permission method
userSchema.methods.hasPermission = function(resource, action) {
  // System admin has all permissions
  if (this.role === 'system_admin' || this.isSystemAdmin) return true;
  
  // Check specific permission
  const resourcePerms = this.permissions[resource];
  if (!resourcePerms) return false;
  
  return resourcePerms[action] || false;
};

// Check system-level permission
userSchema.methods.hasSystemPermission = function(action) {
  if (this.role === 'system_admin' || this.isSystemAdmin) return true;
  
  return this.permissions.system && this.permissions.system[action] || false;
};

// Check if user can access tenant
userSchema.methods.canAccessTenant = function(tenantId) {
  // System admin can access all tenants
  if (this.role === 'system_admin' || this.isSystemAdmin) return true;
  
  return this.tenantId === tenantId;
};

// Check if user can manage tenant
userSchema.methods.canManageTenant = function(tenantId) {
  // System admin can manage all tenants
  if (this.role === 'system_admin' || this.isSystemAdmin) return true;
  
  // Tenant admin can manage their own tenant
  if (this.role === 'admin' && this.tenantId === tenantId) return true;
  
  return false;
};

// Get user's effective permissions based on role
userSchema.methods.getEffectivePermissions = function() {
  const basePermissions = {
    system_admin: {
      system: { manageTenants: true, systemMonitoring: true, platformConfig: true },
      schemas: { read: true, write: true, delete: true, versioning: true },
      data: { read: true, write: true, delete: true, bulk: true },
      audit: { read: true, rollback: true, export: true },
      users: { read: true, write: true, delete: true, roles: true },
      jobs: { read: true, create: true, update: true, assign: true, complete: true },
      customers: { read: true, create: true, update: true, delete: true },
      invoices: { read: true, create: true, update: true, approve: true },
      reports: { read: true, create: true, export: true },
      sync: { offline: true, conflict: true, batch: true }
    },
    admin: {
      system: { manageTenants: false, systemMonitoring: false, platformConfig: false },
      schemas: { read: true, write: true, delete: true, versioning: true },
      data: { read: true, write: true, delete: true, bulk: true },
      audit: { read: true, rollback: true, export: true },
      users: { read: true, write: true, delete: true, roles: true },
      jobs: { read: true, create: true, update: true, assign: true, complete: true },
      customers: { read: true, create: true, update: true, delete: true },
      invoices: { read: true, create: true, update: true, approve: true },
      reports: { read: true, create: true, export: true },
      sync: { offline: true, conflict: true, batch: true }
    },
    office: {
      system: { manageTenants: false, systemMonitoring: false, platformConfig: false },
      schemas: { read: true, write: false, delete: false, versioning: false },
      data: { read: true, write: true, delete: false, bulk: true },
      audit: { read: true, rollback: false, export: false },
      users: { read: true, write: false, delete: false, roles: false },
      jobs: { read: true, create: true, update: true, assign: true, complete: false },
      customers: { read: true, create: true, update: true, delete: false },
      invoices: { read: true, create: true, update: true, approve: false },
      reports: { read: true, create: true, export: true },
      sync: { offline: false, conflict: false, batch: false }
    },
    technician: {
      system: { manageTenants: false, systemMonitoring: false, platformConfig: false },
      schemas: { read: true, write: false, delete: false, versioning: false },
      data: { read: true, write: true, delete: false, bulk: false },
      audit: { read: true, rollback: false, export: false },
      users: { read: false, write: false, delete: false, roles: false },
      jobs: { read: true, create: false, update: true, assign: false, complete: true },
      customers: { read: true, create: false, update: false, delete: false },
      invoices: { read: false, create: false, update: false, approve: false },
      reports: { read: false, create: false, export: false },
      sync: { offline: true, conflict: true, batch: false }
    },
    customer: {
      system: { manageTenants: false, systemMonitoring: false, platformConfig: false },
      schemas: { read: false, write: false, delete: false, versioning: false },
      data: { read: true, write: false, delete: false, bulk: false },
      audit: { read: false, rollback: false, export: false },
      users: { read: false, write: false, delete: false, roles: false },
      jobs: { read: true, create: false, update: false, assign: false, complete: false },
      customers: { read: false, create: false, update: false, delete: false },
      invoices: { read: true, create: false, update: false, approve: false },
      reports: { read: false, create: false, export: false },
      sync: { offline: false, conflict: false, batch: false }
    }
  };
  
  return basePermissions[this.role] || basePermissions.customer;
};

// Update system action timestamp
userSchema.methods.updateSystemAction = function() {
  if (this.role === 'system_admin' || this.isSystemAdmin) {
    this.lastSystemAction = new Date();
    return this.save();
  }
};

module.exports = mongoose.model('User', userSchema);
