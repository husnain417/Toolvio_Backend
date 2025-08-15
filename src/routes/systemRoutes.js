const express = require('express');
const systemController = require('../controllers/systemController');

const router = express.Router();

// Health check
router.get('/health', systemController.healthCheck);

// System information
router.get('/info', systemController.getSystemInfo);

// Database statistics
router.get('/stats/database', systemController.getDatabaseStats);

// API statistics
router.get('/stats/api', systemController.getApiStats);

// System initialization
router.post('/init', systemController.initializeSystem);

// System logs
router.get('/logs', systemController.getSystemLogs);

module.exports = router;
