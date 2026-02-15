const RDYSLSeasonScraper = require('./src/rdysl-season-scraper');

// Test with Boys U13 Div 1 (the example you provided)
const testUrl = 'https://www.rdysl.com/standings?Y=2025;GAD=Boys:13:1';

async function testSingleDivision() {
  const scraper = new RDYSLSeasonScraper({
    year: 2025,
    outputDir: './exports'
  });

  try {
    await scraper.initialize();
    
    // Manually test one division
    const divisionInfo = {
      url: testUrl,
      gender: 'Boys',
      age: 13,
      division: 1,
      label: 'Boys U13 Div 1'
    };

    console.log(`\nTesting single division: ${divisionInfo.label}`);
    console.log(`URL: ${testUrl}\n`);

    const games = await scraper.scrapeDivisionGames(divisionInfo);
    
    console.log(`\nFound ${games.length} games\n`);
    
    if (games.length > 0) {
      console.log('First few games:');
      games.slice(0, 5).forEach((game, i) => {
        console.log(`\nGame ${i + 1}:`);
        console.log(`  Game ID: ${game.game}`);
        console.log(`  Day: ${game.day}`);
        console.log(`  Date: ${game.date}`);
        console.log(`  Time: ${game.time}`);
        console.log(`  Status: ${game.status}`);
        console.log(`  Home: ${game.homeTeamName} (${game.homeTeamScore})`);
        console.log(`  Visiting: ${game.visitingTeamName} (${game.visitingTeamScore})`);
        console.log(`  Site & Field: ${game.siteField}`);
      });
    }

    await scraper.close();
  } catch (error) {
    console.error('Test failed:', error);
    await scraper.close();
    process.exit(1);
  }
}

testSingleDivision();



