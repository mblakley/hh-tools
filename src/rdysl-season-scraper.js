const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const { sleep, randomDelay } = require('./utils');

/**
 * RDYSL Season Data Scraper
 * Scrapes game schedule data from all 2025 season divisions and exports to CSV
 */
class RDYSLSeasonScraper {
  constructor(options = {}) {
    this.baseUrl = 'https://www.rdysl.com';
    this.seasonPageUrl = `${this.baseUrl}/season-past.htm`;
    this.outputDir = options.outputDir || path.join(__dirname, '..', 'exports');
    this.year = options.year || 2025;
    this.browser = null;
    this.page = null;
    this.allGames = [];
  }

  /**
   * Initialize browser
   */
  async initialize() {
    console.log('Initializing browser...');
    
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

    // Set additional headers
    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Upgrade-Insecure-Requests': '1'
    });

    await this.page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    
    console.log('Browser initialized successfully');
  }

  /**
   * Extract all 2025 season division links from the season-past page
   */
  async extractDivisionLinks() {
    console.log(`Navigating to ${this.seasonPageUrl}...`);
    
    await this.page.goto(this.seasonPageUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await sleep(randomDelay(2000, 3000));

    const html = await this.page.content();
    const $ = cheerio.load(html);

    const divisionLinks = [];
    const yearSection = $(`h2:contains('${this.year}')`).first();
    
    if (yearSection.length === 0) {
      console.warn(`Year ${this.year} section not found, searching for all links with ${this.year}...`);
    }

    // Find all links that contain the year and standings pattern
    $('a[href*="standings"]').each((index, element) => {
      const href = $(element).attr('href');
      const linkText = $(element).text().trim();
      
      // Check if this is a 2025 link
      if (href && href.includes(`Y=${this.year}`)) {
        // Build full URL
        let fullUrl = href;
        if (!href.startsWith('http')) {
          // Handle relative URLs
          if (href.startsWith('/')) {
            // Absolute path on same domain
            fullUrl = `${this.baseUrl}${href}`;
          } else if (href.startsWith('?')) {
            // Query string - append to base URL with standings path
            fullUrl = `${this.baseUrl}/standings${href}`;
          } else if (href.startsWith('standings')) {
            // Relative path starting with standings
            fullUrl = `${this.baseUrl}/${href}`;
          } else {
            // Other relative path
            fullUrl = `${this.baseUrl}/${href}`;
          }
        }
        
        // Extract division info from the link
        const match = href.match(/GAD=([^:]+):(\d+):(\d+)/);
        if (match) {
          const [, gender, age, division] = match;
          divisionLinks.push({
            url: fullUrl,
            gender: gender,
            age: parseInt(age),
            division: parseInt(division),
            label: `${gender} U${age} Div ${division}`
          });
        }
      }
    });

    // Remove duplicates
    const uniqueLinks = [];
    const seen = new Set();
    for (const link of divisionLinks) {
      const key = `${link.gender}-${link.age}-${link.division}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueLinks.push(link);
      }
    }

    console.log(`Found ${uniqueLinks.length} division links for ${this.year}`);
    return uniqueLinks.sort((a, b) => {
      if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
      if (a.age !== b.age) return a.age - b.age;
      return a.division - b.division;
    });
  }

  /**
   * Scrape game data from a standings page
   */
  async scrapeDivisionGames(divisionInfo, progressInfo = null) {
    const { url, label } = divisionInfo;
    
    const progressText = progressInfo ? ` (${progressInfo.current}/${progressInfo.total})` : '';
    console.log(`Scraping ${label}${progressText}...`);

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await sleep(randomDelay(2000, 4000));

      const html = await this.page.content();
      const games = this.parseGamesTable(html, divisionInfo);

      console.log(`  Parsed ${games.length} games`);
      return games;

    } catch (error) {
      console.error(`  Error scraping ${label}:`, error.message);
      return [];
    }
  }

  /**
   * Parse games table from HTML
   * Expected table structure:
   * Game | Day | Date | Time | Status | Home Team Name | Home Score | Home Fines | Visiting Team Name | Visiting Score | Visiting Fines | Site & Field
   */
  parseGamesTable(html, divisionInfo) {
    const games = [];
    const $ = cheerio.load(html);

    // Find the "Game Schedule" table
    // Strategy: Look for table with Game/Day/Date/Time/Status headers (not standings table)
    let scheduleTable = null;
    const allTables = $('table');
    
    // Check all tables for the schedule table structure
    allTables.each((tableIndex, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      
      if (rows.length < 2) return; // Skip tables with no data rows
      
      // Check multiple rows to find the header (might be row 0, 1, or 2)
      for (let rowIdx = 0; rowIdx < Math.min(3, rows.length); rowIdx++) {
        const $headerRow = $(rows[rowIdx]);
        const headerCells = $headerRow.find('th, td');
        const headerTexts = headerCells.map((i, cell) => $(cell).text().trim().toLowerCase()).get();
        
        // Check if this looks like a game schedule table header
        const hasGame = headerTexts.some(h => h === 'game' || (h.includes('game') && !h.includes('standings')));
        const hasDay = headerTexts.some(h => h === 'day');
        const hasDate = headerTexts.some(h => h === 'date');
        const hasTime = headerTexts.some(h => h === 'time');
        const hasStatus = headerTexts.some(h => h === 'status');
        
        // Also check for "home team" or "visiting team" which indicates schedule table
        const hasHomeTeam = headerTexts.some(h => h.includes('home') && h.includes('team'));
        const hasVisitingTeam = headerTexts.some(h => (h.includes('visiting') || h.includes('visitor')) && h.includes('team'));
        
        if ((hasGame && hasDay && hasDate && hasTime && hasStatus) || 
            (hasDate && hasTime && (hasHomeTeam || hasVisitingTeam))) {
          scheduleTable = $table;
          return false; // Break out of both loops
        }
      }
    });

    if (!scheduleTable) {
      return games;
    }

    const $scheduleTable = $(scheduleTable);
    const rows = $scheduleTable.find('tr');

    if (rows.length < 2) {
      return games;
    }

    // Find the actual header row (skip "Team Name | Score | Fines" row if present)
    let headerRowIndex = -1;
    let columnMap = {};

    // Try to find the header row with Game, Day, Date, Time, Status
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const $row = $(rows[i]);
      const cells = $row.find('th, td');
      const cellTexts = cells.map((j, cell) => $(cell).text().trim().toLowerCase()).get();
      
      // Check if this row has the schedule headers
      const hasGame = cellTexts.some(t => t === 'game' || t.includes('game'));
      const hasDay = cellTexts.some(t => t === 'day');
      const hasDate = cellTexts.some(t => t === 'date');
      const hasTime = cellTexts.some(t => t === 'time');
      const hasStatus = cellTexts.some(t => t === 'status');
      
      if (hasGame && hasDay && hasDate && hasTime && hasStatus) {
        headerRowIndex = i;
        
        // Map column positions by examining all header cells
        // Note: The header row may have fewer columns than data rows
        // Data rows follow: Game, Day, Date, Time, Status, Home Team, Home Score, Home Fines, Visiting Team, Visiting Score, Visiting Fines, Site & Field
        cells.each((j, cell) => {
          const text = $(cell).text().trim().toLowerCase();
          
          // Map exact matches for main columns
          if (text === 'game') {
            columnMap.game = j;
          } else if (text === 'day') {
            columnMap.day = j;
          } else if (text === 'date') {
            columnMap.date = j;
          } else if (text === 'time') {
            columnMap.time = j;
          } else if (text === 'status') {
            columnMap.status = j;
          } else if (text.includes('home') && text.includes('team') && !text.includes('score') && !text.includes('fines')) {
            columnMap.homeTeam = j;
          }
          // Don't map visiting team or site field from header - they're in wrong positions
          // We'll infer them based on the standard pattern
        });
        
        // Infer all column positions based on standard pattern
        // Pattern: Game(0), Day(1), Date(2), Time(3), Status(4), Home Team(5), Home Score(6), Home Fines(7), 
        //          Visiting Team(8), Visiting Score(9), Visiting Fines(10), Site & Field(11)
        if (columnMap.status !== undefined) {
          // Set home team if not found
          if (columnMap.homeTeam === undefined) {
            columnMap.homeTeam = columnMap.status + 1;
          }
          
          // Always infer score/fines positions based on standard pattern
          columnMap.homeScore = columnMap.homeTeam + 1;
          columnMap.homeFines = columnMap.homeScore + 1;
          columnMap.visitingTeam = columnMap.homeFines + 1;
          columnMap.visitingScore = columnMap.visitingTeam + 1;
          columnMap.visitingFines = columnMap.visitingScore + 1;
          columnMap.siteField = columnMap.visitingFines + 1;
        }
        
        break;
      }
    }

    if (headerRowIndex === -1) {
      return games;
    }

    // Process data rows (skip header rows)
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const $row = $(rows[i]);
      const cells = $row.find('td, th');
      
      if (cells.length === 0) continue;
      
      // Skip rows that look like sub-headers (e.g., "Team Name | Score | Fines")
      const firstCellText = cells.eq(0).text().trim().toLowerCase();
      if (firstCellText === 'team name' || firstCellText === 'score' || firstCellText === 'fines') {
        continue;
      }
      
      // Extract game data
      const getCell = (index) => {
        if (index === undefined || index < 0) return '';
        const cell = cells.eq(index);
        return cell.length ? cell.text().trim() : '';
      };
      
      const gameId = getCell(columnMap.game);
      const day = getCell(columnMap.day);
      const date = getCell(columnMap.date);
      const time = getCell(columnMap.time);
      const status = getCell(columnMap.status);
      const homeTeam = getCell(columnMap.homeTeam);
      const homeScore = getCell(columnMap.homeScore);
      const homeFines = getCell(columnMap.homeFines);
      const visitingTeam = getCell(columnMap.visitingTeam);
      const visitingScore = getCell(columnMap.visitingScore);
      const visitingFines = getCell(columnMap.visitingFines);
      const siteField = getCell(columnMap.siteField);
      
      // Only add if we have meaningful data (game ID or date)
      if (gameId || date) {
        games.push({
          division: divisionInfo.label,
          gender: divisionInfo.gender,
          age: divisionInfo.age,
          divisionNumber: divisionInfo.division,
          game: gameId,
          day: day,
          date: date,
          time: time,
          status: status,
          homeTeamName: homeTeam,
          homeTeamScore: homeScore,
          homeTeamFines: homeFines,
          visitingTeamName: visitingTeam,
          visitingTeamScore: visitingScore,
          visitingTeamFines: visitingFines,
          siteField: siteField
        });
      }
    }

    return games;
  }

  /**
   * Parse division info from a URL
   */
  parseDivisionFromUrl(url) {
    const match = url.match(/GAD=([^:]+):(\d+):(\d+)/);
    if (match) {
      const [, gender, age, division] = match;
      return {
        url: url,
        gender: gender,
        age: parseInt(age),
        division: parseInt(division),
        label: `${gender} U${age} Div ${division}`
      };
    }
    return null;
  }

  /**
   * Scrape a single division by URL
   */
  async scrapeSingleDivision(url) {
    const divisionInfo = this.parseDivisionFromUrl(url);
    if (!divisionInfo) {
      throw new Error(`Invalid division URL format: ${url}`);
    }

    const games = await this.scrapeDivisionGames(divisionInfo);
    this.allGames = this.allGames.concat(games);

    console.log(`\nTotal games scraped: ${this.allGames.length}`);
  }

  /**
   * Scrape all divisions
   */
  async scrapeAllDivisions() {
    console.log(`\n=== Starting RDYSL ${this.year} Season Scraper ===\n`);

    const divisionLinks = await this.extractDivisionLinks();

    if (divisionLinks.length === 0) {
      console.error('No division links found!');
      return;
    }

    console.log(`Found ${divisionLinks.length} divisions to scrape\n`);

    for (let i = 0; i < divisionLinks.length; i++) {
      const divisionInfo = divisionLinks[i];
      const progressInfo = {
        current: i + 1,
        total: divisionLinks.length
      };
      const games = await this.scrapeDivisionGames(divisionInfo, progressInfo);
      this.allGames = this.allGames.concat(games);

      // Add delay between requests to be respectful
      if (i < divisionLinks.length - 1) {
        await sleep(randomDelay(2000, 4000));
      }
    }

    console.log(`\n=== Scraping Complete ===`);
    console.log(`Total games scraped: ${this.allGames.length}`);
  }

  /**
   * Export games to CSV
   */
  async exportToCSV() {
    if (this.allGames.length === 0) {
      console.log('No games to export');
      return;
    }

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `rdysl-${this.year}-season-${timestamp}.csv`;
    const filepath = path.join(this.outputDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'division', title: 'Division' },
        { id: 'gender', title: 'Gender' },
        { id: 'age', title: 'Age' },
        { id: 'divisionNumber', title: 'Division Number' },
        { id: 'game', title: 'Game' },
        { id: 'day', title: 'Day' },
        { id: 'date', title: 'Date' },
        { id: 'time', title: 'Time' },
        { id: 'status', title: 'Status' },
        { id: 'homeTeamName', title: 'Home Team Name' },
        { id: 'homeTeamScore', title: 'Home Team Score' },
        { id: 'homeTeamFines', title: 'Home Team Fines' },
        { id: 'visitingTeamName', title: 'Visiting Team Name' },
        { id: 'visitingTeamScore', title: 'Visiting Team Score' },
        { id: 'visitingTeamFines', title: 'Visiting Team Fines' },
        { id: 'siteField', title: 'Site & Field' }
      ]
    });

    await csvWriter.writeRecords(this.allGames);
    console.log(`\nExported ${this.allGames.length} games to: ${filepath}`);
    
    return filepath;
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('Browser closed');
    }
  }

  /**
   * Run the complete scraping process
   * @param {string} singleUrl - Optional URL to scrape a single division
   */
  async run(singleUrl = null) {
    try {
      await this.initialize();
      
      if (singleUrl && singleUrl.trim() !== '') {
        await this.scrapeSingleDivision(singleUrl);
      } else {
        await this.scrapeAllDivisions();
      }
      
      const csvPath = await this.exportToCSV();
      await this.close();
      
      return {
        success: true,
        gamesCount: this.allGames.length,
        csvPath: csvPath
      };
    } catch (error) {
      console.error('Scraping failed:', error);
      await this.close();
      throw error;
    }
  }
}

// If run directly from command line
if (require.main === module) {
  const args = process.argv.slice(2);
  let year = 2025;
  let outputDir = undefined;
  let singleUrl = null;

  // Parse arguments
  // Usage: 
  //   node scraper.js [year] [outputDir] 
  //   OR node scraper.js --url <url> [outputDir]
  //   OR node scraper.js <url> [outputDir]
  
  if (args.length > 0) {
    if (args[0] === '--url' || args[0] === '-u') {
      // Single URL mode with --url flag
      if (args.length < 2) {
        console.error('Error: URL required after --url flag');
        console.error('Usage: node scraper.js --url <url> [outputDir]');
        process.exit(1);
      }
      singleUrl = args[1];
      outputDir = args[2] || undefined;
    } else if (args[0].startsWith('http://') || args[0].startsWith('https://')) {
      // URL provided as first argument (without --url flag)
      singleUrl = args[0];
      outputDir = args[1] || undefined;
      // Extract year from URL if possible
      const yearMatch = singleUrl.match(/Y=(\d{4})/);
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
      }
    } else {
      // Year mode (default) - treat as number
      const parsedYear = parseInt(args[0]);
      if (!isNaN(parsedYear) && args[0].length === 4) {
        // Looks like a year (4 digits)
        year = parsedYear;
        outputDir = args[1] || undefined;
      } else {
        // Not a year, might be a URL without http://
        if (args[0].includes('standings') || args[0].includes('GAD=')) {
          singleUrl = args[0].startsWith('http') ? args[0] : `https://www.rdysl.com/${args[0]}`;
          outputDir = args[1] || undefined;
          const yearMatch = singleUrl.match(/Y=(\d{4})/);
          if (yearMatch) {
            year = parseInt(yearMatch[1]);
          }
        } else {
          // Unknown format, default to year
          year = parsedYear || 2025;
          outputDir = args[1] || undefined;
        }
      }
    }
  }

  const scraper = new RDYSLSeasonScraper({
    year: year,
    outputDir: outputDir
  });

  scraper.run(singleUrl)
    .then(result => {
      console.log('\n✅ Scraping completed successfully!');
      console.log(`   Games: ${result.gamesCount}`);
      console.log(`   CSV: ${result.csvPath}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Scraping failed:', error.message);
      process.exit(1);
    });
}

module.exports = RDYSLSeasonScraper;

