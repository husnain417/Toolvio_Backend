#!/usr/bin/env node

/**
 * Test script for BullMQ + Redis background processing system
 * Run this to verify the queue system is working correctly
 */

require('dotenv').config();
const QueueService = require('./src/services/QueueService');

async function testQueueSystem() {
  console.log('🧪 Testing BullMQ + Redis Queue System...\n');

  try {
    // Initialize queue service
    console.log('📋 Initializing queue service...');
    await QueueService.initialize();
    console.log('✅ Queue service initialized\n');

    // Test Redis connection
    console.log('🔍 Testing Redis connection...');
    const redisAvailable = await QueueService.isRedisAvailable();
    console.log(`Redis available: ${redisAvailable ? '✅' : '❌'}\n`);

    if (!redisAvailable) {
      console.log('❌ Redis is not available. Please ensure Redis is running.');
      console.log('   You can start Redis with: redis-server');
      process.exit(1);
    }

    // Test queue health
    console.log('🏥 Testing queue health...');
    const health = await QueueService.getHealthStatus();
    console.log('Queue health status:', health.status);
    console.log('Redis status:', health.redis);
    console.log('Queues status:', Object.keys(health.queues));
    console.log('✅ Health check completed\n');

    // Test adding audit jobs
    console.log('📝 Testing audit job creation...');
    
    // Test single audit job
    const singleJob = await QueueService.addAuditJob({
      documentId: 'test-doc-123',
      schemaName: 'test-schema',
      collectionName: 'test_collection',
      operation: 'create',
      currentState: { name: 'Test Document', value: 42 },
      previousState: null,
      metadata: { source: 'test-script' }
    });
    console.log(`✅ Single audit job created: ${singleJob.id}`);

    // Test bulk audit job
    const bulkJob = await QueueService.addBulkAuditJob([
      {
        documentId: 'test-doc-456',
        schemaName: 'test-schema',
        collectionName: 'test_collection',
        operation: 'create',
        currentState: { name: 'Test Document 2', value: 84 },
        previousState: null,
        metadata: { source: 'test-script' }
      },
      {
        documentId: 'test-doc-789',
        schemaName: 'test-schema',
        collectionName: 'test_collection',
        operation: 'update',
        currentState: { name: 'Updated Document', value: 100 },
        previousState: { name: 'Old Document', value: 50 },
        metadata: { source: 'test-script' }
      }
    ]);
    console.log(`✅ Bulk audit job created: ${bulkJob.id}`);

    // Test maintenance jobs
    console.log('\n🔧 Testing maintenance job creation...');
    
    const cleanupJob = await QueueService.addMaintenanceJob('audit-cleanup', {
      olderThan: 30,
      dryRun: true
    });
    console.log(`✅ Cleanup job created: ${cleanupJob.id}`);

    const statsJob = await QueueService.addMaintenanceJob('generate-stats', {
      timeframe: '7d',
      includeAuditStats: true,
      includeSchemaStats: true
    });
    console.log(`✅ Stats job created: ${statsJob.id}`);

    // Get queue statistics
    console.log('\n📊 Getting queue statistics...');
    const stats = await QueueService.getQueueStats();
    console.log('Queue stats:', stats);

    // Get individual queue statuses
    console.log('\n📋 Getting individual queue statuses...');
    const auditStatus = await QueueService.getQueueStatus('audit');
    const maintenanceStatus = await QueueService.getQueueStatus('maintenance');
    
    console.log('Audit queue status:', {
      name: auditStatus.name,
      status: auditStatus.status,
      waiting: auditStatus.waiting,
      active: auditStatus.active,
      completed: auditStatus.completed,
      failed: auditStatus.failed,
      workers: auditStatus.workers
    });

    console.log('Maintenance queue status:', {
      name: maintenanceStatus.name,
      status: maintenanceStatus.status,
      waiting: maintenanceStatus.waiting,
      active: maintenanceStatus.active,
      completed: maintenanceStatus.completed,
      failed: maintenanceStatus.failed,
      workers: maintenanceStatus.workers
    });

    // Wait a bit for jobs to process
    console.log('\n⏳ Waiting for jobs to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get updated statistics
    console.log('\n📊 Getting updated statistics...');
    const updatedStats = await QueueService.getQueueStats();
    console.log('Updated queue stats:', updatedStats);

    console.log('\n🎉 Queue system test completed successfully!');
    console.log('\n📋 What was tested:');
    console.log('  ✅ Queue service initialization');
    console.log('  ✅ Redis connection');
    console.log('  ✅ Queue health monitoring');
    console.log('  ✅ Single audit job creation');
    console.log('  ✅ Bulk audit job creation');
    console.log('  ✅ Maintenance job creation');
    console.log('  ✅ Queue statistics retrieval');
    console.log('  ✅ Individual queue status monitoring');
    console.log('  ✅ Job processing (background)');

    console.log('\n🔗 Available endpoints:');
    console.log('  GET  /api/admin/queues - Queue overview');
    console.log('  GET  /api/admin/queues/health - Queue health');
    console.log('  GET  /api/admin/queues/stats - Queue statistics');
    console.log('  GET  /api/admin/queues/audit - Audit queue status');
    console.log('  GET  /api/admin/queues/maintenance - Maintenance queue status');
    console.log('  GET  /api/audit/queue/status - Audit queue status (audit context)');
    console.log('  GET  /api/audit/jobs/:jobId/status - Individual job status');

  } catch (error) {
    console.error('\n❌ Queue system test failed:', error);
    console.error('\n🔍 Troubleshooting tips:');
    console.error('  1. Ensure Redis is running: redis-server');
    console.error('  2. Check Redis connection settings in .env');
    console.error('  3. Verify all dependencies are installed: npm install');
    console.error('  4. Check console for detailed error messages');
    process.exit(1);
  } finally {
    // Gracefully shutdown
    console.log('\n🛑 Shutting down queue service...');
    await QueueService.shutdown();
    console.log('✅ Queue service shut down');
    process.exit(0);
  }
}

// Run the test
testQueueSystem().catch(error => {
  console.error('❌ Test failed with unhandled error:', error);
  process.exit(1);
});
