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
    enum: ['admin', 'office', 'technician', 'customer'],
    default: 'customer',
    required: true
  },
  
  // Tenant isolation
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  
  // Permissions (granular control)
  permissions: {
    schemas: {
      read: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    data: {
      read: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    audit: {
      read: { type: Boolean, default: false },
      rollback: { type: Boolean, default: false }
    },
    users: {
      read: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
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
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ tenantId: 1, isActive: 1 });
userSchema.index({ email: 1, tenantId: 1 });

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
  if (this.role === 'admin') return true;
  
  const resourcePerms = this.permissions[resource];
  if (!resourcePerms) return false;
  
  return resourcePerms[action] || false;
};

// Check if user can access tenant
userSchema.methods.canAccessTenant = function(tenantId) {
  return this.tenantId === tenantId;
};

// Get user's effective permissions based on role
userSchema.methods.getEffectivePermissions = function() {
  const basePermissions = {
    admin: {
      schemas: { read: true, write: true, delete: true },
      data: { read: true, write: true, delete: true },
      audit: { read: true, rollback: true },
      users: { read: true, write: true, delete: true }
    },
    office: {
      schemas: { read: true, write: false, delete: false },
      data: { read: true, write: true, delete: false },
      audit: { read: true, rollback: false },
      users: { read: true, write: false, delete: false }
    },
    technician: {
      schemas: { read: true, write: false, delete: false },
      data: { read: true, write: true, delete: false },
      audit: { read: true, rollback: false },
      users: { read: false, write: false, delete: false }
    },
    customer: {
      schemas: { read: false, write: false, delete: false },
      data: { read: true, write: false, delete: false },
      audit: { read: false, rollback: false },
      users: { read: false, write: false, delete: false }
    }
  };
  
  return basePermissions[this.role] || basePermissions.customer;
};

module.exports = mongoose.model('User', userSchema);
