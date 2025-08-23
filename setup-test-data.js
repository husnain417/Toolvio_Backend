const mongoose = require('mongoose');
const User = require('./src/models/User');
const Tenant = require('./src/models/Tenant');

// Test configuration
const TEST_TENANT = {
  tenantId: 'test-tenant',
  name: 'Test Company',
  displayName: 'Test Company Inc.',
  description: 'Test tenant for development',
  contactEmail: 'admin@testcompany.com',
  contactPhone: '+1234567890',
  settings: {
    maxUsers: 100,
    maxSchemas: 50,
    maxStorageGB: 10,
    features: {
      auditTrail: true,
      changeStreams: true,
      offlineSync: true,
      apiRateLimit: true
    }
  },
  subscriptionPlan: 'professional',
  isActive: true
};

const TEST_USERS = [
  {
    username: 'admin',
    email: 'admin@testcompany.com',
    password: 'admin123456',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    tenantId: 'test-tenant'
  },
  {
    username: 'office',
    email: 'office@testcompany.com',
    password: 'office123456',
    firstName: 'Office',
    lastName: 'User',
    role: 'office',
    tenantId: 'test-tenant'
  },
  {
    username: 'technician',
    email: 'tech@testcompany.com',
    password: 'tech123456',
    firstName: 'Technician',
    lastName: 'User',
    role: 'technician',
    tenantId: 'test-tenant'
  },
  {
    username: 'customer',
    email: 'customer@testcompany.com',
    password: 'customer123456',
    firstName: 'Customer',
    lastName: 'User',
    role: 'customer',
    tenantId: 'test-tenant'
  }
];

async function setupTestData() {
  try {
    console.log('🚀 Setting up test data...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/toolvio');
    console.log('✅ Connected to MongoDB');
    
    // Create test tenant
    let tenant = await Tenant.findOne({ tenantId: TEST_TENANT.tenantId });
    if (!tenant) {
      tenant = new Tenant(TEST_TENANT);
      await tenant.save();
      console.log('✅ Created test tenant:', tenant.tenantId);
    } else {
      console.log('ℹ️  Test tenant already exists:', tenant.tenantId);
    }
    
    // Create test users
    for (const userData of TEST_USERS) {
      let user = await User.findOne({ 
        username: userData.username, 
        tenantId: userData.tenantId 
      });
      
      if (!user) {
        user = new User(userData);
        await user.save();
        console.log(`✅ Created ${userData.role} user:`, userData.username);
      } else {
        console.log(`ℹ️  ${userData.role} user already exists:`, userData.username);
      }
    }
    
    console.log('\n🎉 Test data setup completed!');
    console.log('\n📋 Test Users:');
    console.log('Admin: admin / admin123456');
    console.log('Office: office / office123456');
    console.log('Technician: tech / tech123456');
    console.log('Customer: customer / customer123456');
    console.log('\n🔑 Test with any user to see role-based access control in action!');
    
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupTestData();
}

module.exports = { setupTestData };
