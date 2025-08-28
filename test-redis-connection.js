#!/usr/bin/env node

/**
 * Simple Redis connection test
 */

require('dotenv').config();
const Redis = require('ioredis');

async function testRedisConnection() {
  console.log('🧪 Testing Redis Connection...\n');
  
  console.log('Environment variables:');
  console.log('REDIS_HOST:', process.env.REDIS_HOST);
  console.log('REDIS_PORT:', process.env.REDIS_PORT);
  console.log('REDIS_PASSWORD:', process.env.REDIS_PASSWORD);
  console.log('REDIS_DB:', process.env.REDIS_DB);
  console.log('');
  
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });
    
    console.log('📡 Attempting to connect to Redis...');
    
    // Test connection
    await redis.ping();
    console.log('✅ Redis connection successful!');
    
    // Test basic operations
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    console.log('✅ Redis read/write test successful:', value);
    
    // Cleanup
    await redis.del('test-key');
    console.log('✅ Redis cleanup successful');
    
    await redis.quit();
    console.log('✅ Redis connection closed');
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testRedisConnection();
