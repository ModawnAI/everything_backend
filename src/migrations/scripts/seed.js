#!/usr/bin/env node

/**
 * Database Seeding CLI Tool
 * 
 * Command-line interface for managing database seeds
 * including running seeds, clearing data, and generating test data
 */

const { runSeeds, clearSeeds, generateSeedData } = require('../dist/seeds/seed-runner');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bold}${colors.cyan}\n🌱 ${msg}${colors.reset}\n`)
};

/**
 * Display help information
 */
function showHelp() {
  console.log(`${colors.bold}${colors.cyan}🌱 Database Seeding Tool${colors.reset}\n`);
  
  console.log(`${colors.bold}Usage:${colors.reset}`);
  console.log(`  node scripts/seed.js <command> [options]\n`);
  
  console.log(`${colors.bold}Commands:${colors.reset}`);
  console.log(`  ${colors.green}run [env]${colors.reset}            Run seeds for environment (default: development)`);
  console.log(`  ${colors.green}generate${colors.reset}             Generate sample seed data`);
  console.log(`  ${colors.yellow}clear${colors.reset}                Clear all seed data`);
  console.log(`  ${colors.blue}help${colors.reset}                 Show this help message\n`);
  
  console.log(`${colors.bold}Examples:${colors.reset}`);
  console.log(`  node scripts/seed.js run`);
  console.log(`  node scripts/seed.js run development`);
  console.log(`  node scripts/seed.js generate`);
  console.log(`  node scripts/seed.js clear\n`);
}

/**
 * Run seeds for environment
 */
async function runSeedsCommand(environment = 'development') {
  log.header(`Running Seeds for ${environment.toUpperCase()}`);
  
  try {
    const results = await runSeeds(environment);
    
    console.log(`${colors.bold}📊 Seeding Results:${colors.reset}`);
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    results.forEach(result => {
      const status = result.errors > 0 ? colors.red + '❌' : colors.green + '✅';
      console.log(`   ${status} ${result.table}: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors} errors${colors.reset}`);
      
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    });
    
    console.log(`\n${colors.bold}📋 Summary:${colors.reset}`);
    console.log(`   Total Inserted: ${colors.green}${totalInserted}${colors.reset}`);
    console.log(`   Total Skipped: ${colors.yellow}${totalSkipped}${colors.reset}`);
    console.log(`   Total Errors: ${colors.red}${totalErrors}${colors.reset}`);
    
    if (totalErrors === 0) {
      log.success('All seeds executed successfully');
    } else {
      log.warning(`Seeding completed with ${totalErrors} errors`);
    }
    
  } catch (error) {
    log.error(`Seeding failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Generate sample seed data
 */
async function generateSeedsCommand() {
  log.header('Generating Sample Seed Data');
  
  try {
    await generateSeedData({
      userCount: 50,
      shopCount: 20,
      reservationCount: 100,
      environment: 'development'
    });
    
    log.success('Sample seed data generated successfully');
    log.info('Run "node scripts/seed.js run" to apply the generated seeds');
    
  } catch (error) {
    log.error(`Seed generation failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Clear all seed data
 */
async function clearSeedsCommand() {
  log.header('Clearing All Seed Data');
  
  // Confirmation prompt
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}⚠️  This will delete all seed data. Are you sure? (y/N): ${colors.reset}`, async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        log.info('Operation cancelled');
        resolve(undefined);
        return;
      }
      
      try {
        await clearSeeds();
        log.success('All seed data cleared successfully');
      } catch (error) {
        log.error(`Failed to clear seeds: ${error.message}`);
        process.exit(1);
      }
      
      resolve(undefined);
    });
  });
}

/**
 * Main CLI function
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  
  switch (command) {
    case 'run':
      await runSeedsCommand(arg);
      break;
    case 'generate':
      await generateSeedsCommand();
      break;
    case 'clear':
      await clearSeedsCommand();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      if (!command) {
        showHelp();
      } else {
        log.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
      }
  }
}

// Run CLI
if (require.main === module) {
  main().catch(error => {
    console.error('Seeding tool failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runSeedsCommand,
  generateSeedsCommand,
  clearSeedsCommand
};
