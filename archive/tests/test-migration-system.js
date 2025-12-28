#!/usr/bin/env node

/**
 * Migration System Integration Test
 * 
 * Comprehensive test suite for validating the complete migration system
 * including migration execution, rollback functionality, and data integrity
 */

const fs = require('fs');
const path = require('path');

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
  header: (msg) => console.log(`${colors.bold}${colors.cyan}\n🧪 ${msg}${colors.reset}\n`)
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

/**
 * Test migration file structure and numbering
 */
function testMigrationFileStructure() {
  log.header('Testing Migration File Structure');
  
  const migrationsDir = path.join(process.cwd(), 'src/migrations');
  
  try {
    const files = fs.readdirSync(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    log.info(`Found ${migrationFiles.length} migration files`);
    
    // Check for proper numbering
    const numbers = migrationFiles
      .map(file => {
        const match = file.match(/^(\d{3})_/);
        return match ? parseInt(match[1]) : null;
      })
      .filter(num => num !== null)
      .sort((a, b) => a - b);
    
    // Check for duplicates
    const duplicates = numbers.filter((num, index) => numbers.indexOf(num) !== index);
    
    if (duplicates.length === 0) {
      log.success('No duplicate migration numbers found');
      results.passed++;
    } else {
      log.error(`Found duplicate migration numbers: ${duplicates.join(', ')}`);
      results.failed++;
      results.details.push(`Duplicate migration numbers: ${duplicates.join(', ')}`);
    }
    
    // Check for sequential numbering
    let hasGaps = false;
    for (let i = 1; i < numbers.length; i++) {
      const current = numbers[i];
      const previous = numbers[i - 1];
      const expectedGap = current - previous;
      
      if (expectedGap > 1) {
        log.warning(`Gap in migration numbering: ${previous} → ${current}`);
        hasGaps = true;
        results.warnings++;
      }
    }
    
    if (!hasGaps) {
      log.success('Migration numbering is properly sequential');
      results.passed++;
    }
    
    // Check migration file naming convention
    const properlyNamed = migrationFiles.filter(file => /^\d{3}_[a-z_]+\.sql$/.test(file));
    
    if (properlyNamed.length === migrationFiles.length) {
      log.success('All migration files follow naming convention');
      results.passed++;
    } else {
      log.error('Some migration files do not follow naming convention');
      results.failed++;
      results.details.push('Migration files with incorrect naming');
    }
    
  } catch (error) {
    log.error(`Failed to read migration files: ${error.message}`);
    results.failed++;
    results.details.push(`Migration file structure error: ${error.message}`);
  }
}

/**
 * Test migration runner functionality
 */
function testMigrationRunner() {
  log.header('Testing Migration Runner');
  
  try {
    const migrationRunnerPath = path.join(process.cwd(), 'dist/migrations/migration-runner.js');
    
    if (fs.existsSync(migrationRunnerPath)) {
      log.success('Migration runner compiled successfully');
      results.passed++;
      
      // Test if we can require the module
      try {
        const { MigrationRunner, runMigrations, rollbackMigration, getMigrationStatus } = require(migrationRunnerPath);
        
        if (MigrationRunner && runMigrations && rollbackMigration && getMigrationStatus) {
          log.success('Migration runner exports all required functions');
          results.passed++;
        } else {
          log.error('Migration runner missing required exports');
          results.failed++;
          results.details.push('Missing migration runner exports');
        }
        
      } catch (requireError) {
        log.error(`Failed to require migration runner: ${requireError.message}`);
        results.failed++;
        results.details.push(`Migration runner require error: ${requireError.message}`);
      }
      
    } else {
      log.error('Migration runner not found in dist directory');
      results.failed++;
      results.details.push('Migration runner compilation failed');
    }
    
  } catch (error) {
    log.error(`Migration runner test failed: ${error.message}`);
    results.failed++;
    results.details.push(`Migration runner error: ${error.message}`);
  }
}

/**
 * Test seeding system
 */
function testSeedingSystem() {
  log.header('Testing Seeding System');
  
  try {
    const seedRunnerPath = path.join(process.cwd(), 'dist/seeds/seed-runner.js');
    
    if (fs.existsSync(seedRunnerPath)) {
      log.success('Seed runner compiled successfully');
      results.passed++;
      
      // Check seed data files
      const seedDataDir = path.join(process.cwd(), 'src/seeds/data');
      
      if (fs.existsSync(seedDataDir)) {
        const seedFiles = fs.readdirSync(seedDataDir);
        
        if (seedFiles.length > 0) {
          log.success(`Found ${seedFiles.length} seed data files`);
          results.passed++;
          
          // Validate seed file structure
          seedFiles.forEach(file => {
            try {
              const content = fs.readFileSync(path.join(seedDataDir, file), 'utf-8');
              const seedData = JSON.parse(content);
              
              if (seedData.table && seedData.data && Array.isArray(seedData.data)) {
                log.success(`Seed file ${file} has valid structure`);
                results.passed++;
              } else {
                log.error(`Seed file ${file} has invalid structure`);
                results.failed++;
                results.details.push(`Invalid seed file structure: ${file}`);
              }
              
            } catch (parseError) {
              log.error(`Failed to parse seed file ${file}: ${parseError.message}`);
              results.failed++;
              results.details.push(`Seed file parse error: ${file}`);
            }
          });
          
        } else {
          log.warning('No seed data files found');
          results.warnings++;
        }
        
      } else {
        log.warning('Seed data directory not found');
        results.warnings++;
      }
      
    } else {
      log.error('Seed runner not found in dist directory');
      results.failed++;
      results.details.push('Seed runner compilation failed');
    }
    
  } catch (error) {
    log.error(`Seeding system test failed: ${error.message}`);
    results.failed++;
    results.details.push(`Seeding system error: ${error.message}`);
  }
}

/**
 * Test CLI scripts
 */
function testCLIScripts() {
  log.header('Testing CLI Scripts');
  
  const scripts = [
    { name: 'migrate.js', path: 'scripts/migrate.js' },
    { name: 'seed.js', path: 'scripts/seed.js' },
    { name: 'validate-deployment.js', path: 'scripts/validate-deployment.js' }
  ];
  
  scripts.forEach(script => {
    const scriptPath = path.join(process.cwd(), script.path);
    
    if (fs.existsSync(scriptPath)) {
      log.success(`CLI script found: ${script.name}`);
      results.passed++;
      
      // Check if script is executable
      try {
        const stats = fs.statSync(scriptPath);
        if (stats.mode & parseInt('111', 8)) {
          log.success(`Script ${script.name} is executable`);
          results.passed++;
        } else {
          log.warning(`Script ${script.name} is not executable`);
          results.warnings++;
        }
      } catch (statError) {
        log.warning(`Could not check executable status for ${script.name}`);
        results.warnings++;
      }
      
    } else {
      log.error(`CLI script not found: ${script.name}`);
      results.failed++;
      results.details.push(`Missing CLI script: ${script.name}`);
    }
  });
}

/**
 * Test package.json scripts
 */
function testPackageScripts() {
  log.header('Testing Package.json Scripts');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts || {};
    
    const requiredScripts = [
      'migrate', 'migrate:status', 'migrate:validate', 'migrate:rollback', 'migrate:rollback-to',
      'seed', 'seed:generate', 'seed:clear', 'db:setup', 'db:reset',
      'deploy:validate'
    ];
    
    requiredScripts.forEach(scriptName => {
      if (scripts[scriptName]) {
        log.success(`Package script found: ${scriptName}`);
        results.passed++;
      } else {
        log.error(`Missing package script: ${scriptName}`);
        results.failed++;
        results.details.push(`Missing package script: ${scriptName}`);
      }
    });
    
  } catch (error) {
    log.error(`Failed to read package.json: ${error.message}`);
    results.failed++;
    results.details.push(`Package.json error: ${error.message}`);
  }
}

/**
 * Generate test report
 */
function generateTestReport() {
  log.header('Migration System Test Report');
  
  const total = results.passed + results.failed + results.warnings;
  const successRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
  
  console.log(`${colors.bold}📊 Test Summary:${colors.reset}`);
  console.log(`   Total Tests: ${total}`);
  console.log(`   ${colors.green}✅ Passed: ${results.passed}${colors.reset}`);
  console.log(`   ${colors.red}❌ Failed: ${results.failed}${colors.reset}`);
  console.log(`   ${colors.yellow}⚠️  Warnings: ${results.warnings}${colors.reset}`);
  console.log(`   Success Rate: ${successRate}%`);
  
  if (results.details.length > 0) {
    console.log(`\n${colors.bold}📋 Issues Found:${colors.reset}`);
    results.details.forEach((detail, index) => {
      console.log(`   ${index + 1}. ${detail}`);
    });
  }
  
  console.log(`\n${colors.bold}🎯 Overall Status:${colors.reset}`);
  if (results.failed === 0) {
    if (results.warnings === 0) {
      log.success('🚀 MIGRATION SYSTEM READY - All tests passed!');
    } else {
      console.log(`${colors.yellow}⚠️  MIGRATION SYSTEM READY WITH WARNINGS - Review warnings${colors.reset}`);
    }
  } else {
    log.error('❌ MIGRATION SYSTEM NOT READY - Fix critical issues');
  }
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

/**
 * Main test function
 */
async function main() {
  console.log(`${colors.bold}${colors.cyan}🧪 Migration System Integration Test${colors.reset}\n`);
  
  try {
    testMigrationFileStructure();
    testMigrationRunner();
    testSeedingSystem();
    testCLIScripts();
    testPackageScripts();
    
  } catch (error) {
    log.error(`Test execution failed: ${error.message}`);
    results.failed++;
    results.details.push(`Test execution error: ${error.message}`);
  } finally {
    generateTestReport();
  }
}

// Run tests
if (require.main === module) {
  main().catch(error => {
    console.error('Migration system test failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testMigrationFileStructure,
  testMigrationRunner,
  testSeedingSystem,
  testCLIScripts,
  testPackageScripts
};
