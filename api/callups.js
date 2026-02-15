const RDYSLScraperServerless = require('../src/scraper-serverless');

// Cache configuration
let cachedData = null;
let lastCacheTime = null;
const CACHE_DURATION = (parseInt(process.env.CACHE_DURATION_MINUTES) || 30) * 60 * 1000;

/**
 * Vercel Serverless Function for RDYSL Callup Data
 * GET /api/callups - Get callup data (cached)
 * POST /api/callups - Force refresh and get callup data
 */
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const forceRefresh = req.method === 'POST' || req.query.forceRefresh === 'true';
    const now = Date.now();
    const isCacheValid = cachedData && lastCacheTime && (now - lastCacheTime) < CACHE_DURATION;

    // Return cached data if valid and not forcing refresh
    if (isCacheValid && !forceRefresh) {
      console.log('Returning cached data');
      const stats = calculateStats(cachedData.summary);

      return res.status(200).json({
        success: true,
        summary: cachedData.summary,
        stats,
        lastUpdated: cachedData.lastUpdated,
        totalRecords: cachedData.totalRecords,
        cached: true
      });
    }

    // Check credentials
    if (!process.env.RDYSL_USERNAME || !process.env.RDYSL_PASSWORD) {
      return res.status(503).json({
        success: false,
        error: 'RDYSL credentials not configured'
      });
    }

    console.log('Scraping fresh data...');

    // Create scraper and fetch data
    const scraper = new RDYSLScraperServerless();
    const result = await scraper.scrapeCallupData();

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Update cache
    cachedData = {
      summary: result.summary,
      totalRecords: result.totalRecords,
      lastUpdated: result.lastUpdated
    };
    lastCacheTime = now;

    // Calculate stats
    const stats = calculateStats(result.summary);

    res.status(200).json({
      success: true,
      summary: result.summary,
      stats,
      lastUpdated: result.lastUpdated,
      totalRecords: result.totalRecords,
      cached: false
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};

/**
 * Calculate statistics from summary
 */
function calculateStats(summary) {
  if (!summary || !Array.isArray(summary)) {
    return {
      totalPlayers: 0,
      warnings: 0,
      unavailable: 0,
      overLimit: 0,
      totalCallups: 0
    };
  }

  return {
    totalPlayers: summary.length,
    warnings: summary.filter(p => p.isWarning).length,
    unavailable: summary.filter(p => p.isUnavailable).length,
    overLimit: summary.filter(p => p.isOverLimit).length,
    totalCallups: summary.reduce((sum, p) => sum + p.callupCount, 0)
  };
}
