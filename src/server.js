require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const schemaRoutes = require('./routes/schemaRoutes');
const dynamicRoutes = require('./routes/dynamicRoutes');
const systemRoutes = require('./routes/systemRoutes');
const SchemaService = require('./services/SchemaService');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB and initialize dynamic models
const initializeServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Initialize dynamic models for existing schemas
    await SchemaService.initializeDynamicModels();
    
    console.log('✅ Server initialization completed');
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    console.log('Request timeout');
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Routes
app.use('/api/schemas', schemaRoutes);
app.use('/api/data', dynamicRoutes);
app.use('/api/system', systemRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Craftsman Dynamic Backend API',
    version: '1.0.0',
    endpoints: {
      schemas: '/api/schemas',
      data: '/api/data',
      system: '/api/system',
      health: '/api/system/health'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Start server after initialization
const startServer = async () => {
  await initializeServer();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🗄️  Database: ${process.env.MONGODB_URI}`);
    console.log(`🔄 Dynamic models initialized and ready`);
  });
};

startServer();