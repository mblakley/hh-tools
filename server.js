const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const RDYSLScraper = require('./src/scraper');
const { validateEnvironment } = require('./src/utils');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables
validateEnvironment();

// Trust proxy for proper IP detection behind reverse proxies (ngrok, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "http://localhost:3000/js/", "https://*.ngrok-free.app"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: ["'self'", "data:", "https:", "http:", "fonts.gstatic.com", "fonts.googleapis.com"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    // Allow localhost for development
    if (origin.includes('localhost')) return callback(null, true);

    // Allow ngrok domains
    if (origin.includes('ngrok')) return callback(null, true);

    // Check against environment variable if set
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Reject other origins
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (frontend)
app.use(express.static('public'));

// Initialize scraper
const scraper = new RDYSLScraper();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Get callup data endpoint
app.post('/api/callups', [
  body('playerSearch').optional().isString().trim().isLength({ max: 100 }),
  body('forceRefresh').optional().isBoolean(),
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: errors.array()
      });
    }

    const { playerSearch, forceRefresh = false } = req.body;

    // Initialize scraper on-demand if not already initialized
    if (!scraper.isReady()) {
      console.log('Scraper not initialized, initializing now...');
      await scraper.initialize();
    }

    // Get callup data (force refresh if requested)
    const result = await scraper.getCallupData(playerSearch || '', forceRefresh);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    // Note: Search message generation moved to client-side

    // Calculate stats
    const stats = {
      totalPlayers: result.summary.length,
      warnings: result.summary.filter(p => p.isWarning).length,
      unavailable: result.summary.filter(p => p.isUnavailable).length,
      overLimit: result.summary.filter(p => p.isOverLimit).length,
      totalCallups: result.summary.reduce((sum, p) => sum + p.callupCount, 0)
    };

    res.json({
      success: true,
      summary: result.summary,
      stats,
      lastUpdated: result.lastUpdated,
      totalRecords: result.totalRecords
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get cached data without scraping
app.get('/api/callups/cached', async (req, res) => {
  try {
    // Initialize scraper on-demand if not already initialized
    if (!scraper.isReady()) {
      console.log('Scraper not initialized, initializing now...');
      await scraper.initialize();
    }

    const result = await scraper.getCachedData();

    if (!result.success) {
      return res.status(404).json(result);
    }

    // Calculate stats
    const stats = {
      totalPlayers: result.summary.length,
      warnings: result.summary.filter(p => p.isWarning).length,
      unavailable: result.summary.filter(p => p.isUnavailable).length,
      overLimit: result.summary.filter(p => p.isOverLimit).length,
      totalCallups: result.summary.reduce((sum, p) => sum + p.callupCount, 0)
    };

    res.json({
      success: true,
      summary: result.summary,
      stats,
      lastUpdated: result.lastUpdated,
      totalRecords: result.totalRecords,
      cached: true
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`RDYSL Callup API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Scraper will initialize on-demand when API endpoints are called');
});

module.exports = app;
