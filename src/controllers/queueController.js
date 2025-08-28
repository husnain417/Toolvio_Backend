const QueueService = require('../services/QueueService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Queue Controller
 * Handles all queue management and monitoring operations
 */
class QueueController {
  constructor() {
    // Bind all methods to preserve 'this' context
    this.getAllQueuesStatus = this.getAllQueuesStatus.bind(this);
    this.getQueueHealth = this.getQueueHealth.bind(this);
    this.getQueueStats = this.getQueueStats.bind(this);
    this.getQueueStatus = this.getQueueStatus.bind(this);
    this.getQueueJobs = this.getQueueJobs.bind(this);
    this.getFailedJobs = this.getFailedJobs.bind(this);
    this.getCompletedJobs = this.getCompletedJobs.bind(this);
    this.getWaitingJobs = this.getWaitingJobs.bind(this);
    this.getActiveJobs = this.getActiveJobs.bind(this);
    this.getDelayedJobs = this.getDelayedJobs.bind(this);
    this.pauseQueue = this.pauseQueue.bind(this);
    this.resumeQueue = this.resumeQueue.bind(this);
    this.retryFailedJobs = this.retryFailedJobs.bind(this);
    this.cleanQueueJobs = this.cleanQueueJobs.bind(this);
    this.getJobById = this.getJobById.bind(this);
    this.retryJob = this.retryJob.bind(this);
    this.removeJob = this.removeJob.bind(this);
    this.addAuditCleanupJob = this.addAuditCleanupJob.bind(this);
    this.addStatsGenerationJob = this.addStatsGenerationJob.bind(this);
    this.addDatabaseMaintenanceJob = this.addDatabaseMaintenanceJob.bind(this);
    this.addScheduledCleanupJob = this.addScheduledCleanupJob.bind(this);
    this.addHealthCheckJob = this.addHealthCheckJob.bind(this);
  }

  /**
   * Get status of all queues
   */
  async getAllQueuesStatus(req, res) {
    try {
      const status = await QueueService.getAllQueuesStatus();
      successResponse(res, status, 'Queue status retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(req, res) {
    try {
      const health = await QueueService.getHealthStatus();
      successResponse(res, health, 'Queue health status retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(req, res) {
    try {
      const stats = await QueueService.getQueueStats();
      successResponse(res, stats, 'Queue statistics retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get status of a specific queue
   */
  async getQueueStatus(req, res) {
    try {
      const { queueName } = req.params;
      const status = await QueueService.getQueueStatus(queueName);
      successResponse(res, status, `Queue status for ${queueName} retrieved successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get all jobs from a specific queue
   */
  async getQueueJobs(req, res) {
    try {
      const { queueName } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      const jobs = await QueueService.getAllJobs(queueName);
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      
      const paginatedJobs = {
        waiting: jobs.waiting.slice(startIndex, endIndex),
        active: jobs.active.slice(startIndex, endIndex),
        completed: jobs.completed.slice(startIndex, endIndex),
        failed: jobs.failed.slice(startIndex, endIndex),
        delayed: jobs.delayed.slice(startIndex, endIndex),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(Math.max(jobs.waiting.length, jobs.active.length, jobs.completed.length, jobs.failed.length, jobs.delayed.length) / limit),
          totalJobs: jobs.waiting.length + jobs.active.length + jobs.completed.length + jobs.failed.length + jobs.delayed.length,
          limit: parseInt(limit)
        }
      };
      
      successResponse(res, paginatedJobs, `Jobs for queue ${queueName} retrieved successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get failed jobs from a specific queue
   */
  async getFailedJobs(req, res) {
    try {
      const { queueName } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      const jobs = await QueueService.getAllJobs(queueName);
      
      // Apply pagination to failed jobs
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedFailedJobs = jobs.failed.slice(startIndex, endIndex);
      
      const result = {
        failed: paginatedFailedJobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(jobs.failed.length / limit),
          totalFailed: jobs.failed.length,
          limit: parseInt(limit)
        }
      };
      
      successResponse(res, result, `Failed jobs for queue ${queueName} retrieved successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get completed jobs from a specific queue
   */
  async getCompletedJobs(req, res) {
    try {
      const { queueName } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      const jobs = await QueueService.getAllJobs(queueName);
      
      // Apply pagination to completed jobs
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedCompletedJobs = jobs.completed.slice(startIndex, endIndex);
      
      const result = {
        completed: paginatedCompletedJobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(jobs.completed.length / limit),
          totalCompleted: jobs.completed.length,
          limit: parseInt(limit)
        }
      };
      
      successResponse(res, result, `Completed jobs for queue ${queueName} retrieved successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get waiting jobs from a specific queue
   */
  async getWaitingJobs(req, res) {
    try {
      const { queueName } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      const jobs = await QueueService.getAllJobs(queueName);
      
      // Apply pagination to waiting jobs
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedWaitingJobs = jobs.waiting.slice(startIndex, endIndex);
      
      const result = {
        waiting: paginatedWaitingJobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(jobs.waiting.length / limit),
          totalWaiting: jobs.waiting.length,
          limit: parseInt(limit)
        }
      };
      
      successResponse(res, result, `Waiting jobs for queue ${queueName} retrieved successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get active jobs from a specific queue
   */
  async getActiveJobs(req, res) {
    try {
      const { queueName } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      const jobs = await QueueService.getAllJobs(queueName);
      
      // Apply pagination to active jobs
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedActiveJobs = jobs.active.slice(startIndex, endIndex);
      
      const result = {
        active: paginatedActiveJobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(jobs.active.length / limit),
          totalActive: jobs.active.length,
          limit: parseInt(limit)
        }
      };
      
      successResponse(res, result, `Active jobs for queue ${queueName} retrieved successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get delayed jobs from a specific queue
   */
  async getDelayedJobs(req, res) {
    try {
      const { queueName } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      const jobs = await QueueService.getAllJobs(queueName);
      
      // Apply pagination to delayed jobs
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedDelayedJobs = jobs.delayed.slice(startIndex, endIndex);
      
      const result = {
        delayed: paginatedDelayedJobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(jobs.delayed.length / limit),
          totalDelayed: jobs.delayed.length,
          limit: parseInt(limit)
        }
      };
      
      successResponse(res, result, `Delayed jobs for queue ${queueName} retrieved successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Pause a specific queue
   */
  async pauseQueue(req, res) {
    try {
      const { queueName } = req.params;
      const result = await QueueService.pauseQueue(queueName);
      successResponse(res, result, `Queue ${queueName} paused successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Resume a specific queue
   */
  async resumeQueue(req, res) {
    try {
      const { queueName } = req.params;
      const result = await QueueService.resumeQueue(queueName);
      successResponse(res, result, `Queue ${queueName} resumed successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Retry all failed jobs in a specific queue
   */
  async retryFailedJobs(req, res) {
    try {
      const { queueName } = req.params;
      const result = await QueueService.retryFailedJobs(queueName);
      successResponse(res, result, `Failed jobs in queue ${queueName} retried successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Clean old jobs from a specific queue
   */
  async cleanQueueJobs(req, res) {
    try {
      const { queueName } = req.params;
      const { completed = 100, failed = 50 } = req.query;
      
      const result = await QueueService.cleanJobs(queueName, {
        completed: parseInt(completed),
        failed: parseInt(failed)
      });
      
      successResponse(res, result, `Queue ${queueName} cleaned successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get a specific job by ID
   */
  async getJobById(req, res) {
    try {
      const { queueName, jobId } = req.params;
      const job = await QueueService.getJob(jobId, queueName);
      
      if (!job) {
        return errorResponse(res, `Job ${jobId} not found in queue ${queueName}`, 404);
      }
      
      successResponse(res, job, `Job ${jobId} retrieved successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Retry a specific job
   */
  async retryJob(req, res) {
    try {
      const { queueName, jobId } = req.params;
      const job = await QueueService.getJob(jobId, queueName);
      
      if (!job) {
        return errorResponse(res, `Job ${jobId} not found in queue ${queueName}`, 404);
      }
      
      await job.retry();
      successResponse(res, { jobId, retried: true }, `Job ${jobId} retried successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Remove a specific job
   */
  async removeJob(req, res) {
    try {
      const { queueName, jobId } = req.params;
      const job = await QueueService.getJob(jobId, queueName);
      
      if (!job) {
        return errorResponse(res, `Job ${jobId} not found in queue ${queueName}`, 404);
      }
      
      await job.remove();
      successResponse(res, { jobId, removed: true }, `Job ${jobId} removed successfully`);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Add audit cleanup maintenance job
   */
  async addAuditCleanupJob(req, res) {
    try {
      const { olderThan, schemaName, operation, dryRun } = req.body;
      
      const job = await QueueService.addMaintenanceJob('audit-cleanup', {
        olderThan: parseInt(olderThan) || 365,
        schemaName,
        operation,
        dryRun: dryRun === true
      });
      
      successResponse(res, { jobId: job.id }, 'Audit cleanup job added to maintenance queue', 201);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Add statistics generation maintenance job
   */
  async addStatsGenerationJob(req, res) {
    try {
      const { schemaName, timeframe, includeAuditStats, includeSchemaStats } = req.body;
      
      const job = await QueueService.addMaintenanceJob('generate-stats', {
        schemaName,
        timeframe: timeframe || '30d',
        includeAuditStats: includeAuditStats !== false,
        includeSchemaStats: includeSchemaStats !== false
      });
      
      successResponse(res, { jobId: job.id }, 'Statistics generation job added to maintenance queue', 201);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Add database maintenance job
   */
  async addDatabaseMaintenanceJob(req, res) {
    try {
      const { operations, schemaName } = req.body;
      
      const job = await QueueService.addMaintenanceJob('database', {
        operations: operations || ['indexes', 'cleanup', 'validation'],
        schemaName
      });
      
      successResponse(res, { jobId: job.id }, 'Database maintenance job added to maintenance queue', 201);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Add scheduled cleanup maintenance job
   */
  async addScheduledCleanupJob(req, res) {
    try {
      const { auditRetentionDays, jobRetentionDays, schemaName } = req.body;
      
      const job = await QueueService.addMaintenanceJob('scheduled-cleanup', {
        auditRetentionDays: parseInt(auditRetentionDays) || 365,
        jobRetentionDays: parseInt(jobRetentionDays) || 30,
        schemaName
      });
      
      successResponse(res, { jobId: job.id }, 'Scheduled cleanup job added to maintenance queue', 201);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }

  /**
   * Add health check maintenance job
   */
  async addHealthCheckJob(req, res) {
    try {
      const { includeDatabase, includeQueues, includeSchemas } = req.body;
      
      const job = await QueueService.addMaintenanceJob('health-check', {
        includeDatabase: includeDatabase !== false,
        includeQueues: includeQueues !== false,
        includeSchemas: includeSchemas !== false
      });
      
      successResponse(res, { jobId: job.id }, 'Health check job added to maintenance queue', 201);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new QueueController();
