const mongoose = require('mongoose');
require('dotenv').config();

async function addDeduplicationIndex() {
  try {
    console.log('🔧 Starting deduplication index migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }));
    
    // Get all audit logs that don't have deduplicationKey
    const auditLogs = await AuditLog.find({ deduplicationKey: { $exists: false } });
    console.log(`📊 Found ${auditLogs.length} audit logs without deduplicationKey`);
    
    if (auditLogs.length > 0) {
      console.log('🔄 Adding deduplicationKey to existing audit logs...');
      
      for (const auditLog of auditLogs) {
        const source = auditLog.metadata?.source || 'unknown';
        const timestamp = Math.floor(auditLog.timestamp.getTime() / 1000);
        const deduplicationKey = `${auditLog.documentId}:${auditLog.operation}:${source}:${timestamp}`;
        
        await AuditLog.updateOne(
          { _id: auditLog._id },
          { $set: { deduplicationKey } }
        );
      }
      
      console.log('✅ Added deduplicationKey to all existing audit logs');
    }
    
    // Create unique index on deduplicationKey
    console.log('🔧 Creating unique index on deduplicationKey...');
    await AuditLog.collection.createIndex(
      { deduplicationKey: 1 },
      { unique: true, name: 'deduplicationKey_unique' }
    );
    
    console.log('✅ Unique index created successfully');
    
    // Test the index
    const indexInfo = await AuditLog.collection.indexes();
    const dedupIndex = indexInfo.find(index => index.name === 'deduplicationKey_unique');
    
    if (dedupIndex) {
      console.log('✅ Deduplication index verified:', dedupIndex);
    } else {
      console.log('❌ Deduplication index not found');
    }
    
    console.log('🎉 Deduplication migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  addDeduplicationIndex()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addDeduplicationIndex;
