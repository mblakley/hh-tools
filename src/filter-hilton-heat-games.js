const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * Filter and transform RDYSL game data for Hilton Heat teams
 * Filters games where either home or visiting team starts with "Hilton Heat - "
 * and transforms to the required format
 */
class HiltonHeatGameFilter {
  constructor(inputFile, outputFile, options = {}) {
    this.inputFile = inputFile;
    this.outputFile = outputFile;
    this.filteredGames = [];
    this.homeGamesOnly = options.homeGamesOnly || false;
  }

  /**
   * Transform division format from "Boys U13 Div 1" to "BU13 Division 1"
   */
  transformDivision(gender, age, divisionNumber) {
    const genderPrefix = gender === 'Boys' ? 'B' : 'G';
    return `${genderPrefix}U${age} Division ${divisionNumber}`;
  }

  /**
   * Check if a team name starts with "Hilton Heat - "
   */
  isHiltonHeatTeam(teamName) {
    return teamName && teamName.trim().startsWith('Hilton Heat - ');
  }

  /**
   * Read and filter CSV data
   */
  async filterGames() {
    return new Promise((resolve, reject) => {
      const games = [];

      if (!fs.existsSync(this.inputFile)) {
        reject(new Error(`Input file not found: ${this.inputFile}`));
        return;
      }

      fs.createReadStream(this.inputFile)
        .pipe(csv())
        .on('data', (row) => {
          const homeTeam = row['Home Team Name'] || row['homeTeamName'] || '';
          const visitingTeam = row['Visiting Team Name'] || row['visitingTeamName'] || '';

          // Filter for games where either team is a Hilton Heat team
          // If homeGamesOnly is true, only include games where Hilton Heat is the home team
          if (this.homeGamesOnly) {
            if (this.isHiltonHeatTeam(homeTeam)) {
              games.push(row);
            }
          } else {
            if (this.isHiltonHeatTeam(homeTeam) || this.isHiltonHeatTeam(visitingTeam)) {
              games.push(row);
            }
          }
        })
        .on('end', () => {
          this.filteredGames = games;
          resolve(games);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Transform filtered games to output format
   */
  transformGames() {
    return this.filteredGames.map(game => {
      const division = this.transformDivision(
        game.Gender || game.gender,
        game.Age || game.age,
        game['Division Number'] || game.divisionNumber
      );

      const gameId = game.Game || game.game || '';
      const date = game.Date || game.date || '';
      const time = game.Time || game.time || '';
      const homeTeam = game['Home Team Name'] || game.homeTeamName || '';
      const visitingTeam = game['Visiting Team Name'] || game.visitingTeamName || '';
      const siteField = game['Site & Field'] || game.siteField || '';

      return {
        Division: division,
        GameID: gameId,
        Date: date,
        Time: time,
        Duration: '90', // Default duration
        HomeTeam: homeTeam,
        AwayTeam: visitingTeam,
        Empty1: '', // Empty column
        Empty2: '', // Empty column
        SiteField: siteField,
        URL: '', // Empty by default, can be populated if needed
        Boolean: 'False' // Default boolean value
      };
    });
  }

  /**
   * Write transformed data to CSV
   */
  async writeOutput(transformedGames) {
    // Ensure output directory exists
    const outputDir = path.dirname(this.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write CSV manually to match exact format (no headers for empty columns)
    const headerRow = 'Division,GameID,Date,Time,Duration,HomeTeam,AwayTeam,,,SiteField,URL,Boolean\n';
    const rows = transformedGames.map(game => {
      return [
        game.Division,
        game.GameID,
        game.Date,
        game.Time,
        game.Duration,
        game.HomeTeam,
        game.AwayTeam,
        '', // Empty column 1
        '', // Empty column 2
        game.SiteField,
        game.URL,
        game.Boolean
      ].join(',');
    }).join('\n');

    fs.writeFileSync(this.outputFile, headerRow + rows, 'utf8');
    console.log(`\n✅ Exported ${transformedGames.length} games to: ${this.outputFile}`);
  }

  /**
   * Run the complete filtering and transformation process
   */
  async run() {
    try {
      console.log(`Reading games from: ${this.inputFile}`);
      if (this.homeGamesOnly) {
        console.log(`Filtering for HOME GAMES ONLY (Hilton Heat is home team)`);
      }
      await this.filterGames();
      
      const gameType = this.homeGamesOnly ? 'home games' : 'games';
      console.log(`Found ${this.filteredGames.length} ${gameType} with Hilton Heat teams`);
      
      const transformedGames = this.transformGames();
      await this.writeOutput(transformedGames);
      
      return {
        success: true,
        gamesCount: transformedGames.length,
        outputFile: this.outputFile
      };
    } catch (error) {
      console.error('Error processing games:', error.message);
      throw error;
    }
  }
}

// If run directly from command line
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node filter-hilton-heat-games.js <input-csv> [output-csv] [--home-only]');
    console.error('');
    console.error('Options:');
    console.error('  --home-only    Filter for home games only (Hilton Heat is home team)');
    console.error('');
    console.error('Examples:');
    console.error('  node filter-hilton-heat-games.js exports/rdysl-2025-season.csv');
    console.error('  node filter-hilton-heat-games.js exports/rdysl-2025-season.csv exports/hilton-heat-games.csv');
    console.error('  node filter-hilton-heat-games.js exports/rdysl-2025-season.csv exports/hilton-heat-home-games.csv --home-only');
    process.exit(1);
  }

  const inputFile = args[0];
  let outputFile = null;
  let homeGamesOnly = false;

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--home-only' || args[i] === '-h') {
      homeGamesOnly = true;
    } else if (!outputFile) {
      outputFile = args[i];
    }
  }

  // Generate output filename if not provided
  if (!outputFile) {
    const inputPath = path.parse(inputFile);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const suffix = homeGamesOnly ? '-home-only' : '';
    outputFile = path.join(inputPath.dir, `hilton-heat-games${suffix}-${timestamp}.csv`);
  }

  const filter = new HiltonHeatGameFilter(inputFile, outputFile, { homeGamesOnly });

  filter.run()
    .then(result => {
      console.log(`\n✅ Processing completed successfully!`);
      console.log(`   Games: ${result.gamesCount}`);
      console.log(`   Output: ${result.outputFile}`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Processing failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = HiltonHeatGameFilter;

