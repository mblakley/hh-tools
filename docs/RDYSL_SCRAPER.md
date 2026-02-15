# RDYSL Season Data Scraper

A reusable Node.js application to scrape game schedule data from the RDYSL (Rochester District Youth Soccer League) website for any season year and export it to CSV format.

## Features

- **Automated Scraping**: Automatically discovers and scrapes all division links for a specified season year
- **Comprehensive Data Extraction**: Extracts game ID, team names, dates, times, fields, and locations
- **CSV Export**: Exports all scraped data to a timestamped CSV file
- **Reusable**: Can be run multiple times for different seasons or to refresh data
- **Respectful Scraping**: Includes delays between requests to avoid overloading the server

## Usage

### Basic Usage

Scrape the 2025 season (default):

```bash
npm run scrape-season
```

### Custom Year

Scrape a different year:

```bash
node src/rdysl-season-scraper.js 2024
```

### Custom Output Directory

Specify a custom output directory:

```bash
node src/rdysl-season-scraper.js 2025 ./my-exports
```

### Programmatic Usage

You can also use the scraper in your own code:

```javascript
const RDYSLSeasonScraper = require('./src/rdysl-season-scraper');

const scraper = new RDYSLSeasonScraper({
  year: 2025,
  outputDir: './exports'
});

scraper.run()
  .then(result => {
    console.log(`Scraped ${result.gamesCount} games`);
    console.log(`CSV saved to: ${result.csvPath}`);
  })
  .catch(error => {
    console.error('Scraping failed:', error);
  });
```

## Output

The scraper generates a CSV file with the following columns:

- **Division**: Full division label (e.g., "Boys U9 Div 1")
- **Gender**: Gender category (Boys/Girls)
- **Age**: Age group (9, 10, 11, etc.)
- **Division Number**: Division number within the age group
- **Game ID**: Unique game identifier
- **Date**: Game date
- **Time**: Game time
- **Home Team**: Home team name
- **Away Team**: Away team name
- **Field**: Field name/number
- **Location**: Game location/venue
- **Raw Row Data**: Complete raw row text for debugging

Files are saved to the `exports/` directory (or your specified directory) with a timestamp:
- Format: `rdysl-YYYY-season-YYYY-MM-DDTHH-MM-SS.csv`
- Example: `rdysl-2025-season-2025-01-15T14-30-00.csv`

## How It Works

1. **Discovery**: Navigates to the season-past.htm page and extracts all division links for the specified year
2. **Scraping**: For each division link, navigates to the standings page and parses the HTML table
3. **Parsing**: Uses multiple strategies to identify and extract game data from tables:
   - Header-based parsing (identifies columns by header names)
   - Pattern-based parsing (identifies dates, times, team names)
4. **Export**: Combines all scraped games into a single CSV file

## Requirements

- Node.js (v14 or higher)
- All dependencies are already in `package.json`:
  - `puppeteer`: Browser automation
  - `cheerio`: HTML parsing
  - `csv-writer`: CSV file generation

## Notes

- The scraper does **not** require authentication (the standings pages are public)
- Scraping may take several minutes depending on the number of divisions
- The scraper includes delays between requests to be respectful to the server
- If a division page fails to load, it will log an error but continue with other divisions

## Troubleshooting

### No games found for a division
- The table structure may have changed
- Check the console output for the "Raw Row Data" column in the CSV to see what was actually scraped
- You may need to adjust the parsing logic in `parseGamesTable()` method

### Browser launch errors
- Ensure you have all dependencies installed: `npm install`
- On Linux, you may need additional dependencies for Puppeteer: `sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget`

### Network timeouts
- The scraper includes retry logic, but if you consistently get timeouts, the website may be slow or unavailable
- Try running the scraper again later



