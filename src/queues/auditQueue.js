const { Queue, Worker, QueueScheduler } = require('bullmq');
const auditProcessor = require('./processors/auditProcessor');

class AuditQueue {
  constructor() {
    this.queue = null;
    this.workers = [];
    this.scheduler = null;
  }

  /**
   * Initialize the audit queue
   */
  async initialize(redis) {
    try {
      console.log('📋 Initializing audit queue...');
      
      this.queue = new Queue('audit', {
        connection: redis,
        defaultJobOptions: {
          attempts: parseInt(process.env.AUDIT_JOB_ATTEMPTS) || 3,
          backoff: {
            type: process.env.AUDIT_JOB_BACKOFF || 'exponential',
            delay: 2000
          },
          removeOnComplete: 100,
          removeOnFail: 50,
          timeout: 30000 // 30 seconds
        }
      });

      // Handle queue events
      this.queue.on('error', (error) => {
        console.error('❌ Audit queue error:', error);
      });

      this.queue.on('waiting', (job) => {
        console.log(`⏳ Audit job ${job.id} waiting`);
      });

      this.queue.on('active', (job) => {
        console.log(`🔄 Audit job ${job.id} started processing`);
      });

      this.queue.on('completed', (job, result) => {
        console.log(`✅ Audit job ${job.id} completed successfully`);
      });

      this.queue.on('failed', (job, error) => {
        console.error(`❌ Audit job ${job.id} failed:`, error.message);
      });

      console.log('✅ Audit queue initialized');
      return this.queue;
      
    } catch (error) {
      console.error('❌ Failed to initialize audit queue:', error);
      throw error;
    }
  }

  /**
   * Initialize workers for the audit queue
   */
  async initializeWorkers(redis) {
    try {
      console.log('📋 Initializing audit queue workers...');
      
      const concurrency = parseInt(process.env.QUEUE_CONCURRENCY) || 5;
      
      // Create multiple workers for better performance
      for (let i = 0; i < concurrency; i++) {
        const worker = new Worker('audit', auditProcessor.processJob, {
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB) || 0,
            maxRetriesPerRequest: null
          },
          concurrency: 1, // Each worker processes one job at a time
          prefix: 'audit'
        });

        // Handle worker events
        worker.on('completed', (job) => {
          console.log(`✅ Worker ${i + 1} completed job ${job.id}`);
        });

        worker.on('failed', (job, error) => {
          console.error(`❌ Worker ${i + 1} failed job ${job.id}:`, error.message);
        });

        worker.on('error', (error) => {
          console.error(`❌ Worker ${i + 1} error:`, error);
        });

        this.workers.push(worker);
      }

      console.log(`✅ Initialized ${this.workers.length} audit workers`);
      return this.workers;
      
    } catch (error) {
      console.error('❌ Failed to initialize audit workers:', error);
      throw error;
    }
  }

  /**
   * Initialize scheduler for delayed jobs
   */
  async initializeScheduler(redis) {
    try {
      console.log('📋 Initializing audit queue scheduler...');
      
      this.scheduler = new QueueScheduler('audit', {
        connection: redis
      });

      this.scheduler.on('error', (error) => {
        console.error('❌ Audit scheduler error:', error);
      });

      console.log('✅ Audit scheduler initialized');
      return this.scheduler;
      
    } catch (error) {
      console.error('❌ Failed to initialize audit scheduler:', error);
      return null;
    }
  }

  /**
   * Add audit creation job
   */
  async addAuditJob(jobData, options = {}) {
    try {
      const job = await this.queue.add('audit:create', jobData, {
        priority: options.priority || 1,
        delay: options.delay || 0,
        ...options
      });

      console.log(`📋 Added audit job ${job.id} to queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add audit job:', error);
      throw error;
    }
  }

  /**
   * Add bulk audit creation job
   */
  async addBulkAuditJob(auditDataArray, options = {}) {
    try {
      const job = await this.queue.add('audit:bulk-create', {
        audits: auditDataArray
      }, {
        priority: options.priority || 2,
        delay: options.delay || 0,
        ...options
      });

      console.log(`📋 Added bulk audit job ${job.id} to queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add bulk audit job:', error);
      throw error;
    }
  }

  /**
   * Add audit cleanup job
   */
  async addCleanupJob(cleanupOptions, options = {}) {
    try {
      const job = await this.queue.add('audit:cleanup', cleanupOptions, {
        priority: options.priority || 3,
        delay: options.delay || 0,
        ...options
      });

      console.log(`📋 Added audit cleanup job ${job.id} to queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add audit cleanup job:', error);
      throw error;
    }
  }

  /**
   * Add audit rollback job
   */
  async addRollbackJob(rollbackData, options = {}) {
    try {
      const job = await this.queue.add('audit:rollback', rollbackData, {
        priority: options.priority || 1, // High priority for rollbacks
        delay: options.delay || 0,
        ...options
      });

      console.log(`📋 Added audit rollback job ${job.id} to queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add audit rollback job:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId) {
    try {
      return await this.queue.getJob(jobId);
    } catch (error) {
      console.error('❌ Failed to get job:', error);
      return null;
    }
  }

  /**
   * Get all jobs in the queue
   */
  async getAllJobs() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed()
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed
      };
    } catch (error) {
      console.error('❌ Failed to get all jobs:', error);
      throw error;
    }
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs() {
    try {
      const failedJobs = await this.queue.getFailed();
      const retryPromises = failedJobs.map(job => job.retry());
      
      await Promise.all(retryPromises);
      console.log(`✅ Retried ${failedJobs.length} failed jobs`);
      
      return { retried: failedJobs.length };
    } catch (error) {
      console.error('❌ Failed to retry failed jobs:', error);
      throw error;
    }
  }

  /**
   * Clean completed and failed jobs
   */
  async cleanJobs(options = {}) {
    try {
      const { completed = 100, failed = 50 } = options;
      
      await this.queue.clean(completed, 'completed');
      await this.queue.clean(failed, 'failed');
      
      console.log('✅ Cleaned old jobs from queue');
      return { cleaned: true };
    } catch (error) {
      console.error('❌ Failed to clean jobs:', error);
      throw error;
    }
  }

  /**
   * Pause the queue
   */
  async pause() {
    try {
      await this.queue.pause();
      console.log('⏸️ Audit queue paused');
      return { paused: true };
    } catch (error) {
      console.error('❌ Failed to pause queue:', error);
      throw error;
    }
  }

  /**
   * Resume the queue
   */
  async resume() {
    try {
      await this.queue.resume();
      console.log('▶️ Audit queue resumed');
      return { resumed: true };
    } catch (error) {
      console.error('❌ Failed to resume queue:', error);
      throw error;
    }
  }

  /**
   * Get queue status
   */
  async getStatus() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed()
      ]);

      return {
        name: 'audit',
        status: 'active',
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        workers: this.workers.length,
        hasScheduler: !!this.scheduler
      };
    } catch (error) {
      console.error('❌ Failed to get queue status:', error);
      return {
        name: 'audit',
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new AuditQueue();
