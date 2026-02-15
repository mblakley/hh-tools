const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
require('dotenv').config();

const RDYSLScraper = require('./src/scraper');
const { validateEnvironment } = require('./src/utils');
const Database = require('./src/database');
const TeamSnapIntegration = require('./src/teamsnap');
const TeamSnapAPI = require('./src/teamsnap-api');
const EmailService = require('./src/email');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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

// Initialize services
let scraper = null;
let database = null;
let teamSnap = null;
let teamSnapAPI = null;
let emailService = null;
let playerAssignments = null;

// Initialize RDYSL scraper if running in RDYSL mode
async function initializeRDYSLScraper() {
  if (process.env.RDYSL_USERNAME && process.env.RDYSL_PASSWORD) {
    scraper = new RDYSLScraper();
    console.log('RDYSL scraper initialized');
  }
}

// Initialize Hilton Heat services
async function initializeHiltonHeatServices() {
  try {
    console.log('Initializing Hilton Heat services...');

    // Initialize database
    database = new Database();
    await database.initialize();

    // Initialize TeamSnap integration (CSV/Excel import)
    teamSnap = new TeamSnapIntegration(database);

    // Initialize TeamSnap API client
    teamSnapAPI = new TeamSnapAPI();

    // Initialize Player Assignments module
    const PlayerAssignments = require('./src/player-assignments');
    playerAssignments = new PlayerAssignments(database, teamSnapAPI);

    // Initialize email service
    emailService = new EmailService(database);
    await emailService.initialize();

    console.log('Hilton Heat services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Hilton Heat services:', error);
    // Don't throw - allow the server to start even if Hilton Heat services fail
  }
}

// Initialize services based on mode
async function initializeServices() {
  await initializeRDYSLScraper();
  await initializeHiltonHeatServices();
}

// Initialize services
initializeServices();

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
    // Check if RDYSL scraper is available
    if (!scraper) {
      return res.status(503).json({
        success: false,
        error: 'RDYSL scraper not available'
      });
    }

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
    // Check if RDYSL scraper is available
    if (!scraper) {
      return res.status(503).json({
        success: false,
        error: 'RDYSL scraper not available'
      });
    }

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

// ========== HILTON HEAT REGISTRATION API ROUTES ==========

// Team Management
app.post('/api/hilton-heat/teams', [
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('age_group').isString().trim().isLength({ min: 1, max: 20 }),
  body('season').isString().trim().isLength({ min: 1, max: 20 }),
  body('coach_name').isString().trim().isLength({ min: 1, max: 100 }),
  body('coach_email').isEmail().normalizeEmail(),
  body('max_players').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: errors.array()
      });
    }

    if (!database || !teamSnap) {
      return res.status(503).json({
        success: false,
        error: 'Hilton Heat services not available'
      });
    }

    const { name, age_group, season, coach_name, coach_email, max_players = 18 } = req.body;

    const result = await database.run(
      `INSERT INTO teams (name, age_group, season, coach_name, coach_email, max_players)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, age_group, season, coach_name, coach_email, max_players]
    );

    res.json({
      success: true,
      teamId: result.id,
      message: 'Team created successfully'
    });

  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/hilton-heat/teams', async (req, res) => {
  try {
    if (!database || !teamSnap) {
      return res.status(503).json({
        success: false,
        error: 'Hilton Heat services not available'
      });
    }

    const teams = await database.all(
      'SELECT * FROM teams ORDER BY season, age_group, name'
    );

    res.json({
      success: true,
      teams
    });

  } catch (error) {
    console.error('Error getting teams:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Registration Management
app.post('/api/hilton-heat/registrations', [
  body('first_name').isString().trim().isLength({ min: 1, max: 50 }),
  body('last_name').isString().trim().isLength({ min: 1, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().isString().trim(),
  body('date_of_birth').optional().isISO8601(),
  body('parent_name').optional().isString().trim(),
  body('parent_email').optional().isEmail().normalizeEmail(),
  body('age_group').isString().trim().isLength({ min: 1, max: 10 }),
  body('season').isString().trim().isLength({ min: 1, max: 20 }),
  body('source').optional().isString().trim(),
  body('notes').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: errors.array()
      });
    }

    if (!database || !teamSnap) {
      return res.status(503).json({
        success: false,
        error: 'Hilton Heat services not available'
      });
    }

    const {
      first_name, last_name, email, phone, date_of_birth, parent_name, parent_email,
      age_group, season, source = 'manual', notes = ''
    } = req.body;

    // Check if player already exists
    const existing = await database.get(
      'SELECT id FROM tryout_registrations WHERE first_name = ? AND last_name = ? AND email = ? AND season = ?',
      [first_name, last_name, email, season]
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Player already exists for this season'
      });
    }

    // Insert new registration
    const result = await database.run(
      `INSERT INTO tryout_registrations
       (first_name, last_name, email, phone, date_of_birth, parent_name, parent_email,
        age_group, season, source, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        first_name, last_name, email, phone, date_of_birth, parent_name,
        parent_email, age_group, season, source, notes
      ]
    );

    res.json({
      success: true,
      registrationId: result.id,
      message: 'Registration created successfully'
    });

  } catch (error) {
    console.error('Error creating registration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Registration Import/Export
app.post('/api/hilton-heat/registrations/import', upload.single('file'), [
  body('season').isString().trim().isLength({ min: 1, max: 20 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: errors.array()
      });
    }

    if (!req.file || !teamSnap) {
      return res.status(400).json({
        success: false,
        error: 'File upload required'
      });
    }

    const { season } = req.body;
    const filePath = req.file.path;

    const result = await teamSnap.importFromCSV(filePath, season);

    // Clean up uploaded file
    const fs = require('fs').promises;
    await fs.unlink(filePath);

    res.json(result);

  } catch (error) {
    console.error('Error importing registrations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/hilton-heat/registrations/export', async (req, res) => {
  try {
    if (!teamSnap) {
      return res.status(503).json({
        success: false,
        error: 'Hilton Heat services not available'
      });
    }

    const { age_group, season } = req.query;

    const result = await teamSnap.exportToCSV(age_group, season);

    if (!result.success) {
      return res.status(500).json(result);
    }

    if (!result.data || result.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No registration data found to export'
      });
    }

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tryout-registrations-${new Date().toISOString().split('T')[0]}.csv"`);

    // Convert data to CSV format
    const csv = require('csv-writer').createObjectCsvStringifier({
      header: Object.keys(result.data[0]).map(key => ({ id: key, title: key }))
    });

    const csvString = csv.getHeaderString() + csv.stringifyRecords(result.data);
    res.send(csvString);

  } catch (error) {
    console.error('Error exporting registrations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/hilton-heat/registrations', async (req, res) => {
  try {
    if (!teamSnap) {
      return res.status(503).json({
        success: false,
        error: 'Hilton Heat services not available'
      });
    }

    const { age_group, season } = req.query;

    const result = await teamSnap.getRegistrations(age_group, season);

    res.json(result);

  } catch (error) {
    console.error('Error getting registrations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Coach Evaluations
app.post('/api/hilton-heat/evaluations/import', upload.single('file'), [
  body('team_id').isInt(),
  body('evaluated_by').isString().trim().isLength({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: errors.array()
      });
    }

    if (!req.file || !teamSnap) {
      return res.status(400).json({
        success: false,
        error: 'File upload required'
      });
    }

    const { team_id, evaluated_by } = req.body;
    const filePath = req.file.path;

    const result = await teamSnap.importEvaluationsFromCSV(filePath, team_id, evaluated_by);

    // Clean up uploaded file
    const fs = require('fs').promises;
    await fs.unlink(filePath);

    res.json(result);

  } catch (error) {
    console.error('Error importing evaluations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Email Management
app.post('/api/hilton-heat/invitations', [
  body('tryout_registration_id').isInt(),
  body('team_id').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: errors.array()
      });
    }

    if (!emailService || emailService.emailDisabled) {
      return res.status(503).json({
        success: false,
        error: 'Email service not available'
      });
    }

    const { tryout_registration_id, team_id } = req.body;

    const result = await emailService.createInvitation(tryout_registration_id, team_id);

    res.json(result);

  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/hilton-heat/invitations/:id/send', async (req, res) => {
  try {
    if (!emailService || emailService.emailDisabled) {
      return res.status(503).json({
        success: false,
        error: 'Email service not available'
      });
    }

    const { id } = req.params;

    const result = await emailService.sendInvitation(parseInt(id));

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/hilton-heat/registration-response', [
  body('invitation_id').isString().isLength({ min: 1, max: 100 }),
  body('status').isIn(['accepted', 'rejected']),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: errors.array()
      });
    }

    if (!emailService || emailService.emailDisabled) {
      return res.status(503).json({
        success: false,
        error: 'Email service not available'
      });
    }

    const { invitation_id, status, notes = '' } = req.body;

    const result = await emailService.processRegistrationResponse(invitation_id, status, notes);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error processing registration response:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// TeamSnap API Integration Endpoints
app.get('/api/hilton-heat/teamsnap/teams', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    console.log('Fetching all teams for authenticated user');

    const result = await teamSnapAPI.getTeams();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get authenticated user info
app.get('/api/hilton-heat/teamsnap/me', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    console.log('Fetching authenticated user info');

    const result = await teamSnapAPI.getMe();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all divisions
app.get('/api/hilton-heat/teamsnap/divisions', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    console.log('Fetching all divisions');

    const result = await teamSnapAPI.getDivisions();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all teams across all divisions (organization-wide)
// Save a team to database
app.post('/api/hilton-heat/teamsnap/save-team', async (req, res) => {
  try {
    const { teamsnap_id, team_name, division_name, division_id, season_name, league_name, organization_id } = req.body;
    
    if (!database) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    // Check if team exists
    const existing = await database.get(
      'SELECT id FROM teamsnap_teams WHERE teamsnap_id = ?',
      [teamsnap_id]
    );

    if (existing) {
      // Update existing
      await database.run(`
        UPDATE teamsnap_teams 
        SET team_name = ?,
            division_name = ?,
            division_id = ?,
            season_name = ?,
            league_name = ?,
            organization_id = ?,
            last_synced_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE teamsnap_id = ?
      `, [team_name, division_name, division_id, season_name, league_name, organization_id, teamsnap_id]);
    } else {
      // Insert new
      await database.run(`
        INSERT INTO teamsnap_teams (teamsnap_id, team_name, division_name, division_id, season_name, league_name, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [teamsnap_id, team_name, division_name, division_id, season_name, league_name, organization_id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving team:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/hilton-heat/teamsnap/teams/all', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    console.log('Fetching all organization teams via divisions');

    const result = await teamSnapAPI.getAllOrganizationTeams();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching organization teams:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all teams the user has access to
app.get('/api/hilton-heat/teamsnap/teams-list', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    console.log('Fetching all teams for authenticated user');

    const result = await teamSnapAPI.getTeams();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get members for a specific team
app.get('/api/hilton-heat/teamsnap/team/:teamId/members', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    const { teamId } = req.params;

    console.log(`Fetching members for team: ${teamId}`);

    const result = await teamSnapAPI.getTeamMembers(teamId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all organizations the user has access to
app.get('/api/hilton-heat/teamsnap/organizations', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    console.log('Fetching all organizations for authenticated user');

    const result = await teamSnapAPI.getOrganizations();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get a specific registration form by ID
app.get('/api/hilton-heat/teamsnap/form/:formId', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    const { formId } = req.params;

    console.log(`Fetching registration form: ${formId}`);

    const result = await teamSnapAPI.getRegistrationForm(formId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching registration form:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all registration forms for an organization
app.get('/api/hilton-heat/teamsnap/forms/:organizationId', async (req, res) => {
  try {
    if (!teamSnapAPI) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API not available'
      });
    }

    const { organizationId } = req.params;

    console.log(`Fetching registration forms for organization: ${organizationId}`);

    const result = await teamSnapAPI.getRegistrationForms(organizationId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error fetching registration forms:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/hilton-heat/teamsnap/sync/:teamId(*)', async (req, res) => {
  try {
    if (!teamSnapAPI || !database) {
      return res.status(503).json({
        success: false,
        error: 'TeamSnap API or database not available'
      });
    }

    const { teamId } = req.params;
    const { season } = req.body;

    // Parse teamId to extract organization and registration IDs
    let organizationId, registrationId;

    if (teamId && teamId.includes('/')) {
      const parts = teamId.split('/');
      if (parts.length >= 2) {
        organizationId = parts[0];
        registrationId = parts[1];
      }
    } else {
      organizationId = teamId;
      registrationId = null;
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid team ID format. Expected: organizationId or organizationId/registrationId'
      });
    }

    console.log(`Syncing TeamSnap registrations for organization: ${organizationId}, registration: ${registrationId}`);

    // Use the TeamSnap API (not SDK) to get registrations
    console.log('Calling TeamSnap API to get registrations...');
    const result = await teamSnapAPI.getRegistrations(teamId, season);

    console.log('TeamSnap API result:', JSON.stringify(result, null, 2));

    if (!result.success) {
      return res.status(500).json(result);
    }

    const registrations = result.registrations || [];

    // Import registrations into database
    const imported = [];
    const errors = [];

    for (const registration of registrations) {
      try {
        // Check if player already exists
        const existing = await database.get(
          'SELECT id FROM tryout_registrations WHERE first_name = ? AND last_name = ? AND email = ? AND season = ?',
          [registration.first_name, registration.last_name, registration.email, registration.season]
        );

        if (existing) {
          console.log(`Player ${registration.first_name} ${registration.last_name} already exists, skipping`);
          continue;
        }

        // Insert new registration
        const insertResult = await database.run(
          `INSERT INTO tryout_registrations
           (first_name, last_name, email, phone, date_of_birth, parent_name, parent_email,
            age_group, season, source, external_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            registration.first_name, registration.last_name, registration.email,
            registration.phone, registration.date_of_birth, registration.parent_name,
            registration.parent_email, registration.age_group, registration.season,
            registration.source, registration.external_id, registration.notes
          ]
        );

        imported.push({
          id: insertResult.id,
          name: `${registration.first_name} ${registration.last_name}`,
          ageGroup: registration.age_group
        });

      } catch (error) {
        console.error(`Error importing registration:`, error);
        errors.push(`Error importing ${registration.first_name} ${registration.last_name}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      details: {
        imported,
        errors
      },
      teamId: teamId,
      source: 'teamsnap_sdk'
    });

  } catch (error) {
    console.error('Error syncing TeamSnap registrations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===================================
// PLAYER ASSIGNMENT ENDPOINTS
// ===================================

// Sync TeamSnap teams to database
app.post('/api/hilton-heat/assignments/sync-teams', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const result = await playerAssignments.syncTeamSnapTeams();
    res.json(result);

  } catch (error) {
    console.error('Error syncing teams:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all TeamSnap teams from database
app.get('/api/hilton-heat/assignments/teams', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const filters = {
      division_name: req.query.division,
      season_name: req.query.season
    };

    const result = await playerAssignments.getTeams(filters);
    res.json(result);

  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Assign a player to a team
app.post('/api/hilton-heat/assignments/assign', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const { registrationId, teamId, assignedBy } = req.body;

    if (!registrationId || !teamId) {
      return res.status(400).json({
        success: false,
        error: 'registrationId and teamId are required'
      });
    }

    const result = await playerAssignments.assignPlayerToTeam(
      registrationId, 
      teamId, 
      assignedBy || 'api'
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error assigning player:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Assign multiple players to a team
app.post('/api/hilton-heat/assignments/assign-bulk', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const { registrationIds, teamId, assignedBy } = req.body;

    if (!registrationIds || !Array.isArray(registrationIds) || !teamId) {
      return res.status(400).json({
        success: false,
        error: 'registrationIds (array) and teamId are required'
      });
    }

    const result = await playerAssignments.assignPlayersToTeam(
      registrationIds,
      teamId,
      assignedBy || 'api'
    );

    res.json(result);

  } catch (error) {
    console.error('Error bulk assigning players:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get assignments for a player
app.get('/api/hilton-heat/assignments/player/:registrationId', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const { registrationId } = req.params;
    const result = await playerAssignments.getPlayerAssignments(registrationId);
    res.json(result);

  } catch (error) {
    console.error('Error fetching player assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get assignments for a team
app.get('/api/hilton-heat/assignments/team/:teamId', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const { teamId } = req.params;
    const result = await playerAssignments.getTeamAssignments(teamId);
    res.json(result);

  } catch (error) {
    console.error('Error fetching team assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update assignment status
app.put('/api/hilton-heat/assignments/:assignmentId/status', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const { assignmentId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required'
      });
    }

    const result = await playerAssignments.updateAssignmentStatus(assignmentId, status, notes);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error updating assignment status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Remove assignment
app.delete('/api/hilton-heat/assignments/:assignmentId', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const { assignmentId } = req.params;
    const result = await playerAssignments.removeAssignment(assignmentId);
    res.json(result);

  } catch (error) {
    console.error('Error removing assignment:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
  }
});

// Get dashboard summary
app.get('/api/hilton-heat/assignments/dashboard/summary', async (req, res) => {
  try {
    if (!playerAssignments) {
      return res.status(503).json({
        success: false,
        error: 'Player assignments service not available'
      });
    }

    const result = await playerAssignments.getDashboardSummary();
    res.json(result);

  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    res.status(500).json({
    success: false,
      error: 'Internal server error'
  });
  }
});

// ===================================
// CALENDAR ENDPOINTS
// ===================================

// Get calendar events from ICS URLs
app.get('/api/hilton-heat/calendar/events', async (req, res) => {
  try {
    // ICS Calendar URLs from TeamSnap
    const calendarUrls = [
      'http://ical-cdn.teamsnap.com/team_schedule/b2096e06-e20f-4f4f-966b-967ac79af6d2.ics', // All Teams
      'http://ical-cdn.teamsnap.com/team_schedule/a724cc32-b034-4e03-82f0-82f629070766.ics', // BU8-U11
      'http://ical-cdn.teamsnap.com/team_schedule/821c820e-d1d2-40bf-ba5a-a59d5868bfe4.ics', // GU8-U11
      'http://ical-cdn.teamsnap.com/team_schedule/fe26fd70-41ea-4ada-882e-395c4977aaed.ics', // Group A
      'http://ical-cdn.teamsnap.com/team_schedule/b0c5df38-a03c-4179-9c24-521598a08f33.ics', // Group B
      'http://ical-cdn.teamsnap.com/team_schedule/8701149b-8ccf-4c7b-b392-19e6b3540918.ics', // Group C
      'http://ical-cdn.teamsnap.com/team_schedule/8e017eab-a8f6-43a2-b454-f66331d0c5b6.ics', // Group D
      'http://ical-cdn.teamsnap.com/team_schedule/f022318b-d44f-4222-ac27-3ba922eee507.ics', // Group E
      'http://ical-cdn.teamsnap.com/team_schedule/6c09f5c2-a47f-475e-b194-3ebc79d235ad.ics'  // Group F
    ];

    const allEvents = [];
    const results = {
      success: true,
      events: [],
      loadedCalendars: 0,
      totalCalendars: calendarUrls.length,
      errors: []
    };

    // Fetch all calendars in parallel
    const fetchPromises = calendarUrls.map(async (url, index) => {
      try {
        console.log(`Fetching calendar ${index + 1}: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/calendar,text/plain,*/*',
            'User-Agent': 'Hilton Heat Calendar/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const icsContent = await response.text();
        console.log(`Successfully loaded calendar ${index + 1} (${icsContent.length} chars)`);
        
        const events = parseICS(icsContent, index + 1);
        allEvents.push(...events);
        results.loadedCalendars++;
        
        console.log(`Calendar ${index + 1} parsed ${events.length} events`);
        return { success: true, events, calendarIndex: index + 1 };
        
      } catch (error) {
        console.error(`Calendar ${index + 1} failed:`, error.message);
        results.errors.push(`Calendar ${index + 1}: ${error.message}`);
        return { success: false, error: error.message, calendarIndex: index + 1 };
      }
    });

    await Promise.all(fetchPromises);
    
    results.events = allEvents;
    results.totalEvents = allEvents.length;
    
    res.json(results);

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Helper function to parse ICS content
function parseICS(icsContent, calendarIndex) {
  const events = [];
  const lines = icsContent.split('\n');
  
  let currentEvent = null;
  let eventCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
      eventCount++;
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.summary) {
        const event = {
          title: currentEvent.summary,
          start: currentEvent.dtstart,
          end: currentEvent.dtend,
          allDay: false,
          calendar: `Calendar ${calendarIndex}`
        };
        
        // Only add events with valid dates
        if (event.start && event.start.toString() !== 'Invalid Date') {
          events.push(event);
        }
      }
      currentEvent = null;
    } else if (currentEvent && line.startsWith('DTSTART')) {
      const dateStr = line.substring(line.indexOf(':') + 1);
      currentEvent.dtstart = parseICSDate(dateStr);
    } else if (currentEvent && line.startsWith('DTEND')) {
      const dateStr = line.substring(line.indexOf(':') + 1);
      currentEvent.dtend = parseICSDate(dateStr);
    } else if (currentEvent && line.startsWith('SUMMARY:')) {
      currentEvent.summary = line.substring(8);
    }
  }
  
  return events;
}

// Helper function to parse ICS date format
function parseICSDate(dateStr) {
  try {
    // Handle different ICS date formats
    if (dateStr.includes('T')) {
      // Format: 20251023T170000 or 20251023T170000Z
      const cleanDate = dateStr.replace('Z', '');
      if (cleanDate.length === 15) {
        // YYYYMMDDTHHMMSS format
        const year = cleanDate.substring(0, 4);
        const month = cleanDate.substring(4, 6);
        const day = cleanDate.substring(6, 8);
        const hour = cleanDate.substring(9, 11);
        const minute = cleanDate.substring(11, 13);
        const second = cleanDate.substring(13, 15);
        
        return new Date(year, month - 1, day, hour, minute, second);
      }
    } else if (dateStr.length === 8) {
      // Format: 20251023 (date only)
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      
      return new Date(year, month - 1, day);
    }
    
    // Fallback to standard Date parsing
    return new Date(dateStr);
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return null;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler - MUST BE LAST
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
