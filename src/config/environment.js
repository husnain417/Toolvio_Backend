const Joi = require('joi');

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: Joi.number()
    .port()
    .default(3000),
  
  MONGODB_URI: Joi.string()
    .uri()
    .required()
    .description('MongoDB connection string'),
  
  MONGODB_OPTIONS: Joi.object({
    useNewUrlParser: Joi.boolean().default(true),
    useUnifiedTopology: Joi.boolean().default(true),
    maxPoolSize: Joi.number().default(10),
    serverSelectionTimeoutMS: Joi.number().default(5000),
    socketTimeoutMS: Joi.number().default(45000),
  }).default(),
  
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  
  CORS_ORIGIN: Joi.string()
    .default('*'),
  
  RATE_LIMIT_WINDOW_MS: Joi.number()
    .default(15 * 60 * 1000), // 15 minutes
  
  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .default(100),
  
  BODY_PARSER_LIMIT: Joi.string()
    .default('10mb'),
  
  JWT_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  
  JWT_EXPIRES_IN: Joi.string()
    .default('24h'),
});

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true
});

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

// Export validated environment configuration
module.exports = {
  NODE_ENV: envVars.NODE_ENV,
  PORT: envVars.PORT,
  MONGODB_URI: envVars.MONGODB_URI,
  MONGODB_OPTIONS: envVars.MONGODB_OPTIONS,
  LOG_LEVEL: envVars.LOG_LEVEL,
  CORS_ORIGIN: envVars.CORS_ORIGIN,
  RATE_LIMIT_WINDOW_MS: envVars.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: envVars.RATE_LIMIT_MAX_REQUESTS,
  BODY_PARSER_LIMIT: envVars.BODY_PARSER_LIMIT,
  JWT_SECRET: envVars.JWT_SECRET,
  JWT_EXPIRES_IN: envVars.JWT_EXPIRES_IN,
  
  // Helper methods
  isDevelopment: () => envVars.NODE_ENV === 'development',
  isProduction: () => envVars.NODE_ENV === 'production',
  isTest: () => envVars.NODE_ENV === 'test',
};
