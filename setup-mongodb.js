const { MongoClient } = require('mongodb');

async function setupMongoDB() {
  const uri = 'mongodb://localhost:27017/toolvio';
  
  try {
    console.log('🔍 Connecting to MongoDB...');
    const client = new MongoClient(uri);
    
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');
    
    const db = client.db('toolvio');
    
    // Check if replica set is already configured
    try {
      const adminDb = client.db('admin');
      const rsStatus = await adminDb.command({ replSetGetStatus: 1 });
      console.log('✅ Replica set is already configured:', rsStatus.set);
    } catch (error) {
      if (error.message.includes('replSetGetStatus')) {
        console.log('⚠️  Replica set not configured. You need to initialize it manually.');
        console.log('');
        console.log('📋 To set up replica set, follow these steps:');
        console.log('1. Open MongoDB Compass or MongoDB Shell');
        console.log('2. Connect to: mongodb://localhost:27017');
        console.log('3. Run this command in the shell:');
        console.log('');
        console.log('rs.initiate({');
        console.log('  _id: "rs0",');
        console.log('  members: [');
        console.log('    { _id: 0, host: "localhost:27017" }');
        console.log('  ]');
        console.log('})');
        console.log('');
        console.log('4. Wait for the replica set to initialize');
        console.log('5. Then restart your application');
      } else {
        console.error('❌ Error checking replica set status:', error.message);
      }
    }
    
    // Test creating a collection
    try {
      const testCollection = db.collection('test_connection');
      await testCollection.insertOne({ test: true, timestamp: new Date() });
      console.log('✅ Database write test successful');
      await testCollection.deleteOne({ test: true });
      console.log('✅ Database cleanup successful');
    } catch (error) {
      console.error('❌ Database write test failed:', error.message);
    }
    
    await client.close();
    console.log('🔒 Connection closed');
    
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting steps:');
    console.log('1. Make sure MongoDB service is running');
    console.log('2. Check if MongoDB is listening on port 27017');
    console.log('3. Verify firewall settings');
    console.log('4. Check MongoDB logs for errors');
  }
}

// Run the setup
setupMongoDB();
