#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  timeout: 300000, // 5 minutes
  retries: 3,
  delay: 2000,
  testFiles: [
    'tests/integration/supabase-api-comprehensive.test.ts',
    'tests/integration/concurrent-booking.test.ts',
    'tests/integration/time-slot-integration.test.ts',
    'tests/integration/user-management.test.ts',
    'tests/integration/social-auth.test.ts',
    'tests/unit/reservation.service.test.ts',
    'tests/unit/point-balance.service.test.ts',
    'tests/unit/time-slot.service.test.ts',
    'tests/security/auth-security.test.ts',
    'tests/security/integration-security.test.ts',
    'tests/security/rate-limit-security.test.ts',
    'tests/security/rbac-security.test.ts',
  ],
  environment: {
    NODE_ENV: 'test',
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
    TOSS_PAYMENTS_SECRET_KEY: process.env.TOSS_PAYMENTS_SECRET_KEY || 'test-secret-key',
    TOSS_PAYMENTS_CLIENT_KEY: process.env.TOSS_PAYMENTS_CLIENT_KEY || 'test-client-key',
    FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || 'test-fcm-key',
    FCM_PROJECT_ID: process.env.FCM_PROJECT_ID || 'test-project',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    PORT: '3001', // Use different port for testing
  }
};

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

function logSubSection(title) {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'-'.repeat(40)}`, 'blue');
}

// Check if required environment variables are set
function checkEnvironment() {
  logSection('Environment Check');
  
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    log(`❌ Missing required environment variables: ${missing.join(', ')}`, 'red');
    log('Please set these variables in your .env file or environment', 'yellow');
    process.exit(1);
  }
  
  log('✅ All required environment variables are set', 'green');
  
  // Log configuration
  log(`\nTest Configuration:`, 'bright');
  log(`  - Timeout: ${TEST_CONFIG.timeout}ms`);
  log(`  - Test Files: ${TEST_CONFIG.testFiles.length}`);
  log(`  - Environment: ${TEST_CONFIG.environment.NODE_ENV}`);
}

// Check if test files exist
function checkTestFiles() {
  logSection('Test Files Check');
  
  const missing = TEST_CONFIG.testFiles.filter(file => !fs.existsSync(file));
  
  if (missing.length > 0) {
    log(`❌ Missing test files:`, 'red');
    missing.forEach(file => log(`  - ${file}`, 'red'));
    process.exit(1);
  }
  
  log('✅ All test files exist', 'green');
}

// Run a single test file
function runTestFile(testFile) {
  return new Promise((resolve, reject) => {
    logSubSection(`Running: ${testFile}`);
    
    const startTime = Date.now();
    const env = { ...process.env, ...TEST_CONFIG.environment };
    
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
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      jest.kill('SIGTERM');
      log(`⏰ ${testFile} - TIMEOUT`, 'yellow');
      resolve({ file: testFile, status: 'timeout', duration: TEST_CONFIG.timeout });
    }, TEST_CONFIG.timeout);
  });
}

// Run all tests
async function runAllTests() {
  logSection('Running Supabase API Tests');
  
  const results = [];
  const startTime = Date.now();
  
  for (const testFile of TEST_CONFIG.testFiles) {
    try {
      const result = await runTestFile(testFile);
      results.push(result);
      
      // Add delay between tests
      if (testFile !== TEST_CONFIG.testFiles[TEST_CONFIG.testFiles.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delay));
      }
    } catch (error) {
      log(`❌ ${testFile} - CRITICAL ERROR: ${error.message}`, 'red');
      results.push({ 
        file: testFile, 
        status: 'error', 
        duration: 0, 
        error: error.message 
      });
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Generate report
  generateReport(results, totalDuration);
  
  return results;
}

// Generate test report
function generateReport(results, totalDuration) {
  logSection('Test Report');
  
  const passed = results.filter(r => r.status === 'passed');
  const failed = results.filter(r => r.status === 'failed');
  const timeout = results.filter(r => r.status === 'timeout');
  const errors = results.filter(r => r.status === 'error');
  
  log(`\nSummary:`, 'bright');
  log(`  Total Tests: ${results.length}`);
  log(`  ✅ Passed: ${passed.length}`, 'green');
  log(`  ❌ Failed: ${failed.length}`, 'red');
  log(`  ⏰ Timeout: ${timeout.length}`, 'yellow');
  log(`  💥 Errors: ${errors.length}`, 'magenta');
  log(`  ⏱️  Total Duration: ${totalDuration}ms`);
  
  // Detailed results
  if (failed.length > 0) {
    log(`\nFailed Tests:`, 'red');
    failed.forEach(result => {
      log(`  ❌ ${result.file}`, 'red');
    });
  }
  
  if (timeout.length > 0) {
    log(`\nTimeout Tests:`, 'yellow');
    timeout.forEach(result => {
      log(`  ⏰ ${result.file}`, 'yellow');
    });
  }
  
  if (errors.length > 0) {
    log(`\nError Tests:`, 'magenta');
    errors.forEach(result => {
      log(`  💥 ${result.file}: ${result.error}`, 'magenta');
    });
  }
  
  // Performance summary
  log(`\nPerformance Summary:`, 'bright');
  results.forEach(result => {
    const status = result.status === 'passed' ? '✅' : 
                   result.status === 'failed' ? '❌' :
                   result.status === 'timeout' ? '⏰' : '💥';
    log(`  ${status} ${result.file}: ${result.duration}ms`);
  });
  
  // Overall result
  const hasFailures = failed.length > 0 || timeout.length > 0 || errors.length > 0;
  
  if (hasFailures) {
    log(`\n❌ Test Suite FAILED`, 'red');
    process.exit(1);
  } else {
    log(`\n✅ All Tests PASSED`, 'green');
    process.exit(0);
  }
}

// Cleanup function
function cleanup() {
  log('\n🔄 Cleaning up...', 'yellow');
  
  // Kill any remaining processes
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (error) => {
  log(`💥 Uncaught Exception: ${error.message}`, 'red');
  cleanup();
});

// Main execution
async function main() {
  try {
    logSection('Supabase API Test Runner');
    log('Starting comprehensive API testing...', 'bright');
    
    checkEnvironment();
    checkTestFiles();
    
    const results = await runAllTests();
    
    log('\n🎉 Test execution completed!', 'green');
    
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

module.exports = {
  runAllTests,
  runTestFile,
  checkEnvironment,
  checkTestFiles,
  generateReport,
  TEST_CONFIG
};
