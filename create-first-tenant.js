const mongoose = require('mongoose');
const Tenant = require('./src/models/Tenant');

// First tenant configuration
const FIRST_TENANT = {
  tenantId: 'first-tenant',
  name: 'First Company',
  displayName: 'First Company Inc.',
  description: 'First tenant for the system',
  contactEmail: 'admin@firstcompany.com',
  contactPhone: '+1234567890',
  settings: {
    maxUsers: 1000,
    maxSchemas: 100,
    maxStorageGB: 50,
    features: {
      auditTrail: true,
      changeStreams: true,
      offlineSync: true,
      apiRateLimit: true
    }
  },
  subscriptionPlan: 'enterprise',
  isActive: true,
  isTrial: false
};

async function createFirstTenant() {
  try {
    console.log('🚀 Creating first tenant...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/toolvio');
    console.log('✅ Connected to MongoDB');
    
    // Check if any tenant exists
    const existingTenants = await Tenant.countDocuments();
    if (existingTenants > 0) {
      console.log('ℹ️  Tenants already exist in the system');
      console.log('📋 Use the API endpoints to manage tenants:');
      console.log('   - POST /api/tenants (requires admin authentication)');
      console.log('   - GET /api/tenants (requires admin authentication)');
      console.log('   - PUT /api/tenants/:tenantId (requires admin authentication)');
      console.log('   - DELETE /api/tenants/:tenantId (requires admin authentication)');
      return;
    }
    
    // Create first tenant
    const tenant = new Tenant(FIRST_TENANT);
    await tenant.save();
    console.log('✅ Created first tenant:', tenant.tenantId);
    console.log('📋 Tenant details:');
    console.log(`   - ID: ${tenant.tenantId}`);
    console.log(`   - Name: ${tenant.name}`);
    console.log(`   - Plan: ${tenant.subscriptionPlan}`);
    console.log(`   - Max Users: ${tenant.settings.maxUsers}`);
    console.log(`   - Max Schemas: ${tenant.settings.maxSchemas}`);
    
    console.log('\n🎉 First tenant created successfully!');
    console.log('\n🔑 Next steps:');
    console.log('1. Create an admin user for this tenant');
    console.log('2. Use the tenant ID for user registration');
    console.log('3. Access tenant management via /api/tenants endpoints');
    
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
    
  } catch (error) {
    console.error('❌ Error creating first tenant:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createFirstTenant();
}

module.exports = { createFirstTenant };
