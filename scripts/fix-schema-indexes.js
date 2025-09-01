const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toolivo_backend', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function fixSchemaIndexes() {
  try {
    console.log('🔍 Fixing schema indexes...');
    
    // Wait for connection to be ready
    await mongoose.connection.asPromise();
    
    const db = mongoose.connection.db;
    const collection = db.collection('schemadefinitions');
    
    // List current indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:');
    indexes.forEach((index, i) => {
      console.log(`  ${i}: ${JSON.stringify(index.key)} - unique: ${index.unique}`);
    });
    
    // Find and drop the problematic name_1 index
    const nameIndex = indexes.find(index => 
      Object.keys(index.key).length === 1 && index.key.name === 1
    );
    
    if (nameIndex) {
      console.log('🗑️  Dropping problematic name_1 index...');
      await collection.dropIndex('name_1');
      console.log('✅ Dropped name_1 index');
    } else {
      console.log('✅ No problematic name_1 index found');
    }
    
    // Verify the compound index exists
    const compoundIndex = indexes.find(index => 
      index.key.tenantId === 1 && index.key.name === 1
    );
    
    if (compoundIndex) {
      console.log('✅ Compound index { tenantId: 1, name: 1 } exists');
    } else {
      console.log('⚠️  Compound index not found - it will be created on next schema save');
    }
    
    console.log('✅ Schema indexes fixed successfully');
    
  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run fix
fixSchemaIndexes();
