const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');

/**
 * Serverless-compatible RDYSL Web Scraper
 * Uses @sparticuz/chromium for Vercel/AWS Lambda compatibility
 */
class RDYSLScraperServerless {
  constructor() {
    this.isAuthenticated = false;

    // RDYSL URLs
    this.baseUrl = 'https://www.rdysl.com';
    this.loginUrl = `${this.baseUrl}/clublogin`;
    this.gameFinesUrl = `${this.baseUrl}/gamefines?F=club`;

    // Credentials from environment
    this.username = process.env.RDYSL_USERNAME;
    this.password = process.env.RDYSL_PASSWORD;

    if (!this.username || !this.password) {
      throw new Error('RDYSL credentials not configured in environment variables');
    }
  }

  /**
   * Get browser instance optimized for serverless
   */
  async getBrowser() {
    // Check if running in serverless environment (Vercel, AWS Lambda, etc.)
    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isServerless) {
      console.log('Running in serverless environment, using @sparticuz/chromium');
      return await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Local development - use regular puppeteer
      console.log('Running locally, using bundled Chromium');
      const puppeteerRegular = require('puppeteer');
      return await puppeteerRegular.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ]
      });
    }
  }

  /**
   * Authenticate with RDYSL
   */
  async authenticate(page) {
    console.log('Authenticating with RDYSL...');

    await page.goto(this.loginUrl, { waitUntil: 'load', timeout: 30000 });
    await this.sleep(2000);

    // Check if already logged in
    const pageContent = await page.content();
    if (!pageContent.includes('login') || pageContent.includes('gamefines')) {
      console.log('Already logged in');
      this.isAuthenticated = true;
      return;
    }

    // Wait for login form
    await page.waitForSelector('#login-form', { timeout: 15000 });

    // Fill credentials
    await page.type('input[name="Username"]', this.username, { delay: 100 });
    await page.type('input[name="Password"]', this.password, { delay: 100 });
    await this.sleep(1000);

    // Submit form
    const submitButton = await page.$('input[name="Submit"]');
    if (submitButton) {
      await submitButton.click();
    } else {
      await page.evaluate(() => document.getElementById('login-form').submit());
    }

    // Wait for navigation
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    } catch (navError) {
      console.log('Navigation timeout, checking if login succeeded...');
    }

    await this.sleep(2000);

    // Verify login
    const finalContent = await page.content();
    if (finalContent.includes('Login corrupted') ||
        finalContent.includes('Invalid') ||
        page.url().includes('login')) {
      throw new Error('Authentication failed - invalid credentials');
    }

    this.isAuthenticated = true;
    console.log('Successfully authenticated');
  }

  /**
   * Scrape callup data from RDYSL
   */
  async scrapeCallupData() {
    let browser = null;
    let page = null;

    try {
      console.log('Launching browser...');
      browser = await this.getBrowser();
      page = await browser.newPage();

      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Authenticate
      await this.authenticate(page);

      // Navigate to game fines page
      console.log('Navigating to game fines page...');
      await page.goto(this.gameFinesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.sleep(3000);

      // Get HTML content
      const htmlContent = await page.content();

      // Check for session expiration
      if (htmlContent.includes('Login corrupted') || htmlContent.includes('login')) {
        throw new Error('Session expired during scraping');
      }

      // Parse callup records
      const callupRecords = this.parseCallupData(htmlContent);
      console.log(`Found ${callupRecords.length} callup records`);

      // Generate summary
      const summary = this.generateCallupSummary(callupRecords);

      return {
        success: true,
        summary,
        totalRecords: callupRecords.length,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Scraping failed:', error);
      return {
        success: false,
        error: error.message || 'Scraping failed'
      };
    } finally {
      if (browser) {
        await browser.close();
        console.log('Browser closed');
      }
    }
  }

  /**
   * Parse callup data from HTML content
   */
  parseCallupData(html) {
    const callupRecords = [];

    try {
      const $ = cheerio.load(html);

      $('table').each((tableIndex, table) => {
        const $table = $(table);
        const rows = $table.find('tr');

        if (rows.length === 0) return;

        const headerRow = rows.first();
        const headerCells = headerRow.find('th, td');

        let typeColumnIndex = -1;
        let nameColumnIndex = -1;

        // Find Type and Name column indices
        headerCells.each((cellIndex, cell) => {
          const text = $(cell).text().trim().toLowerCase();
          if (text.includes('type')) typeColumnIndex = cellIndex;
          if (text.includes('name')) nameColumnIndex = cellIndex;
        });

        if (typeColumnIndex !== -1 && nameColumnIndex !== -1) {
          rows.slice(1).each((rowIndex, row) => {
            const $row = $(row);
            const cells = $row.find('td, th');

            if (cells.length > Math.max(typeColumnIndex, nameColumnIndex)) {
              const typeText = cells.eq(typeColumnIndex).text().trim();
              const nameText = cells.eq(nameColumnIndex).text().trim();

              if (typeText.toLowerCase().includes('callup:') && this.isValidPlayerName(nameText)) {
                callupRecords.push({
                  name: nameText,
                  type: typeText,
                  count: 1
                });
              }
            }
          });
        }
      });

    } catch (error) {
      console.error('Error parsing HTML:', error);
    }

    return callupRecords;
  }

  /**
   * Validate player name
   */
  isValidPlayerName(text) {
    if (!text || text.length < 2) return false;
    if (!/[A-Za-z]/.test(text)) return false;
    if (/^\d+$/.test(text)) return false;
    if (text.toLowerCase().includes('callup')) return false;
    return true;
  }

  /**
   * Generate callup summary
   */
  generateCallupSummary(callupRecords) {
    const playerCounts = new Map();

    callupRecords.forEach(record => {
      const currentCount = playerCounts.get(record.name) || 0;
      playerCounts.set(record.name, currentCount + 1);
    });

    const summary = [];
    playerCounts.forEach((count, playerName) => {
      let status = 'OK';
      let isWarning = false;
      let isUnavailable = false;
      let isOverLimit = false;

      if (count > 4) {
        status = 'OVER LIMIT';
        isOverLimit = true;
      } else if (count === 4) {
        status = 'UNAVAILABLE';
        isUnavailable = true;
      } else if (count === 3) {
        status = 'WARNING';
        isWarning = true;
      }

      summary.push({
        playerName,
        callupCount: count,
        status,
        isWarning,
        isUnavailable,
        isOverLimit
      });
    });

    return summary.sort((a, b) => b.callupCount - a.callupCount);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RDYSLScraperServerless;
