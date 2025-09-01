const express = require('express');
const auditController = require('../controllers/auditController');
const { captureAuditContext, validateRevertPermissions, validateVersionNumber } = require('../middleware/Audit');
const { schemaExists, validateRecordId, validatePagination } = require('../middleware/validateSchema');
const { authenticate, requireTenantAccess, authorize } = require('../middleware/auth');
const SchemaService = require('../services/SchemaService'); // Added for debug endpoint

const router = express.Router();

// Debug middleware to track request flow
router.use((req, res, next) => {
  console.log('🔍 DEBUG: Audit route request -', req.method, req.path);
  next();
});

// Apply authentication and tenant access to all routes
router.use(authenticate);
router.use(requireTenantAccess);

// Apply audit context capture AFTER authentication
router.use(captureAuditContext);

// Apply authorization to all routes
router.use(authorize('audit', 'read'));

// Debug endpoint to test Redis connection and audit service
router.get('/debug-redis', async (req, res) => {
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      lazyConnect: true,
      retryDelayOnFailover: 100
    });
    
    await redis.ping();
    await redis.quit();
    
    res.json({
      success: true,
      message: 'Redis connection successful',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: process.env.REDIS_DB || 0
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: process.env.REDIS_DB || 0
      }
    });
  }
});

// Debug endpoint to test audit service directly
router.get('/test-audit-direct', async (req, res) => {
  try {
    const AuditService = require('../services/AuditService');
    const testAudit = await AuditService.logChange({
      documentId: "test-123",
      schemaName: "customer",
      collectionName: "customers",
      operation: "test",
      userId: "test-user",
      currentState: { test: true },
      metadata: {
        tenantId: req.user?.tenantId || 'test-tenant'
      }
    });
    
    res.json({
      success: true,
      message: "Direct audit test successful",
      auditId: testAudit._id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to manually process queue
router.post('/debug/process-queue', async (req, res) => {
  try {
    const queueManager = require('../queues');
    const auditQueue = queueManager.getQueue('audit');
    const waitingJobs = await auditQueue.getWaiting();
    
    console.log(`Found ${waitingJobs.length} waiting jobs`);
    
    if (waitingJobs.length > 0) {
      const job = waitingJobs[0];
      console.log('First job data:', job.data);
      console.log('Job name:', job.name);
      
      // Try processing manually
      const AuditService = require('../services/AuditService');
      const result = await AuditService.logChange(job.data);
      await job.remove(); // Remove from queue
      
      res.json({
        success: true,
        message: "Manually processed first job",
        jobId: job.id,
        jobName: job.name,
        auditResult: result._id
      });
    } else {
      res.json({
        success: true,
        message: "No jobs in queue to process"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to test audit flow
router.post('/debug-create/:schemaName', async (req, res) => {
  console.log('🔍 DEBUG CREATE START');
  console.log('req.user:', req.user);
  console.log('req.auditContext:', req.auditContext);
  
  try {
    // Test schema lookup with both methods
    const schema1 = await SchemaService.getSchemaByName(req.user?.tenantId, req.params.schemaName);
    const schema2 = await SchemaService.getSchemaByName(req.auditContext?.tenantId, req.params.schemaName);
    
    res.json({
      success: true,
      debug: {
        userTenantId: req.user?.tenantId,
        auditTenantId: req.auditContext?.tenantId,
        schemaFoundWithUser: !!schema1,
        schemaFoundWithAudit: !!schema2,
        auditContext: req.auditContext
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      debug: {
        userTenantId: req.user?.tenantId,
        auditTenantId: req.auditContext?.tenantId
      }
    });
  }
});

// Debug endpoint to check QueueService status
router.get('/debug-queue-status', async (req, res) => {
  try {
    const QueueService = require('../services/QueueService');
    
    const status = {
      isInitialized: QueueService.isInitialized,
      redisAvailable: QueueService.redisAvailable,
      healthStatus: await QueueService.getHealthStatus()
    };
    
    res.json({
      success: true,
      message: 'Queue service status',
      status: status
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to check queue contents
router.get('/debug-queue-jobs', async (req, res) => {
  try {
    const QueueService = require('../services/QueueService');
    
    // Get queue status
    const queueStatus = await QueueService.getQueueStatus('audit');
    
    // Try to get jobs from the queue
    let jobs = [];
    try {
      const auditQueue = require('../queues/auditQueue');
      if (auditQueue.queue) {
        jobs = await auditQueue.queue.getJobs(['waiting', 'active', 'completed', 'failed']);
      }
    } catch (error) {
      console.log('Could not get jobs from queue:', error.message);
    }
    
    res.json({
      success: true,
      message: 'Queue jobs status',
      queueStatus: queueStatus,
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        data: job.data,
        timestamp: job.timestamp
      }))
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test audit service directly
router.get('/test-audit-direct', async (req, res) => {
  try {
    const AuditService = require('../services/AuditService');
    const testAudit = await AuditService.logChange({
      documentId: "test-123",
      schemaName: "customer",
      collectionName: "customers",
      operation: "test",
      userId: "test-user",
      currentState: { test: true },
      metadata: {
        tenantId: req.user?.tenantId || 'test-tenant'
      }
    });
    
    res.json({
      success: true,
      message: "Direct audit test successful",
      auditId: testAudit._id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to manually process queue
router.post('/debug/process-queue', async (req, res) => {
  try {
    const queueManager = require('../queues');
    const auditQueue = queueManager.getQueue('audit');
    const waitingJobs = await auditQueue.getWaiting();
    
    console.log(`Found ${waitingJobs.length} waiting jobs`);
    
    if (waitingJobs.length > 0) {
      const job = waitingJobs[0];
      console.log('First job data:', job.data);
      console.log('Job name:', job.name);
      
      // Try processing manually
      const AuditService = require('../services/AuditService');
      const result = await AuditService.logChange(job.data);
      await job.remove(); // Remove from queue
      
      res.json({
        success: true,
        message: "Manually processed first job",
        jobId: job.id,
        jobName: job.name,
        auditResult: result._id
      });
    } else {
      res.json({
        success: true,
        message: "No jobs in queue to process"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint for Redis audit system
router.get('/health/redis-audit', async (req, res) => {
  try {
    const queueManager = require('../queues');
    const auditQueue = queueManager.getQueue('audit');
    
    if (!auditQueue) {
      return res.status(500).json({
        success: false,
        error: 'Audit queue not initialized',
        redis: { connected: false }
      });
    }
    
    // Test Redis connection by adding a test job
    const testJob = await auditQueue.add('health-check', { 
      test: true, 
      timestamp: new Date() 
    });
    
    // Check queue stats
    const waiting = await auditQueue.getWaiting();
    const active = await auditQueue.getActive();
    const completed = await auditQueue.getCompleted();
    const failed = await auditQueue.getFailed();
    
    res.json({
      success: true,
      redis: {
        connected: true,
        testJobId: testJob.id
      },
      queueStats: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      redis: {
        connected: false
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get audit history for a specific document
router.get('/:schemaName/:documentId/history', 
  (req, res, next) => {
    console.log('🔍 DEBUG: Route matched - /:schemaName/:documentId/history');
    console.log('🔍 DEBUG: Route params:', req.params);
    console.log('🔍 DEBUG: About to call schemaExists middleware');
    next();
  },
  (req, res, next) => {
    console.log('🔍 DEBUG: Before schemaExists middleware');
    next();
  },
  schemaExists(), 
  (req, res, next) => {
    console.log('🔍 DEBUG: After schemaExists middleware');
    next();
  },
  (req, res, next) => {
    console.log('🔍 DEBUG: Before validateRecordId middleware');
    next();
  },
  validateRecordId('documentId'), 
  (req, res, next) => {
    console.log('🔍 DEBUG: After validateRecordId middleware');
    next();
  },
  validatePagination, 
  auditController.getDocumentAuditHistory
);

// Get audit history for all documents in a schema
router.get('/:schemaName/history', 
  schemaExists(), 
  validatePagination, 
  auditController.getSchemaAuditHistory
);

// Get document at a specific version
router.get('/:schemaName/:documentId/versions/:version', 
  schemaExists(), 
  validateRecordId('documentId'), 
  validateVersionNumber, 
  auditController.getDocumentAtVersion
);

// Get all versions of a document
router.get('/:schemaName/:documentId/versions', 
  schemaExists(), 
  validateRecordId('documentId'), 
  validatePagination, 
  auditController.getDocumentVersions
);

// Compare two versions of a document
router.get('/:schemaName/:documentId/compare', 
  schemaExists(), 
  validateRecordId('documentId'), 
  auditController.compareDocumentVersions
);

// Get audit statistics for a schema
router.get('/:schemaName/stats', 
  schemaExists(), 
  auditController.getAuditStats
);

// Get audit summary for a schema
router.get('/:schemaName/summary', 
  schemaExists(), 
  auditController.getAuditSummary
);

// Revert document to a specific version (requires rollback permission)
router.post('/:schemaName/:documentId/revert/:version', 
  authorize('audit', 'rollback'),
  schemaExists(), 
  validateRecordId('documentId'), 
  validateVersionNumber, 
  validateRevertPermissions, 
  auditController.revertDocumentToVersion
);

// Bulk revert multiple documents (requires rollback permission)
router.post('/:schemaName/bulk-revert', 
  authorize('audit', 'rollback'),
  schemaExists(), 
  auditController.bulkRevertDocuments
);

// Cleanup old audit logs (requires admin permission)
router.post('/:schemaName/cleanup', 
  authorize('audit', 'admin'),
  schemaExists(), 
  auditController.cleanupAuditLogs
);

// Job status and queue management routes
router.get('/jobs/:jobId/status', auditController.getAuditJobStatus);
router.get('/queue/status', auditController.getAuditQueueStatus);

module.exports = router;