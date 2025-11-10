#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

// Test files that don't require Supabase
const testsWithoutSupabase = [
  'tests/unit/auth.middleware.test.ts',
  'tests/unit/config.test.ts',
  'tests/unit/response-formatter.test.ts',
  'tests/unit/rate-limit.middleware.test.ts',
  'tests/unit/rbac.middleware.test.ts',
  'tests/security/auth-security.test.ts',
  'tests/security/rate-limit-security.test.ts',
  'tests/security/rbac-security.test.ts',
];

// Run a single test file
function runTestFile(testFile) {
  return new Promise((resolve) => {
    log(`Running: ${testFile}`, 'blue');
    
    const startTime = Date.now();
    const env = { 
      ...process.env, 
      NODE_ENV: 'test',
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only'
    };
    
    const jest = spawn('npx', ['jest', testFile, '--verbose', '--detectOpenHandles'], {
      env,
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    jest.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      if (code === 0) {
        log(`✅ ${testFile} - PASSED (${duration}ms)`, 'green');
        resolve({ file: testFile, status: 'passed', duration });
      } else {
        log(`❌ ${testFile} - FAILED (${duration}ms)`, 'red');
        resolve({ file: testFile, status: 'failed', duration, code });
      }
    });
    
    jest.on('error', (error) => {
      log(`❌ ${testFile} - ERROR: ${error.message}`, 'red');
      resolve({ file: testFile, status: 'error', duration: 0, error: error.message });
    });
  });
}

// Check which test files exist
function checkTestFiles() {
  const fs = require('fs');
  const existing = testsWithoutSupabase.filter(file => fs.existsSync(file));
  const missing = testsWithoutSupabase.filter(file => !fs.existsSync(file));
  
  if (missing.length > 0) {
    log(`Missing test files:`, 'yellow');
    missing.forEach(file => log(`  - ${file}`, 'yellow'));
  }
  
  return existing;
}

// Run all available tests
async function runTests() {
  logSection('Running Tests Without Supabase');
  
  const existingTests = checkTestFiles();
  
  if (existingTests.length === 0) {
    log('No test files found that can run without Supabase', 'yellow');
    return;
  }
  
  log(`Found ${existingTests.length} test files that can run without Supabase`, 'green');
  
  const results = [];
  const startTime = Date.now();
  
  for (const testFile of existingTests) {
    const result = await runTestFile(testFile);
    results.push(result);
    
    // Add delay between tests
    if (testFile !== existingTests[existingTests.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Generate report
  logSection('Test Results');
  
  const passed = results.filter(r => r.status === 'passed');
  const failed = results.filter(r => r.status === 'failed');
  const errors = results.filter(r => r.status === 'error');
  
  log(`Total Tests: ${results.length}`, 'white');
  log(`✅ Passed: ${passed.length}`, 'green');
  log(`❌ Failed: ${failed.length}`, 'red');
  log(`💥 Errors: ${errors.length}`, 'magenta');
  log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'cyan');
  
  if (failed.length > 0) {
    log(`\nFailed Tests:`, 'red');
    failed.forEach(result => {
      log(`  ❌ ${result.file}`, 'red');
    });
  }
  
  if (errors.length > 0) {
    log(`\nError Tests:`, 'magenta');
    errors.forEach(result => {
      log(`  💥 ${result.file}: ${result.error}`, 'magenta');
    });
  }
  
  const success = failed.length === 0 && errors.length === 0;
  
  if (success) {
    log(`\n✅ All tests passed!`, 'green');
    process.exit(0);
  } else {
    log(`\n❌ Some tests failed`, 'red');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    await runTests();
  } catch (error) {
    log(`💥 Critical Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runTests, checkTestFiles };
