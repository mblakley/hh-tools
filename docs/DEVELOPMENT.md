# Development Guide

## Getting Started

### Prerequisites
- Node.js v22+
- Docker and Docker Compose
- Git

### Local Development (No Docker)

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start development server with auto-reload
npm run dev

# Server runs at http://localhost:3000
```

### Docker Development (Recommended)

```bash
# Start dev environment with hot-reload
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Dev mode features:**
- Source code mounted as volumes (changes reflect immediately)
- Nodemon auto-restart on file changes
- Development dependencies included
- Easier debugging

## Project Structure

```
/
├── src/                   # Source modules
│   ├── server.js          # Main Express server
│   ├── database.js        # SQLite operations
│   ├── rdysl-season-scraper.js  # RDYSL scraping
│   ├── scraper.js         # RDYSL callup scraper
│   ├── teamsnap-api.js    # TeamSnap integration
│   ├── player-assignments.js
│   ├── filter-hilton-heat-games.js
│   └── utils.js           # Shared utilities
├── public/                # Static frontend
│   ├── hilton-heat-v2.html
│   ├── rdysl-callup-checker.html
│   └── js/                # Frontend JavaScript
├── tests/e2e/             # Playwright E2E tests
├── scripts/               # Utility scripts
├── data/                  # Data files (gitignored)
│   ├── exports/           # CSV exports
│   └── media/             # Media files
└── docs/                  # Documentation
```

## Testing

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npx playwright test

# Run in UI mode (interactive)
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/api.spec.js

# Generate test code
npx playwright codegen http://localhost:3000
```

### Unit Tests (Jest)

```bash
npm test
```

## Docker Configuration

### docker-compose.dev.yml
Development configuration with:
- Hot reloading via nodemon
- Source code volume mounts
- Development environment variables
- Port 3000 exposed

### docker-compose.yml
Production configuration with:
- Optimized image
- Health checks
- Restart policies
- Production environment

### Dockerfile vs Dockerfile.dev
- `Dockerfile`: Production build (minimal, optimized)
- `Dockerfile.dev`: Development build (includes dev tools)

## Environment Variables

See [.env.example](../.env.example) for complete list.

**Required:**
- `RDYSL_USERNAME` / `RDYSL_PASSWORD` - For RDYSL scraping
- `TEAMSNAP_USERNAME` / `TEAMSNAP_PASSWORD` - For TeamSnap API

**Optional:**
- `PORT` - Server port (default: 3000)
- `CACHE_DURATION_MINUTES` - Scraping cache (default: 30)
- `NODE_ENV` - Environment mode

## Common Development Tasks

### Scraping RDYSL Data

```bash
# Scrape full season (creates timestamped CSV)
npm run scrape-season

# Scrape specific year
node src/rdysl-season-scraper.js 2024

# Filter for Hilton Heat games only
npm run filter-hilton-heat
```

### Database Operations

SQLite database file: `hilton_heat.db` (gitignored)

```bash
# View database
sqlite3 hilton_heat.db

# Common queries
.tables                    # List tables
SELECT * FROM teams;       # View teams
SELECT * FROM registrations; # View registrations
```

### Viewing Logs

```bash
# Docker logs
docker-compose logs -f

# Specific service
docker-compose logs -f hilton-heat-dev

# Since timestamp
docker-compose logs --since="2024-01-01T10:00:00"
```

## Code Style Guidelines

- **Line length**: Max 100 characters
- **Function length**: Max 50 lines
- **No deep nesting**: Max 3-4 levels
- **No premature abstraction**: Only create utilities when needed 3+ times
- **Replace, don't deprecate**: Remove unused code completely

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

**Commit message format:**
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/changes

## Troubleshooting

### Port already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Docker build issues
```bash
# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Puppeteer memory issues
- Reduce `CACHE_DURATION_MINUTES`
- Monitor container resources
- Consider increasing Docker memory limit

### Database locked errors
- Ensure only one instance accessing database
- Check for orphaned connections
- Restart the server

## Debugging

### Node.js Debugging

```bash
# Start with inspector
node --inspect server.js

# Or with nodemon
nodemon --inspect server.js
```

Then attach your IDE debugger to port 9229.

### Docker Debugging

```bash
# Access container shell
docker-compose exec hilton-heat-dev /bin/sh

# View environment variables
docker-compose exec hilton-heat-dev env

# Check running processes
docker-compose exec hilton-heat-dev ps aux
```

## Performance Monitoring

- Monitor Puppeteer memory usage (can be high)
- Watch database file size
- Check API response times
- Monitor cache hit rates

## Security Checklist

- [ ] Never commit `.env` files
- [ ] Use strong `SESSION_SECRET`
- [ ] Configure proper `ALLOWED_ORIGINS`
- [ ] Keep dependencies updated (`npm audit`)
- [ ] Use HTTPS in production
- [ ] Run as non-root user in containers
