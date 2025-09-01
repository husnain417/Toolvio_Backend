// Load local configuration first
try {
  const localConfig = require('../config.local.js');
  Object.keys(localConfig).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = localConfig[key];
    }
  });
} catch (error) {
  console.log('⚠️  No local config found, using environment variables');
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const schemaRoutes = require('./routes/schemaRoutes');
const dynamicRoutes = require('./routes/dynamicRoutes');
const auditRoutes = require('./routes/auditRoutes'); // Add audit routes
const systemRoutes = require('./routes/systemRoutes');
const authRoutes = require('./routes/authRoutes'); // Add authentication routes
const tenantRoutes = require('./routes/tenantRoutes'); // Add tenant management routes
const queueRoutes = require('./routes/queueRoutes'); // Add queue management routes
const syncRoutes = require('./routes/syncRoutes'); // Add offline sync routes

// Milestone 4: Versioning & Extensibility Routes
const schemaVersionRoutes = require('./routes/schemaVersions'); // Add schema version routes
const migrationRoutes = require('./routes/migrations'); // Add migration routes
const discoveryRoutes = require('./routes/discovery'); // Add discovery routes
const SchemaService = require('./services/SchemaService');
const ChangeStreamService = require('./services/ChangeStreamService'); // Add change stream service
const QueueService = require('./services/QueueService'); // Add queue service
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB and initialize all services
const initializeServer = async () => {
  try {
    console.log('🚀 Starting server initialization...');
    
    // Connect to database
    console.log('📡 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected');
    
    // Initialize dynamic models for existing schemas
    console.log('🔧 Initializing dynamic models...');
    await SchemaService.initializeDynamicModels();
    console.log('✅ Dynamic models initialized');
    
    // Initialize queue service
    console.log('📋 Initializing queue service...');
    await QueueService.initialize();
    console.log('✅ Queue service initialized');
    
    // Initialize change streams for audit trail
    console.log('🔍 Initializing change streams for audit trail...');
    await ChangeStreamService.initialize();
    console.log('✅ Change streams initialized');
    
    console.log('✅ Server initialization completed successfully');
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('🛑 Received shutdown signal, starting graceful shutdown...');
  
  try {
    // Shutdown change streams
    console.log('🔍 Shutting down change streams...');
    await ChangeStreamService.shutdown();
    console.log('✅ Change streams shut down');
    
    // Shutdown queue service
    console.log('📋 Shutting down queue service...');
    await QueueService.shutdown();
    console.log('✅ Queue service shut down');
    
    // Close database connection
    console.log('📡 Closing database connection...');
    // Add your database connection close logic here if needed
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Middleware
app.use(helmet());

// Enhanced CORS configuration for Swagger UI
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Total-Count', 'X-Page-Count']
}));

// Handle preflight requests
app.options('*', cors());

// Additional CORS headers for Swagger UI
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

app.use(morgan('combined'));

// Health check endpoints (before body-parser middleware)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Ready check endpoint for Kubernetes
app.get('/ready', (req, res) => {
  // Check if all critical services are ready
  const isReady = true; // Add your readiness checks here
  
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString()
    });
  }
});

// Body parsing middleware (after health endpoints)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    console.log('⏰ Request timeout');
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes); // Authentication routes
app.use('/api/tenants', tenantRoutes); // Tenant management routes
app.use('/api/schemas', schemaRoutes);
app.use('/api/data', dynamicRoutes);
app.use('/api/audit', auditRoutes); // Add audit routes
app.use('/api/system', systemRoutes);
app.use('/api/admin/queues', queueRoutes); // Add queue management routes
app.use('/api/sync', syncRoutes); // Add offline sync routes

// Milestone 4: Versioning & Extensibility Routes
app.use('/api/schema-versions', schemaVersionRoutes); // Schema version management
app.use('/api/migrations', migrationRoutes); // Schema migration management
app.use('/api/discovery', discoveryRoutes); // Dynamic endpoint discovery

// Swagger UI docs
try {
  const openapiPath = path.join(__dirname, '..', 'documentation', 'openapi.yaml');
  const file = fs.readFileSync(openapiPath, 'utf8');
  const swaggerDocument = YAML.parse(file);
  // Serve Swagger JSON
  app.get('/api/docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      url: '/api/docs/swagger.json',
      validatorUrl: null,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
      docExpansion: 'list',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Toolvio Backend API Documentation'
  }));
  console.log('📚 Swagger UI available at /api/docs');
} catch (e) {
  console.warn('⚠️  Failed to load Swagger docs:', e.message);
  // Mount fallback minimal docs so the route still works
  const fallbackDoc = {
    openapi: '3.0.3',
    info: {
      title: 'Craftsman Dynamic Backend API (Fallback Docs)',
      version: '1.0.0',
      description: 'OpenAPI file missing or invalid. Ensure documentation/openapi.yaml exists.'
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    paths: {}
  };
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(fallbackDoc));
  console.log('📚 Swagger UI (fallback) available at /api/docs');
}

// Root endpoint with updated information
app.get('/', (req, res) => {
  res.json({ 
    message: 'Craftsman Dynamic Backend API',
    version: '1.0.0',
    features: [
      'Dynamic Schema Management',
      'Auto-generated CRUD APIs',
      'Complete Audit Trail & Rollback',
      'Real-time Change Streams',
      'Versioned Record Snapshots',
      'Background Job Processing with BullMQ',
      'Offline Sync & Conflict Resolution'
    ],
    endpoints: {
      auth: '/api/auth',
      tenants: '/api/tenants',
      schemas: '/api/schemas',
      data: '/api/data',
      audit: '/api/audit',
      system: '/api/system',
      queues: '/api/admin/queues',
      sync: '/api/sync',
      health: '/api/system/health'
    },
    auditFeatures: {
      changeStreams: 'Real-time change detection via MongoDB Change Streams',
      auditHistory: 'Complete audit trail for all document changes',
      rollback: 'Revert documents to any previous version',
      versioning: 'Sequential version numbering for all changes',
      bulkOperations: 'Bulk revert and audit operations supported',
      backgroundProcessing: 'Asynchronous audit processing with BullMQ queues'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    availableEndpoints: [
      '/api/schemas',
      '/api/data',
      '/api/audit',
      '/api/system',
      '/api/admin/queues',
      '/api/sync'
    ]
  });
});

// Start server after initialization
const startServer = async () => {
  await initializeServer();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
    console.log(`🔧 Dynamic models: Initialized and ready`);
    console.log(`🔍 Audit trail: Active with change streams`);
    console.log(`📋 Background queues: Active with BullMQ + Redis`);
    console.log(`📝 API Documentation available at: http://localhost:${PORT}/`);
    console.log('');
    console.log('🎉 Craftsman Dynamic Backend is ready!');
    console.log('✅ Milestone 1: Schema-Driven API - COMPLETE');
    console.log('✅ Milestone 2: Audit Trail & Rollback - COMPLETE');
    console.log('✅ Background Processing: BullMQ + Redis - COMPLETE');
    console.log('✅ Offline Sync & Conflict Resolution - COMPLETE');
    console.log('');
  });
  
  // Store server reference for graceful shutdown
  process.server = server;
};

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
