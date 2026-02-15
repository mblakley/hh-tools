const fs = require('fs');
const path = require('path');

/**
 * Update dates in CSV file from 2025 to 2026
 */
function updateDates(inputFile, outputFile) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}`);
  }

  console.log(`Reading file: ${inputFile}`);
  let content = fs.readFileSync(inputFile, 'utf8');

  // Replace all occurrences of 2025 with 2026 in date fields
  // This will match dates like 05/13/2025 -> 05/13/2026
  const updatedContent = content.replace(/2025/g, '2026');

  // Count how many replacements were made
  const matches = content.match(/2025/g);
  const replacementCount = matches ? matches.length : 0;

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, updatedContent, 'utf8');
  
  console.log(`✅ Updated ${replacementCount} occurrences of 2025 to 2026`);
  console.log(`✅ Saved to: ${outputFile}`);
  
  return {
    success: true,
    replacements: replacementCount,
    outputFile: outputFile
  };
}

// If run directly from command line
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node update-dates.js <input-csv> [output-csv]');
    console.error('');
    console.error('Examples:');
    console.error('  node update-dates.js exports/hilton-heat-games-test.csv');
    console.error('  node update-dates.js exports/hilton-heat-games-test.csv exports/hilton-heat-games-2026.csv');
    process.exit(1);
  }

  const inputFile = args[0];
  let outputFile = args[1];

  // If no output file specified, overwrite the input file
  if (!outputFile) {
    outputFile = inputFile;
    console.log('⚠️  No output file specified, will overwrite input file');
  }

  try {
    updateDates(inputFile, outputFile);
    console.log('\n✅ Date update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Date update failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = updateDates;



