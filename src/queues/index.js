const Redis = require('ioredis');
const { Queue, Worker, QueueScheduler } = require('bullmq');
const auditQueue = require('./auditQueue');
const maintenanceQueue = require('./maintenanceQueue');

class QueueManager {
  constructor() {
    this.redis = null;
    this.queues = new Map();
    this.workers = new Map();
    this.schedulers = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize Redis connection and all queues
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('📋 Queue manager already initialized');
      return;
    }

    try {
      console.log('📋 Initializing queue manager...');
      
      // Initialize Redis connection
      await this.initializeRedis();
      
      // Initialize queues
      await this.initializeQueues();
      
      // Initialize workers
      await this.initializeWorkers();
      
      // Initialize schedulers
      await this.initializeSchedulers();
      
      this.isInitialized = true;
      console.log('✅ Queue manager initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize queue manager:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0
      };

      this.redis = new Redis(redisConfig);
      
      // Test connection
      await this.redis.ping();
      console.log('✅ Redis connection established');
      
      // Handle Redis events
      this.redis.on('error', (error) => {
        console.error('❌ Redis connection error:', error);
      });
      
      this.redis.on('connect', () => {
        console.log('📡 Redis connected');
      });
      
      this.redis.on('ready', () => {
        console.log('✅ Redis ready');
      });
      
      this.redis.on('close', () => {
        console.log('🔌 Redis connection closed');
      });
      
      this.redis.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Initialize all queues
   */
  async initializeQueues() {
    try {
      // Initialize audit queue
      const auditQueueInstance = await auditQueue.initialize(this.redis);
      this.queues.set('audit', auditQueueInstance);
      
      // Initialize maintenance queue
      const maintenanceQueueInstance = await maintenanceQueue.initialize(this.redis);
      this.queues.set('maintenance', maintenanceQueueInstance);
      
      console.log(`✅ Initialized ${this.queues.size} queues`);
      
    } catch (error) {
      console.error('❌ Failed to initialize queues:', error);
      throw error;
    }
  }

  /**
   * Initialize all workers
   */
  async initializeWorkers() {
    try {
      // Initialize audit workers
      const auditWorkers = await auditQueue.initializeWorkers(this.redis);
      this.workers.set('audit', auditWorkers);
      
      // Initialize maintenance workers
      const maintenanceWorkers = await maintenanceQueue.initializeWorkers(this.redis);
      this.workers.set('maintenance', maintenanceWorkers);
      
      console.log(`✅ Initialized ${this.workers.size} worker groups`);
      
    } catch (error) {
      console.error('❌ Failed to initialize workers:', error);
      throw error;
    }
  }

  /**
   * Initialize queue schedulers
   */
  async initializeSchedulers() {
    try {
      // Initialize audit scheduler
      const auditScheduler = await auditQueue.initializeScheduler(this.redis);
      if (auditScheduler) {
        this.schedulers.set('audit', auditScheduler);
      }
      
      // Initialize maintenance scheduler
      const maintenanceScheduler = await maintenanceQueue.initializeScheduler(this.redis);
      if (maintenanceScheduler) {
        this.schedulers.set('maintenance', maintenanceScheduler);
      }
      
      console.log(`✅ Initialized ${this.schedulers.size} schedulers`);
      
    } catch (error) {
      console.error('❌ Failed to initialize schedulers:', error);
      // Don't throw - schedulers are optional
    }
  }

  /**
   * Get a specific queue by name
   */
  getQueue(queueName) {
    return this.queues.get(queueName);
  }

  /**
   * Get all queues
   */
  getAllQueues() {
    return this.queues;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const stats = {};
    
    for (const [queueName, queue] of this.queues) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);
        
        stats[queueName] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length
        };
      } catch (error) {
        console.error(`Error getting stats for queue ${queueName}:`, error);
        stats[queueName] = { error: error.message };
      }
    }
    
    return stats;
  }

  /**
   * Gracefully shutdown all queues and workers
   */
  async shutdown() {
    console.log('🛑 Shutting down queue manager...');
    
    try {
      // Close all workers
      for (const [queueName, workers] of this.workers) {
        console.log(`🛑 Closing ${workers.length} workers for ${queueName}...`);
        await Promise.all(workers.map(worker => worker.close()));
      }
      
      // Close all schedulers
      for (const [queueName, scheduler] of this.schedulers) {
        console.log(`🛑 Closing scheduler for ${queueName}...`);
        await scheduler.close();
      }
      
      // Close all queues
      for (const [queueName, queue] of this.queues) {
        console.log(`🛑 Closing queue ${queueName}...`);
        await queue.close();
      }
      
      // Close Redis connection
      if (this.redis) {
        console.log('🛑 Closing Redis connection...');
        await this.redis.quit();
      }
      
      this.isInitialized = false;
      console.log('✅ Queue manager shut down successfully');
      
    } catch (error) {
      console.error('❌ Error during queue manager shutdown:', error);
      throw error;
    }
  }

  /**
   * Check if Redis is available
   */
  async isRedisAvailable() {
    try {
      if (!this.redis) return false;
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    const redisAvailable = await this.isRedisAvailable();
    const queuesStatus = {};
    
    for (const [queueName, queue] of this.queues) {
      try {
        const waiting = await queue.getWaiting();
        queuesStatus[queueName] = {
          status: 'healthy',
          waitingJobs: waiting.length
        };
      } catch (error) {
        queuesStatus[queueName] = {
          status: 'error',
          error: error.message
        };
      }
    }
    
    return {
      status: redisAvailable ? 'healthy' : 'unhealthy',
      redis: redisAvailable ? 'connected' : 'disconnected',
      queues: queuesStatus,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const queueManager = new QueueManager();

module.exports = queueManager;
