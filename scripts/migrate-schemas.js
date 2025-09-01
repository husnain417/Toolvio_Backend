const mongoose = require('mongoose');
const SchemaDefinition = require('../src/models/Schema');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toolivo_backend', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function migrateSchemas() {
  try {
    console.log('🔍 Starting schema migration...');
    
    // Find all schemas without tenantId
    const schemasWithoutTenantId = await SchemaDefinition.find({ 
      tenantId: { $exists: false } 
    });
    
    console.log(`📋 Found ${schemasWithoutTenantId.length} schemas without tenantId`);
    
    if (schemasWithoutTenantId.length === 0) {
      console.log('✅ No migration needed - all schemas have tenantId');
      return;
    }
    
    // Assign a default tenantId to existing schemas
    const defaultTenantId = 'legacy-migration';
    
    for (const schema of schemasWithoutTenantId) {
      console.log(`🔄 Migrating schema: ${schema.name}`);
      
      // Update the schema with a default tenantId
      await SchemaDefinition.findByIdAndUpdate(schema._id, {
        $set: { tenantId: defaultTenantId }
      });
      
      console.log(`✅ Migrated schema: ${schema.name} -> tenantId: ${defaultTenantId}`);
    }
    
    console.log(`✅ Successfully migrated ${schemasWithoutTenantId.length} schemas`);
    console.log(`⚠️  Note: These schemas are assigned to tenantId: ${defaultTenantId}`);
    console.log('   You may want to reassign them to proper tenants or delete them.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run migration
migrateSchemas();
