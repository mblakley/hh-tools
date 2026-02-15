# Hilton Heat Tools

A comprehensive Node.js/Express application for managing youth soccer operations, including RDYSL (Rochester District Youth Soccer League) data scraping, TeamSnap integration, and player registration management.

## Features

### 🔍 RDYSL Callup Checker
- Server-side authentication and scraping of RDYSL game fines data
- Automated player callup compliance tracking
- 30-minute caching to reduce server load
- REST API for frontend consumption

### ⚽ TeamSnap Integration
- OAuth 2.0 authentication with TeamSnap API
- Team roster synchronization
- Member data management
- Organization access across all your TeamSnap teams

### 📊 Hilton Heat Registration System
- Player registration management
- Team assignment workflow
- CSV import/export capabilities
- Real-time statistics dashboard

### 📅 RDYSL Season Scraper
- Automated scraping of full season schedules
- Game data extraction (teams, dates, times, locations)
- CSV export with timestamps
- Filter by team/division

## Quick Start

### Prerequisites
- Docker and Docker Compose
- RDYSL website credentials
- TeamSnap account with organization access

### Setup

1. **Clone repository**:
   ```bash
   git clone <repository-url>
   cd hh-tools
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start with Docker**:
   ```bash
   # Development (with hot-reload)
   docker-compose -f docker-compose.dev.yml up

   # Production
   docker-compose up -d
   ```

4. **Access applications**:
   - Hilton Heat Dashboard: http://localhost:3000/hilton-heat-v2.html
   - RDYSL Callup Checker: http://localhost:3000/rdysl-callup-checker.html
   - API Health: http://localhost:3000/api/health

## Environment Variables

Key configuration (see [.env.example](.env.example) for complete list):

```env
# RDYSL Credentials
RDYSL_USERNAME=your_rdysl_username
RDYSL_PASSWORD=your_rdysl_password

# TeamSnap Credentials
TEAMSNAP_CLIENT_ID=your_client_id
TEAMSNAP_CLIENT_SECRET=your_client_secret
TEAMSNAP_USERNAME=your_teamsnap_email@example.com
TEAMSNAP_PASSWORD=your_teamsnap_password

# Server Configuration
PORT=3000
NODE_ENV=production
SESSION_SECRET=your_secure_random_secret
```

## Development

### Local Development (without Docker)

```bash
npm install              # Install dependencies
npm run dev             # Start with auto-reload
npm test                # Run tests
npx playwright test     # Run E2E tests
```

### Scraping RDYSL Data

```bash
npm run scrape-season           # Scrape current season
npm run filter-hilton-heat      # Filter for Hilton Heat games
```

### Docker Development

```bash
docker-compose -f docker-compose.dev.yml up    # Start dev environment
docker-compose logs -f                          # View logs
```

## Documentation

- **[TeamSnap Setup](docs/TEAMSNAP.md)** - TeamSnap integration guide
- **[Development Guide](docs/DEVELOPMENT.md)** - Docker, testing, workflows
- **[Web Interface](docs/WEB_INTERFACE.md)** - Dashboard usage
- **[RDYSL Scraper](docs/RDYSL_SCRAPER.md)** - Season data scraping
- **[Player Assignments](docs/PLAYER_ASSIGNMENTS.md)** - Assignment workflow

## Project Structure

```
/
├── src/                   # Source code
│   ├── server.js          # Main Express server
│   ├── database.js        # SQLite operations
│   ├── rdysl-season-scraper.js
│   ├── teamsnap-api.js
│   └── ...
├── public/                # Static web files
├── tests/e2e/             # E2E tests
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

## Tech Stack

- Node.js v22 + Express.js
- SQLite3 database
- Puppeteer (web scraping) + Cheerio (HTML parsing)
- Playwright (E2E testing)
- Docker + Docker Compose

## Troubleshooting

**RDYSL Authentication Issues:**
- Verify credentials in `.env`
- Check if website structure changed
- Review server logs

**TeamSnap API Errors:**
- Verify OAuth credentials
- Ensure account has organization access
- Check team/form IDs are correct

**Docker Issues:**
- Ensure port 3000 not in use
- Verify environment variables are set
- Check logs: `docker-compose logs -f`

## License

MIT License
