// Local configuration for development
// Copy this to your .env file or use as reference

module.exports = {
  NODE_ENV: 'development',
  PORT: 3000,
  
  // MongoDB connection string (without replica set for now)
  MONGODB_URI: 'mongodb://localhost:27017/toolvio',
  
  // CORS Configuration
  CORS_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000',
  
  // Logging
  LOG_LEVEL: 'debug',
  
  // Security (for development)
  JWT_SECRET: 'your-super-secret-jwt-key-at-least-32-characters-long-for-development',
  JWT_EXPIRES_IN: '24h',
  
  // Development features
  DEBUG: true,
  ENABLE_SWAGGER: true,
  
  // API Configuration
  BODY_PARSER_LIMIT: '10mb',
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX_REQUESTS: 1000,
  
  // Production features
  ENABLE_COMPRESSION: true,
  ENABLE_SECURITY_HEADERS: true,
  TRUST_PROXY: false,
  
  // Monitoring
  ENABLE_REQUEST_LOGGING: true,
  ENABLE_PERFORMANCE_MONITORING: false
};
