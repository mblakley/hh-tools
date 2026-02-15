# Project: RDYSL Callup API & Hilton Heat Tools

## Overview

This is a Node.js/Express application for managing Rochester District Youth Soccer League (RDYSL) callup data and Hilton Heat team management. The project includes:

- REST API server for callup data access
- Web scraping with Puppeteer for RDYSL data
- SQLite database for local data storage
- TeamSnap integration for team management
- E2E tests using Playwright
- Docker support for containerized deployment

## Shell Environment

**Platform**: Windows 11 (win32)
**Shell**: Bash-compatible (Git Bash or WSL)

**Important**: The system is configured to use Unix shell syntax:
- Use forward slashes in paths (e.g., `/c/Users/markb/projects/hh-tools`)
- Use `/dev/null` instead of `NUL`
- Use Unix-style commands (`ls`, `grep`, `cat`, etc.)
- Do NOT use PowerShell-specific syntax (e.g., `Get-ChildItem`, `Select-Object`)

**Shell Detection**:
```bash
# To verify current shell
echo $SHELL          # Should show bash path
echo $0              # Shows shell name

# PowerShell detection (if ever in PowerShell)
$PSVersionTable      # Only works in PowerShell
```

**Path Conversions**:
- Windows: `c:\Users\markb\projects\hh-tools`
- Bash/Unix: `/c/Users/markb/projects/hh-tools` or `c:/Users/markb/projects/hh-tools`
- Always use forward slashes in commands

## Tech Stack

- **Runtime**: Node.js (v22 recommended based on Trail of Bits standards)
- **Framework**: Express.js
- **Database**: SQLite3
- **Web Scraping**: Puppeteer, Cheerio
- **Testing**: Playwright (E2E), Jest (unit tests - configured but minimal tests currently)
- **Package Manager**: npm (consider switching to pnpm per ToB recommendations)
- **DevOps**: Docker, Docker Compose, nodemon

## Development Standards

### Code Style & Quality

- **Line Length**: Max 100 characters
- **Function Length**: Max 50 lines per function
- **Complexity**: Avoid deeply nested logic (max 3-4 levels)
- **No Premature Abstraction**: Don't create utilities for one-time operations
- **Replace, Don't Deprecate**: Remove unused code completely, no `// removed` comments

### Build & Test Commands

```bash
# Development
npm run dev              # Start with nodemon auto-reload
npm run dev:docker       # Start in Docker development mode

# Production
npm start                # Start server

# Testing
npm test                 # Run Jest tests
npx playwright test      # Run E2E tests
npx playwright test --ui # Run E2E tests in UI mode

# Scraping & Data Operations
npm run scrape-season    # Scrape RDYSL season data
npm run filter-hilton-heat # Filter Hilton Heat specific games
```

### File Organization

```
src/                    # Source modules
├── database.js         # SQLite database operations
├── email.js           # Email notification handling
├── teamsnap-api.js    # TeamSnap API integration
├── rdysl-season-scraper.js  # RDYSL web scraping
└── player-assignments.js    # Player assignment logic

public/                # Static frontend files
├── js/                # Frontend JavaScript
├── *.html            # Web interfaces
└── *.xlsx            # Static data files

tests/
├── e2e/              # Playwright E2E tests
└── test-data/        # Test fixtures

exports/              # Generated CSV/data exports (gitignored)
```

### Security Considerations

- **Credentials**: Always use environment variables (never commit .env files)
- **Input Validation**: Use express-validator for all API inputs
- **Rate Limiting**: express-rate-limit is configured for all endpoints
- **Security Headers**: Helmet.js provides security headers
- **CORS**: Configured via ALLOWED_ORIGINS environment variable
- **Web Scraping Ethics**: Cache responses (30min default) to minimize server load

### Environment Variables

Critical environment variables (see `.env.example`):
- `RDYSL_USERNAME`, `RDYSL_PASSWORD` - RDYSL credentials
- `TEAMSNAP_TOKEN` - TeamSnap API authentication
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode
- `CACHE_DURATION_MINUTES` - Scraping cache duration

### Docker Development

```bash
# Development mode with auto-reload
docker-compose -f docker-compose.dev.yml up

# Production mode
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild after dependency changes
docker-compose up --build
```

### Git Workflow

- **Main Branch**: `main` (current working branch: `master` - consider aligning)
- **Commit Style**: Conventional commits preferred
- **Pre-commit**: No hooks configured yet (consider adding linting)
- **Never Force Push**: Especially to main/master branches

### Testing Guidelines

1. **E2E Tests First**: Run Playwright tests before considering implementation complete
2. **Test Data**: Use fixtures in `tests/test-data/` for sample data
3. **Browser Tests**: Playwright configured for Chromium, Firefox, WebKit
4. **Coverage**: Focus on critical paths (auth, data scraping, API endpoints)

### Common Tasks

**Adding a new API endpoint:**
1. Add route in `server.js`
2. Implement validation with express-validator
3. Add rate limiting if needed
4. Create E2E test in `tests/e2e/api.spec.js`
5. Update API documentation in README

**Modifying web scraping:**
1. Update selectors in `src/rdysl-season-scraper.js`
2. Test against actual RDYSL website structure
3. Verify cache invalidation works correctly
4. Check error handling for structure changes

**Database changes:**
1. Modify schema in `src/database.js`
2. Handle migrations gracefully (this project doesn't use formal migrations yet)
3. Update all affected queries
4. Test with fresh database creation

### Linting & Formatting

**Current State**: No linters configured

**Recommended Additions** (based on Trail of Bits):
- `oxlint` for JavaScript/TypeScript linting (faster than ESLint)
- Consider adding `.prettierrc` for consistent formatting
- Add pre-commit hooks for automatic formatting

### Known Patterns

- **Caching Strategy**: In-memory caching with timestamps, 30min default TTL
- **Error Handling**: Try-catch with descriptive error messages returned to client
- **Async/Await**: Preferred over callbacks/promises chains
- **Database Access**: Direct sqlite3 queries (no ORM)

### Documentation Files

The project has extensive markdown documentation:
- `TEAMSNAP_*.md` - TeamSnap integration documentation
- `DOCKER_DEV_README.md` - Docker development guide
- `PLAYWRIGHT_TEST_RESULTS.md` - Test execution notes
- `WEB_INTERFACE_GUIDE.md` - Frontend usage guide

Consult these for context before making changes to related features.

### Dependencies Management

**Production Dependencies**: Keep minimal, audit regularly for vulnerabilities
**Development Dependencies**: nodemon, jest, playwright

Run `npm audit` regularly. Consider adding `npm audit` to CI pipeline.

### Performance Considerations

- **Puppeteer Memory**: Can be memory-intensive, monitor in production
- **Concurrent Scraping**: Limited to avoid overwhelming target sites
- **Database**: SQLite suitable for current scale, consider PostgreSQL if scaling

## MCP Tools Available

This project has the following MCP servers configured in `.mcp.json`:

### agent-browser
Headless browser automation for AI agents. Use this for:
- **Web scraping tasks**: Navigate pages, extract data, interact with forms
- **Testing web interfaces**: Verify UI behavior, take screenshots
- **RDYSL scraping**: Alternative to Puppeteer for debugging scraping issues
- **TeamSnap web interaction**: Automate tasks on TeamSnap web interface

**Capabilities**:
- Navigate URLs, click elements, type text
- Take screenshots and generate accessibility trees
- Execute JavaScript in page context
- Manage cookies and localStorage
- Multiple isolated sessions
- Network request interception

**Session**: Uses `hh-tools-dev` session for this project

### playwright
Official Microsoft Playwright MCP server for browser automation. Use this for:
- **E2E test automation**: Create and debug Playwright tests
- **Browser automation**: Fast, accessibility-tree based interactions (no screenshots needed)
- **Multi-browser testing**: Chromium, Firefox, WebKit support
- **API testing**: REST API automation alongside browser tests
- **Test generation**: AI-assisted test creation using Playwright's codegen

**Capabilities**:
- Navigate pages and interact via accessibility tree
- Fill forms, click elements, type text
- Handle assertions and test expectations
- Manage browser contexts and pages
- Network interception and mocking
- Screenshot and video recording
- Trace recording for debugging

**Advantages over agent-browser**:
- More token-efficient (uses structured accessibility data)
- Better for test creation and maintenance
- Native integration with existing Playwright tests in `tests/e2e/`

### context7
Library documentation lookup (no API key required). Use this for:
- Quick reference to Express.js, Puppeteer, Playwright APIs
- Looking up Node.js built-in modules
- Checking npm package documentation

## When in Doubt

1. Check existing patterns in `src/` files before inventing new approaches
2. Consult the extensive markdown documentation for context
3. Run E2E tests to verify changes don't break existing functionality
4. Use agent-browser MCP for interactive browser debugging when Puppeteer behaves unexpectedly
5. Ask before making architectural changes or adding new dependencies
