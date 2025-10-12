const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { randomDelay, sleep, sanitizeForLogging, isHtmlContent, extractErrorMessage } = require('./utils');

/**
 * RDYSL Web Scraper Class
 * Handles authentication and data extraction from RDYSL website
 */
class RDYSLScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
    this.cachedData = null;
    this.lastCacheTime = null;
    this.cacheDuration = (parseInt(process.env.CACHE_DURATION_MINUTES) || 30) * 60 * 1000; // 30 minutes default
    
    // RDYSL URLs
    this.baseUrl = 'https://www.rdysl.com';
    this.loginUrl = `${this.baseUrl}/clublogin`;
    this.gameFinesUrl = `${this.baseUrl}/gamefines?F=club`;
    
    // Credentials
    this.username = process.env.RDYSL_USERNAME;
    this.password = process.env.RDYSL_PASSWORD;
  }

  /**
   * Initialize the scraper (start browser and authenticate)
   */
  async initialize() {
    try {
      console.log('Initializing RDYSL scraper...');
      
      // Launch browser
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set additional headers to look more like a real browser
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'ngrok-skip-browser-warning': '1'
      });
      
      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      
      // Authenticate
      await this.authenticate();
      
      // Cache initial data
      await this.refreshCache();
      
      console.log('RDYSL scraper initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize scraper:', error);
      throw error;
    }
  }

  /**
   * Authenticate with RDYSL
   */
  async authenticate() {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`Authentication attempt ${attempt}/${maxRetries}...`);

        // Navigate to login page with longer timeout
        await this.page.goto(this.loginUrl, {
          waitUntil: 'load',
          timeout: 60000
        });

        await sleep(randomDelay(2000, 4000));

        // Debug: Log page content to see what's actually there
        const pageContent = await this.page.content();
        console.log('Page loaded, checking for login form...');

        // Check if we're already logged in or redirected
        if (pageContent.includes('gamefines') || pageContent.includes('dashboard') || !pageContent.includes('login')) {
          console.log('Already logged in or redirected to main page');
          console.log('Page URL:', this.page.url());
          console.log('Page content length:', pageContent.length);
          this.isAuthenticated = true;
          return;
        }

        // Wait for body to be loaded
        await this.page.waitForSelector('body', { timeout: 15000 });

        // Wait for the specific login form based on the actual RDYSL structure
        console.log('Waiting for RDYSL login form...');
        await this.page.waitForSelector('#login-form', { timeout: 15000 });

        // The username field has name='Username' (capital U)
        const usernameField = await this.page.$('input[name="Username"]');
        if (!usernameField) {
          throw new Error('Could not find username field with name="Username"');
        }
        console.log('Found username field');
        await usernameField.type(this.username, { delay: 150 });

        // The password field has name='Password' (capital P)
        const passwordField = await this.page.$('input[name="Password"]');
        if (!passwordField) {
          throw new Error('Could not find password field with name="Password"');
        }
        console.log('Found password field');
        await passwordField.type(this.password, { delay: 150 });

        await sleep(randomDelay(1000, 2000));

        // Submit the form - the submit button has name="Submit"
        const submitButton = await this.page.$('input[name="Submit"]');
        if (submitButton) {
          console.log('Found submit button, clicking...');
          await submitButton.click();
        } else {
          // Fallback: submit the form directly
          console.log('Submit button not found, submitting form directly...');
          await this.page.evaluate(() => {
            document.getElementById('login-form').submit();
          });
        }

        // Wait for navigation with longer timeout
        console.log('Waiting for login navigation...');
        try {
          await this.page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          console.log('Login navigation completed');
        } catch (navError) {
          console.log('Login navigation timeout, continuing anyway...');
        }

        await sleep(randomDelay(3000, 5000));

        // Check if login was successful
        const currentUrl = this.page.url();
        const finalPageContent = await this.page.content();

        // Check for login failure indicators
        if (finalPageContent.includes('Login corrupted') ||
            finalPageContent.includes('You must login again') ||
            finalPageContent.includes('Invalid') ||
            finalPageContent.includes('login') ||
            currentUrl.includes('login')) {

          if (attempt < maxRetries) {
            console.log(`Login attempt ${attempt} failed, retrying...`);
            await sleep(randomDelay(2000, 4000));
            continue;
          } else {
            throw new Error('Login failed - invalid credentials or login page still showing after all attempts');
          }
        }

        this.isAuthenticated = true;
        console.log('Successfully authenticated with RDYSL');
        return;

      } catch (error) {
        console.error(`Authentication attempt ${attempt} failed:`, error.message);

        if (attempt >= maxRetries) {
          console.error('All authentication attempts failed');
          this.isAuthenticated = false;
          throw new Error(`Authentication failed after ${maxRetries} attempts: ${extractErrorMessage(error)}`);
        }

        // Wait before retry
        await sleep(randomDelay(2000, 4000));
      }
    }
  }

  /**
   * Navigate to game fines page and extract data
   */
  async scrapeGameFinesData() {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please initialize the scraper first.');
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`Scraping attempt ${attempt}/${maxRetries}...`);

        // Navigate to game fines page with longer timeout
        console.log('Navigating to club fees page...');
        await this.page.goto(this.gameFinesUrl, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        await sleep(randomDelay(3000, 5000));

        // Additional wait for dynamic content
        console.log('Waiting for page content to load...');
        await sleep(randomDelay(3000, 5000));

        // Get page content
        const htmlContent = await this.page.content();

        // Verify we got the right page
        if (!isHtmlContent(htmlContent)) {
          throw new Error('Invalid HTML content received');
        }

        // Check if we got redirected to login (indicates session expired)
        if (htmlContent.includes('Login corrupted') || htmlContent.includes('You must login again') || htmlContent.includes('login') || this.page.url().includes('login')) {
          console.log('Session expired or redirected to login');
          console.log('Current URL:', this.page.url());
          
          // Try re-authenticating once and retry this attempt
          console.log('Attempting re-authentication due to session expiration...');
          try {
            await this.authenticate();
            console.log('Re-authentication successful, retrying current attempt...');
            
            // Retry the navigation and scraping for this attempt
            await this.page.goto(this.gameFinesUrl, {
              waitUntil: 'networkidle2',
              timeout: 60000
            });
            
            await sleep(randomDelay(3000, 5000));
            await sleep(randomDelay(3000, 5000));
            
            const retryHtmlContent = await this.page.content();
            
            // Check again if we're still on login page
            if (retryHtmlContent.includes('Login corrupted') || retryHtmlContent.includes('You must login again') || retryHtmlContent.includes('login') || this.page.url().includes('login')) {
              throw new Error('Session expired - re-authentication failed');
            }
            
            // Use the retry content for parsing
            const retryResult = this.parseCallupData(retryHtmlContent);
            if (retryResult.success) {
              console.log(`Successfully found ${retryResult.callupRecords.length} callup records after re-authentication`);
              return retryResult;
            } else {
              throw new Error('Failed to parse data after re-authentication');
            }
          } catch (reAuthError) {
            console.error('Re-authentication failed:', reAuthError.message);
            throw new Error(`Session expired and re-authentication failed: ${reAuthError.message}`);
          }
        }

        // Check if we got a 404
        if (htmlContent.includes('404 Not Found') || htmlContent.includes('Not Found')) {
          console.log('Got 404 Not Found page');
          console.log('Current URL:', this.page.url());
          throw new Error('Page not found - check URL or authentication');
        }

        // Parse the HTML content
        const callupRecords = this.parseCallupData(htmlContent);

        if (callupRecords.length === 0) {
          console.warn(`No callup records found in scraped data (attempt ${attempt})`);

          // If no data found, try waiting a bit longer
          if (attempt < maxRetries) {
            console.log('Waiting longer and retrying...');
            await sleep(randomDelay(5000, 8000));
            continue;
          }

          console.log('Sample HTML:', sanitizeForLogging(htmlContent.substring(0, 1000)));
        } else {
          console.log(`Successfully found ${callupRecords.length} callup records`);
        }

        return {
          success: true,
          callupRecords,
          htmlContent: sanitizeForLogging(htmlContent)
        };

      } catch (error) {
        console.error(`Scraping attempt ${attempt} failed:`, error.message);

        if (attempt >= maxRetries) {
          console.error('All scraping attempts failed');
          return {
            success: false,
            error: extractErrorMessage(error)
          };
        }

        // Wait before retry
        await sleep(randomDelay(3000, 5000));
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

      // Look for tables containing callup data with various patterns
      $('table').each((tableIndex, table) => {
        const $table = $(table);
        const rows = $table.find('tr');

        if (rows.length === 0) return;

        console.log(`Processing table ${tableIndex + 1} with ${rows.length} rows`);

        // Try multiple strategies to find callup data

        // Strategy 1: Use header-based parsing to find Type and Name columns
        const headerRow = rows.first();
        const headerCells = headerRow.find('th, td');

        let typeColumnIndex = -1;
        let nameColumnIndex = -1;

        // Find Type and Name column indices from headers
        headerCells.each((cellIndex, cell) => {
          const text = $(cell).text().trim().toLowerCase();
          if (text.includes('type')) {
            typeColumnIndex = cellIndex;
          }
          if (text.includes('name')) {
            nameColumnIndex = cellIndex;
          }
        });

        if (typeColumnIndex !== -1 && nameColumnIndex !== -1) {
          console.log(`Found columns - Type: ${typeColumnIndex}, Name: ${nameColumnIndex}`);

          // Process data rows using the detected column indices
          rows.slice(1).each((rowIndex, row) => {
            const $row = $(row);
            const cells = $row.find('td, th');

            if (cells.length > Math.max(typeColumnIndex, nameColumnIndex)) {
              const typeCell = cells.eq(typeColumnIndex);
              const nameCell = cells.eq(nameColumnIndex);

              if (typeCell.length && nameCell.length) {
                const typeText = typeCell.text().trim();
                const nameText = nameCell.text().trim();

                // Check if this is a callup record
                if (typeText.toLowerCase().includes('callup:') && this.isValidPlayerName(nameText)) {
                  callupRecords.push({
                    name: nameText,
                    type: typeText,
                    count: 1
                  });
                  console.log(`Found callup record: ${nameText} - ${typeText}`);
                }
              }
            }
          });
        }
      });

      console.log(`Total callup records found: ${callupRecords.length}`);

    } catch (error) {
      console.error('Error parsing HTML:', error);
    }

    return callupRecords;
  }


  /**
   * Check if text looks like a valid player name (not just numbers)
   */
  isValidPlayerName(text) {
    if (!text || text.length < 2) return false;

    // Must contain at least one letter (not just numbers or symbols)
    if (!/[A-Za-z]/.test(text)) return false;

    // Should not be just numbers (like player IDs)
    if (/^\d+$/.test(text)) return false;

    // Should not contain "callup" (avoid matching the callup text itself)
    if (text.toLowerCase().includes('callup')) return false;

    return true;
  }

  /**
   * Generate callup summary from records
   */
  generateCallupSummary(callupRecords) {
    const playerCounts = new Map();
    
    // Count callups per player
    callupRecords.forEach(record => {
      const currentCount = playerCounts.get(record.name) || 0;
      playerCounts.set(record.name, currentCount + 1);
    });
    
    // Generate summary
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
    
    // Sort by callup count (descending)
    return summary.sort((a, b) => b.callupCount - a.callupCount);
  }

  /**
   * Refresh cached data
   */
  async refreshCache() {
    try {
      console.log('Refreshing cache...');

      const result = await this.scrapeGameFinesData();

      if (result.success) {
        const summary = this.generateCallupSummary(result.callupRecords);

        this.cachedData = {
          summary,
          totalRecords: result.callupRecords.length,
          lastUpdated: new Date().toISOString()
        };

        this.lastCacheTime = Date.now();
        console.log(`Cache refreshed with ${result.callupRecords.length} callup records`);
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Failed to refresh cache:', error);
      throw error;
    }
  }

  /**
   * Get callup data (with caching)
   */
  async getCallupData(playerSearch = '', forceRefresh = false) {
    try {
      // Check if cache is valid or if force refresh is requested
      const now = Date.now();
      const isCacheValid = this.cachedData && 
                          this.lastCacheTime && 
                          (now - this.lastCacheTime) < this.cacheDuration;
      
      if (!isCacheValid || forceRefresh) {
        if (forceRefresh) {
          console.log('Force refresh requested, refreshing cache...');
        } else {
          console.log('Cache expired or missing, refreshing...');
        }
        await this.refreshCache();
      }
      
      if (!this.cachedData) {
        throw new Error('No cached data available');
      }
      
      // Always return full results (client-side filtering will be done)
      return {
        success: true,
        summary: this.cachedData.summary,
        totalRecords: this.cachedData.totalRecords,
        lastUpdated: this.cachedData.lastUpdated
      };
      
    } catch (error) {
      console.error('Failed to get callup data:', error);
      return {
        success: false,
        error: extractErrorMessage(error)
      };
    }
  }

  /**
   * Get cached data without refreshing
   */
  async getCachedData() {
    if (!this.cachedData) {
      return {
        success: false,
        error: 'No cached data available'
      };
    }
    
    return {
      success: true,
      ...this.cachedData
    };
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isAuthenticated = false;
        console.log('Browser closed successfully');
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  /**
   * Check if scraper is ready
   */
  isReady() {
    return this.isAuthenticated && this.cachedData !== null;
  }
}

module.exports = RDYSLScraper;
