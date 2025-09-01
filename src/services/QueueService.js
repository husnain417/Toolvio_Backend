const queueManager = require('../queues');
const auditQueue = require('../queues/auditQueue');
const maintenanceQueue = require('../queues/maintenanceQueue');

class QueueService {
  constructor() {
    this.isInitialized = false;
    this.redisAvailable = false;
  }

  /**
   * Initialize the queue service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('📋 Queue service already initialized');
      return;
    }

    try {
      console.log('📋 Initializing queue service...');
      
      // Check if Redis is available
      this.redisAvailable = await this.isRedisAvailable();
      
      if (!this.redisAvailable) {
        console.log('⚠️  Redis is not available. Queue service will run in fallback mode.');
        console.log('   Audit operations will be processed synchronously.');
        this.isInitialized = true;
        return;
      }
      
      // Initialize queue manager
      await queueManager.initialize();
      
      this.isInitialized = true;
      console.log('✅ Queue service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize queue service:', error);
      console.log('⚠️  Queue service will run in fallback mode.');
      console.log('   Audit operations will be processed synchronously.');
      this.isInitialized = true;
    }
  }

  /**
   * Check if Redis is available
   */
  async isRedisAvailable() {
    try {
      // Test Redis connection directly
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
      return true;
    } catch (error) {
      console.log('Redis connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get queue health status
   */
  async getHealthStatus() {
    if (!this.redisAvailable) {
      return {
        status: 'degraded',
        redis: 'disconnected',
        queues: {
          audit: { status: 'fallback', message: 'Synchronous processing' },
          maintenance: { status: 'fallback', message: 'Synchronous processing' }
        },
        timestamp: new Date().toISOString()
      };
    }

    return await queueManager.getHealthStatus();
  }

  /**
   * Add audit job to queue
   */
  async addAuditJob(auditData, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        // Fallback to synchronous processing
        console.log('⚠️  Redis unavailable, processing audit synchronously');
        const AuditService = require('./AuditService');
        const auditLog = await AuditService.logChange(auditData);
        return {
          id: `sync-${Date.now()}`,
          status: 'completed',
          result: auditLog
        };
      }

      // Use the initialized queue from queueManager
      const auditQueueInstance = queueManager.getQueue('audit');
      if (!auditQueueInstance) {
        throw new Error('Audit queue not initialized');
      }

      console.log('🔍 Adding audit job to queue:', {
        queueInstance: !!auditQueueInstance,
        auditData: {
          documentId: auditData.documentId,
          schemaName: auditData.schemaName,
          operation: auditData.operation
        }
      });

      // Use the BullMQ Queue object directly
      console.log('🔍 About to add job to BullMQ queue:', {
        queueType: typeof auditQueueInstance,
        hasAddMethod: typeof auditQueueInstance.add === 'function',
        queueName: auditQueueInstance.name
      });
      
      // FIX: Use BullMQ's native .add() method with correct job name
      const result = await auditQueueInstance.add('process-audit', auditData, {
        priority: options.priority || 1,
        delay: options.delay || 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        ...options
      });
      
      console.log('✅ Audit job added to Redis queue:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Failed to add audit job:', error);
      throw error;
    }
  }

  /**
   * Add bulk audit job to queue
   */
  async addBulkAuditJob(auditDataArray, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        // Fallback to synchronous processing
        console.log('⚠️  Redis unavailable, processing bulk audit synchronously');
        const AuditService = require('./AuditService');
        const results = [];
        
        for (const auditData of auditDataArray) {
          try {
            const auditLog = await AuditService.logChange(auditData);
            results.push({
              success: true,
              auditLogId: auditLog._id,
              version: auditLog.version
            });
          } catch (error) {
            results.push({
              success: false,
              error: error.message
            });
          }
        }
        
        return {
          id: `sync-bulk-${Date.now()}`,
          status: 'completed',
          result: { results }
        };
      }

      return await auditQueue.addBulkAuditJob(auditDataArray, options);
    } catch (error) {
      console.error('❌ Failed to add bulk audit job:', error);
      throw error;
    }
  }

  /**
   * Add audit cleanup job to queue
   */
  async addAuditCleanupJob(cleanupOptions, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        // Fallback to synchronous processing
        console.log('⚠️  Redis unavailable, processing cleanup synchronously');
        const AuditService = require('./AuditService');
        const result = await AuditService.cleanupOldAuditLogs(cleanupOptions);
        return {
          id: `sync-cleanup-${Date.now()}`,
          status: 'completed',
          result
        };
      }

      return await auditQueue.addCleanupJob(cleanupOptions, options);
    } catch (error) {
      console.error('❌ Failed to add audit cleanup job:', error);
      throw error;
    }
  }

  /**
   * Add audit rollback job to queue
   */
  async addAuditRollbackJob(rollbackData, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        // Fallback to synchronous processing
        console.log('⚠️  Redis unavailable, processing rollback synchronously');
        const AuditService = require('./AuditService');
        const result = await AuditService.revertToVersion(
          rollbackData.documentId,
          rollbackData.schemaName,
          rollbackData.targetVersion,
          {
            userId: rollbackData.userId,
            userAgent: rollbackData.userAgent,
            ipAddress: rollbackData.ipAddress,
            reason: rollbackData.reason
          }
        );
        return {
          id: `sync-rollback-${Date.now()}`,
          status: 'completed',
          result
        };
      }

      return await auditQueue.addRollbackJob(rollbackData, options);
    } catch (error) {
      console.error('❌ Failed to add audit rollback job:', error);
      throw error;
    }
  }

  /**
   * Add maintenance job to queue
   */
  async addMaintenanceJob(jobType, jobData, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        // Fallback to synchronous processing
        console.log(`⚠️  Redis unavailable, processing ${jobType} synchronously`);
        const maintenanceProcessor = require('../queues/processors/maintenanceProcessor');
        
        let result;
        switch (jobType) {
          case 'audit-cleanup':
            result = await maintenanceProcessor.processAuditCleanup(jobData);
            break;
          case 'generate-stats':
            result = await maintenanceProcessor.processStatsGeneration(jobData);
            break;
          case 'database':
            result = await maintenanceProcessor.processDatabaseMaintenance(jobData);
            break;
          case 'scheduled-cleanup':
            result = await maintenanceProcessor.processScheduledCleanup(jobData);
            break;
          case 'health-check':
            result = await maintenanceProcessor.processHealthCheck(jobData);
            break;
          default:
            throw new Error(`Unknown maintenance job type: ${jobType}`);
        }
        
        return {
          id: `sync-${jobType}-${Date.now()}`,
          status: 'completed',
          result
        };
      }

      switch (jobType) {
        case 'audit-cleanup':
          return await maintenanceQueue.addAuditCleanupJob(jobData, options);
          
        case 'generate-stats':
          return await maintenanceQueue.addStatsJob(jobData, options);
          
        case 'database':
          return await maintenanceQueue.addDatabaseMaintenanceJob(jobData, options);
          
        case 'scheduled-cleanup':
          return await maintenanceQueue.addScheduledCleanupJob(jobData, options);
          
        case 'health-check':
          return await maintenanceQueue.addHealthCheckJob(jobData, options);
          
        default:
          throw new Error(`Unknown maintenance job type: ${jobType}`);
      }
    } catch (error) {
      console.error('❌ Failed to add maintenance job:', error);
      throw error;
    }
  }

  /**
   * Get job by ID from any queue
   */
  async getJob(jobId, queueName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return {
          id: jobId,
          status: 'completed',
          message: 'Job processed synchronously (Redis unavailable)'
        };
      }

      if (queueName === 'audit') {
        return await auditQueue.getJob(jobId);
      } else if (queueName === 'maintenance') {
        return await maintenanceQueue.getJob(jobId);
      } else {
        throw new Error(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      console.error('❌ Failed to get job:', error);
      throw error;
    }
  }

  /**
   * Get all jobs from a specific queue
   */
  async getAllJobs(queueName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return {
          waiting: [],
          active: [],
          completed: [],
          failed: [],
          delayed: []
        };
      }

      if (queueName === 'audit') {
        return await auditQueue.getAllJobs();
      } else if (queueName === 'maintenance') {
        return await maintenanceQueue.getAllJobs();
      } else {
        throw new Error(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      console.error('❌ Failed to get all jobs:', error);
      throw error;
    }
  }

  /**
   * Retry failed jobs in a specific queue
   */
  async retryFailedJobs(queueName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return { message: 'No failed jobs to retry (Redis unavailable)' };
      }

      if (queueName === 'audit') {
        return await auditQueue.retryFailedJobs();
      } else if (queueName === 'maintenance') {
        return await maintenanceQueue.retryFailedJobs();
      } else {
        throw new Error(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      console.error('❌ Failed to retry failed jobs:', error);
      throw error;
    }
  }

  /**
   * Clean jobs from a specific queue
   */
  async cleanJobs(queueName, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return { message: 'No jobs to clean (Redis unavailable)' };
      }

      if (queueName === 'audit') {
        return await auditQueue.cleanJobs(options);
      } else if (queueName === 'maintenance') {
        return await maintenanceQueue.cleanJobs(options);
      } else {
        throw new Error(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      console.error('❌ Failed to clean jobs:', error);
      throw error;
    }
  }

  /**
   * Pause a specific queue
   */
  async pauseQueue(queueName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return { message: 'Queue already paused (Redis unavailable)' };
      }

      if (queueName === 'audit') {
        return await auditQueue.pause();
      } else if (queueName === 'maintenance') {
        return await maintenanceQueue.pause();
      } else {
        throw new Error(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      console.error('❌ Failed to pause queue:', error);
      throw error;
    }
  }

  /**
   * Resume a specific queue
   */
  async resumeQueue(queueName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return { message: 'Queue already resumed (Redis unavailable)' };
      }

      if (queueName === 'audit') {
        return await auditQueue.resume();
      } else if (queueName === 'maintenance') {
        return await maintenanceQueue.resume();
      } else {
        throw new Error(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      console.error('❌ Failed to resume queue:', error);
      throw error;
    }
  }

  /**
   * Get status of a specific queue
   */
  async getQueueStatus(queueName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return {
          name: queueName,
          status: 'fallback',
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          workers: 0,
          hasScheduler: false,
          message: 'Processing synchronously (Redis unavailable)'
        };
      }

      if (queueName === 'audit') {
        return await auditQueue.getStatus();
      } else if (queueName === 'maintenance') {
        return await maintenanceQueue.getStatus();
      } else {
        throw new Error(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      console.error('❌ Failed to get queue status:', error);
      throw error;
    }
  }

  /**
   * Get status of all queues
   */
  async getAllQueuesStatus() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return {
          audit: {
            name: 'audit',
            status: 'fallback',
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            workers: 0,
            hasScheduler: false,
            message: 'Processing synchronously (Redis unavailable)'
          },
          maintenance: {
            name: 'maintenance',
            status: 'fallback',
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            workers: 0,
            hasScheduler: false,
            message: 'Processing synchronously (Redis unavailable)'
          },
          timestamp: new Date().toISOString()
        };
      }

      const [auditStatus, maintenanceStatus] = await Promise.all([
        auditQueue.getStatus(),
        maintenanceQueue.getStatus()
      ]);

      return {
        audit: auditStatus,
        maintenance: maintenanceStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get all queues status:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.redisAvailable) {
        return {
          audit: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
          maintenance: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
        };
      }

      return await queueManager.getQueueStats();
    } catch (error) {
      console.error('❌ Failed to get queue stats:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown all queues
   */
  async shutdown() {
    try {
      if (this.isInitialized && this.redisAvailable) {
        await queueManager.shutdown();
      }
      this.isInitialized = false;
      this.redisAvailable = false;
      console.log('✅ Queue service shut down successfully');
    } catch (error) {
      console.error('❌ Error during queue service shutdown:', error);
      throw error;
    }
  }

  /**
   * Process change stream event by queuing it
   */
  async processChangeStreamEvent(changeEvent, schema) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const { operationType, documentKey, fullDocument, fullDocumentBeforeChange } = changeEvent;
      
      // Add to audit queue for processing
      const job = await this.addAuditJob({
        documentId: documentKey._id,
        schemaName: schema.name,
        collectionName: schema.collectionName,
        operation: this.mapOperationType(operationType),
        tenantId: schema.tenantId, // CRITICAL: Pass tenantId from schema
        currentState: fullDocument,
        previousState: fullDocumentBeforeChange,
        metadata: {
          source: 'changeStream',
          operationType,
          timestamp: new Date().toISOString()
        }
      }, {
        priority: 1, // High priority for change stream events
        delay: 0
      });

      return {
        success: true,
        jobId: job.id,
        message: 'Change stream event queued for processing'
      };
      
    } catch (error) {
      console.error('❌ Failed to process change stream event:', error);
      throw error;
    }
  }

  /**
   * Map MongoDB operation type to audit operation type
   */
  mapOperationType(operationType) {
    const mapping = {
      'insert': 'create',
      'update': 'update',
      'delete': 'delete'
    };
    
    return mapping[operationType] || operationType;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      redisAvailable: this.redisAvailable,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new QueueService();
