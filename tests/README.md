# Hilton Heat Registration Tests

This directory contains end-to-end tests for the Hilton Heat Soccer Club registration management system.

## Test Structure

### E2E Tests (`tests/e2e/`)
- **`registration.spec.js`** - Tests for the main registration interface and user workflows
- **`api.spec.js`** - Tests for API endpoints and backend functionality

### Test Data (`tests/e2e/test-data/`)
- **`sample-registrations.csv`** - Sample CSV file for testing registration import

## Running Tests

### Prerequisites
```bash
# Install dependencies including Playwright
npm install
```

### Running All Tests
```bash
# Run all tests
npm run test:e2e

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Run tests with UI mode
npm run test:e2e:ui

# Debug mode (step through tests)
npm run test:e2e:debug
```

### Running Specific Test Files
```bash
# Run only registration interface tests
npx playwright test registration.spec.js

# Run only API tests
npx playwright test api.spec.js

# Run specific test
npx playwright test -g "should load the registration interface"
```

## Test Coverage

### Interface Tests (`registration.spec.js`)
- ✅ **Page Loading** - Verifies the registration interface loads correctly
- ✅ **Navigation** - Tests tab switching between Dashboard, Teams, Registrations, etc.
- ✅ **Dashboard Display** - Checks that stats cards and quick actions are visible
- ✅ **Team Creation** - Tests team creation form and API integration
- ✅ **Team Loading** - Verifies teams are loaded from API and displayed
- ✅ **Registration Import** - Tests both CSV upload and TeamSnap API workflows
- ✅ **Data Display** - Checks that registration data is properly displayed
- ✅ **Evaluation Workflow** - Tests coach evaluation import process
- ✅ **Invitation Workflow** - Tests player invitation creation
- ✅ **Error Handling** - Verifies graceful handling of API errors
- ✅ **Form Validation** - Tests form validation and user feedback
- ✅ **Responsive Design** - Ensures mobile compatibility

### API Tests (`api.spec.js`)
- ✅ **Health Check** - Verifies system health endpoint
- ✅ **Team Management** - Tests team creation and retrieval APIs
- ✅ **Registration Management** - Tests registration data APIs
- ✅ **File Operations** - Tests CSV export functionality
- ✅ **TeamSnap Integration** - Tests TeamSnap API endpoints
- ✅ **Error Validation** - Tests API error responses and validation
- ✅ **Rate Limiting** - Tests API rate limiting behavior

## Test Environment

The tests run against the actual application running on `http://localhost:3000`. The Playwright configuration automatically:

1. **Starts the server** before running tests (if not already running)
2. **Uses multiple browsers** (Chrome, Firefox, Safari) for cross-browser testing
3. **Mocks API responses** where needed for consistent test results
4. **Captures screenshots** on test failures for debugging
5. **Generates HTML reports** for test results

## Test Data

### Sample Registration Data
The `sample-registrations.csv` file contains test data with:
- Player names and contact information
- Age groups (U11, U12, U13)
- Parent information
- Registration dates and notes

### API Response Mocks
Tests mock various API responses to ensure consistent behavior:
- Successful team creation
- Registration data loading
- Error scenarios
- File upload responses

## Debugging Tests

### Viewing Test Results
```bash
# Generate and view HTML report
npx playwright show-report

# Run tests with detailed logging
DEBUG=pw:api npx playwright test
```

### Common Issues
1. **Server not running** - Tests will automatically start the server
2. **Port conflicts** - Tests use port 3000 by default
3. **Browser issues** - Tests run in headless mode by default
4. **Network timeouts** - Tests wait up to 2 minutes for server startup

### Adding New Tests
1. Create new test file in `tests/e2e/`
2. Follow the existing pattern with `test.describe()` and `test()` functions
3. Use `await expect()` for assertions
4. Mock external dependencies as needed
5. Add appropriate comments explaining test purpose

## CI/CD Integration

The tests are designed to run in CI environments:
- ✅ **Headless execution** - No GUI required
- ✅ **Automatic server startup** - No manual setup needed
- ✅ **Retry logic** - Handles flaky tests
- ✅ **HTML reports** - Easy result viewing
- ✅ **Screenshot capture** - Failure debugging







