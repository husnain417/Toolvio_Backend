const { Queue, Worker } = require('bullmq');
const maintenanceProcessor = require('./processors/maintenanceProcessor');

class MaintenanceQueue {
  constructor() {
    this.queue = null;
    this.workers = [];
    this.scheduler = null;
  }

  /**
   * Initialize the maintenance queue
   */
  async initialize(redis) {
    try {
      console.log('📋 Initializing maintenance queue...');
      
      this.queue = new Queue('maintenance', {
        connection: redis,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: 50,
          removeOnFail: 25,
          timeout: 60000 // 1 minute for maintenance tasks
        }
      });

      // Handle queue events
      this.queue.on('error', (error) => {
        console.error('❌ Maintenance queue error:', error);
      });

      this.queue.on('waiting', (job) => {
        console.log(`⏳ Maintenance job ${job.id} waiting`);
      });

      this.queue.on('active', (job) => {
        console.log(`🔄 Maintenance job ${job.id} started processing`);
      });

      this.queue.on('completed', (job, result) => {
        console.log(`✅ Maintenance job ${job.id} completed successfully`);
      });

      this.queue.on('failed', (job, error) => {
        console.error(`❌ Maintenance job ${job.id} failed:`, error.message);
      });

      console.log('✅ Maintenance queue initialized');
      return this.queue;
      
    } catch (error) {
      console.error('❌ Failed to initialize maintenance queue:', error);
      throw error;
    }
  }

  /**
   * Initialize workers for the maintenance queue
   */
  async initializeWorkers(redis) {
    try {
      console.log('📋 Initializing maintenance queue workers...');
      
      // Maintenance queue uses fewer workers since tasks are less frequent
      const concurrency = Math.max(1, Math.floor((parseInt(process.env.QUEUE_CONCURRENCY) || 5) / 2));
      
      for (let i = 0; i < concurrency; i++) {
        const worker = new Worker('maintenance', maintenanceProcessor.processJob, {
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB) || 0,
            maxRetriesPerRequest: null
          },
          concurrency: 1,
          prefix: 'maintenance'
        });

        // Handle worker events
        worker.on('completed', (job) => {
          console.log(`✅ Maintenance worker ${i + 1} completed job ${job.id}`);
        });

        worker.on('failed', (job, error) => {
          console.error(`❌ Maintenance worker ${i + 1} failed job ${job.id}:`, error.message);
        });

        worker.on('error', (error) => {
          console.error(`❌ Maintenance worker ${i + 1} error:`, error);
        });

        this.workers.push(worker);
      }

      console.log(`✅ Initialized ${this.workers.length} maintenance workers`);
      return this.workers;
      
    } catch (error) {
      console.error('❌ Failed to initialize maintenance workers:', error);
      throw error;
    }
  }

  /**
   * Initialize scheduler for delayed jobs
   */
  async initializeScheduler(redis) {
    try {
      console.log('📋 Initializing maintenance queue scheduler...');
      
      // QueueScheduler temporarily disabled due to BullMQ version compatibility
      console.log('⚠️  Maintenance QueueScheduler temporarily disabled');
      return null;
      
    } catch (error) {
      console.error('❌ Failed to initialize maintenance scheduler:', error);
      return null;
    }
  }

  /**
   * Add audit cleanup job
   */
  async addAuditCleanupJob(cleanupOptions, options = {}) {
    try {
      const job = await this.queue.add('maintenance:audit-cleanup', cleanupOptions, {
        priority: options.priority || 1,
        delay: options.delay || 0,
        ...options
      });

      console.log(`📋 Added audit cleanup job ${job.id} to maintenance queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add audit cleanup job:', error);
      throw error;
    }
  }

  /**
   * Add statistics generation job
   */
  async addStatsJob(statsOptions, options = {}) {
    try {
      const job = await this.queue.add('maintenance:generate-stats', statsOptions, {
        priority: options.priority || 2,
        delay: options.delay || 0,
        ...options
      });

      console.log(`📋 Added stats generation job ${job.id} to maintenance queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add stats generation job:', error);
      throw error;
    }
  }

  /**
   * Add database maintenance job
   */
  async addDatabaseMaintenanceJob(maintenanceOptions, options = {}) {
    try {
      const job = await this.queue.add('maintenance:database', maintenanceOptions, {
        priority: options.priority || 3,
        delay: options.delay || 0,
        ...options
      });

      console.log(`📋 Added database maintenance job ${job.id} to maintenance queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add database maintenance job:', error);
      throw error;
    }
  }

  /**
   * Add scheduled cleanup job (runs periodically)
   */
  async addScheduledCleanupJob(cleanupOptions, options = {}) {
    try {
      const job = await this.queue.add('maintenance:scheduled-cleanup', cleanupOptions, {
        priority: options.priority || 4,
        delay: options.delay || 0,
        repeat: {
          pattern: '0 2 * * *' // Daily at 2 AM
        },
        ...options
      });

      console.log(`📋 Added scheduled cleanup job ${job.id} to maintenance queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add scheduled cleanup job:', error);
      throw error;
    }
  }

  /**
   * Add health check job
   */
  async addHealthCheckJob(healthOptions, options = {}) {
    try {
      const job = await this.queue.add('maintenance:health-check', healthOptions, {
        priority: options.priority || 5,
        delay: options.delay || 0,
        repeat: {
          every: 300000 // Every 5 minutes
        },
        ...options
      });

      console.log(`📋 Added health check job ${job.id} to maintenance queue`);
      return job;
      
    } catch (error) {
      console.error('❌ Failed to add health check job:', error);
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
      console.error('❌ Failed to get maintenance job:', error);
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
      console.error('❌ Failed to get all maintenance jobs:', error);
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
      console.log(`✅ Retried ${failedJobs.length} failed maintenance jobs`);
      
      return { retried: failedJobs.length };
    } catch (error) {
      console.error('❌ Failed to retry failed maintenance jobs:', error);
      throw error;
    }
  }

  /**
   * Clean completed and failed jobs
   */
  async cleanJobs(options = {}) {
    try {
      const { completed = 50, failed = 25 } = options;
      
      await this.queue.clean(completed, 'completed');
      await this.queue.clean(failed, 'failed');
      
      console.log('✅ Cleaned old maintenance jobs from queue');
      return { cleaned: true };
    } catch (error) {
      console.error('❌ Failed to clean maintenance jobs:', error);
      throw error;
    }
  }

  /**
   * Pause the queue
   */
  async pause() {
    try {
      await this.queue.pause();
      console.log('⏸️ Maintenance queue paused');
      return { paused: true };
    } catch (error) {
      console.error('❌ Failed to pause maintenance queue:', error);
      throw error;
    }
  }

  /**
   * Resume the queue
   */
  async resume() {
    try {
      await this.queue.resume();
      console.log('▶️ Maintenance queue resumed');
      return { resumed: true };
    } catch (error) {
      console.error('❌ Failed to resume maintenance queue:', error);
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
        name: 'maintenance',
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
      console.error('❌ Failed to get maintenance queue status:', error);
      return {
        name: 'maintenance',
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new MaintenanceQueue();
