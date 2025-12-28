#!/usr/bin/env node

/**
 * Database Migration CLI Tool
 * 
 * Command-line interface for managing database migrations
 * including running, rolling back, and checking migration status
 */

const { runMigrations, rollbackMigration, rollbackToVersion, getMigrationStatus, validateMigrations } = require('../dist/migrations/migration-runner');

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
  header: (msg) => console.log(`${colors.bold}${colors.cyan}\n🔄 ${msg}${colors.reset}\n`)
};

/**
 * Display help information
 */
function showHelp() {
  console.log(`${colors.bold}${colors.cyan}🗄️  Database Migration Tool${colors.reset}\n`);
  
  console.log(`${colors.bold}Usage:${colors.reset}`);
  console.log(`  node scripts/migrate.js <command> [options]\n`);
  
  console.log(`${colors.bold}Commands:${colors.reset}`);
  console.log(`  ${colors.green}up${colors.reset}                    Run all pending migrations`);
  console.log(`  ${colors.green}status${colors.reset}                Show migration status`);
  console.log(`  ${colors.green}validate${colors.reset}              Validate migration integrity`);
  console.log(`  ${colors.yellow}rollback <version>${colors.reset}     Rollback specific migration`);
  console.log(`  ${colors.yellow}rollback-to <version>${colors.reset} Rollback to specific version`);
  console.log(`  ${colors.blue}help${colors.reset}                  Show this help message\n`);
  
  console.log(`${colors.bold}Examples:${colors.reset}`);
  console.log(`  node scripts/migrate.js up`);
  console.log(`  node scripts/migrate.js status`);
  console.log(`  node scripts/migrate.js rollback 005`);
  console.log(`  node scripts/migrate.js rollback-to 003`);
  console.log(`  node scripts/migrate.js validate\n`);
}

/**
 * Run all pending migrations
 */
async function runUp() {
  log.header('Running Pending Migrations');
  
  try {
    const success = await runMigrations();
    
    if (success) {
      log.success('All migrations executed successfully');
      await showStatus();
    } else {
      log.error('Migration execution failed');
      process.exit(1);
    }
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  log.header('Migration Status');
  
  try {
    const status = await getMigrationStatus();
    
    console.log(`${colors.bold}📊 Summary:${colors.reset}`);
    console.log(`   Available: ${status.available}`);
    console.log(`   Applied: ${colors.green}${status.applied}${colors.reset}`);
    console.log(`   Pending: ${colors.yellow}${status.pending}${colors.reset}`);
    
    if (status.migrations.length > 0) {
      console.log(`\n${colors.bold}📋 Migrations:${colors.reset}`);
      status.migrations.forEach(migration => {
        const statusIcon = migration.status === 'applied' ? colors.green + '✅' : colors.yellow + '⏳';
        const appliedInfo = migration.appliedAt ? ` (${migration.appliedAt.toISOString()})` : '';
        console.log(`   ${statusIcon} ${migration.version}: ${migration.name}${appliedInfo}${colors.reset}`);
      });
    }
    
  } catch (error) {
    log.error(`Failed to get migration status: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Validate migrations
 */
async function runValidate() {
  log.header('Validating Migrations');
  
  try {
    const isValid = await validateMigrations();
    
    if (isValid) {
      log.success('Migration validation passed');
    } else {
      log.error('Migration validation failed');
      process.exit(1);
    }
  } catch (error) {
    log.error(`Validation failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Rollback specific migration
 */
async function runRollback(version) {
  if (!version) {
    log.error('Version is required for rollback');
    console.log('Usage: node scripts/migrate.js rollback <version>');
    process.exit(1);
  }
  
  log.header(`Rolling Back Migration ${version}`);
  
  try {
    const success = await rollbackMigration(version);
    
    if (success) {
      log.success(`Migration ${version} rolled back successfully`);
      await showStatus();
    } else {
      log.error(`Failed to rollback migration ${version}`);
      process.exit(1);
    }
  } catch (error) {
    log.error(`Rollback failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Rollback to specific version
 */
async function runRollbackTo(version) {
  if (!version) {
    log.error('Target version is required');
    console.log('Usage: node scripts/migrate.js rollback-to <version>');
    process.exit(1);
  }
  
  log.header(`Rolling Back to Version ${version}`);
  
  try {
    const success = await rollbackToVersion(version);
    
    if (success) {
      log.success(`Successfully rolled back to version ${version}`);
      await showStatus();
    } else {
      log.error(`Failed to rollback to version ${version}`);
      process.exit(1);
    }
  } catch (error) {
    log.error(`Rollback failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main CLI function
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  
  switch (command) {
    case 'up':
      await runUp();
      break;
    case 'status':
      await showStatus();
      break;
    case 'validate':
      await runValidate();
      break;
    case 'rollback':
      await runRollback(arg);
      break;
    case 'rollback-to':
      await runRollbackTo(arg);
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
    console.error('Migration tool failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runUp,
  showStatus,
  runValidate,
  runRollback,
  runRollbackTo
};
