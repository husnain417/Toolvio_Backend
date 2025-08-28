const express = require('express');
const queueController = require('../controllers/queueController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply admin role requirement to all routes
router.use(requireRole(['admin']));

// Queue overview and status
router.get('/', queueController.getAllQueuesStatus);
router.get('/health', queueController.getQueueHealth);
router.get('/stats', queueController.getQueueStats);

// Individual queue management
router.get('/:queueName', queueController.getQueueStatus);
router.get('/:queueName/jobs', queueController.getQueueJobs);
router.get('/:queueName/failed', queueController.getFailedJobs);
router.get('/:queueName/completed', queueController.getCompletedJobs);
router.get('/:queueName/waiting', queueController.getWaitingJobs);
router.get('/:queueName/active', queueController.getActiveJobs);
router.get('/:queueName/delayed', queueController.getDelayedJobs);

// Queue control operations
router.post('/:queueName/pause', queueController.pauseQueue);
router.post('/:queueName/resume', queueController.resumeQueue);
router.post('/:queueName/retry-failed', queueController.retryFailedJobs);
router.post('/:queueName/clean', queueController.cleanQueueJobs);

// Job management
router.get('/:queueName/jobs/:jobId', queueController.getJobById);
router.post('/:queueName/jobs/:jobId/retry', queueController.retryJob);
router.delete('/:queueName/jobs/:jobId', queueController.removeJob);

// Maintenance operations
router.post('/maintenance/audit-cleanup', queueController.addAuditCleanupJob);
router.post('/maintenance/generate-stats', queueController.addStatsGenerationJob);
router.post('/maintenance/database', queueController.addDatabaseMaintenanceJob);
router.post('/maintenance/scheduled-cleanup', queueController.addScheduledCleanupJob);
router.post('/maintenance/health-check', queueController.addHealthCheckJob);

module.exports = router;
