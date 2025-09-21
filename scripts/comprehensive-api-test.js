#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Test configuration
const TEST_CONFIG = {
  timeout: 600000, // 10 minutes
  retries: 2,
  delay: 3000,
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
    PORT: '3001',
  },
  testSuites: [
    {
      name: 'Supabase API Comprehensive Tests',
      file: 'tests/integration/supabase-api-comprehensive.test.ts',
      timeout: 300000,
      critical: true
    },
    {
      name: 'Database Functions Tests',
      file: 'tests/integration/database-functions.test.ts',
      timeout: 300000,
      critical: true
    },
    {
      name: 'Concurrent Booking Tests',
      file: 'tests/integration/concurrent-booking.test.ts',
      timeout: 180000,
      critical: false
    },
    {
      name: 'Time Slot Integration Tests',
      file: 'tests/integration/time-slot-integration.test.ts',
      timeout: 180000,
      critical: false
    },
    {
      name: 'User Management Tests',
      file: 'tests/integration/user-management.test.ts',
      timeout: 180000,
      critical: false
    },
    {
      name: 'Social Auth Tests',
      file: 'tests/integration/social-auth.test.ts',
      timeout: 120000,
      critical: false
    },
    {
      name: 'Load Performance Tests',
      file: 'tests/performance/supabase-load-test.ts',
      timeout: 600000,
      critical: false
    },
    {
      name: 'Auth Security Tests',
      file: 'tests/security/auth-security.test.ts',
      timeout: 120000,
      critical: true
    },
    {
      name: 'Integration Security Tests',
      file: 'tests/security/integration-security.test.ts',
      timeout: 120000,
      critical: true
    },
    {
      name: 'Rate Limit Security Tests',
      file: 'tests/security/rate-limit-security.test.ts',
      timeout: 120000,
      critical: false
    },
    {
      name: 'RBAC Security Tests',
      file: 'tests/security/rbac-security.test.ts',
      timeout: 120000,
      critical: true
    }
  ]
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
  white: '\x1b[37m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(80)}`, 'cyan');
}

function logSubSection(title) {
  log(`\n${'-'.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'-'.repeat(60)}`, 'blue');
}

// System information
function logSystemInfo() {
  logSection('System Information');
  
  log(`Node.js Version: ${process.version}`, 'green');
  log(`Platform: ${os.platform()} ${os.arch()}`, 'green');
  log(`CPU Cores: ${os.cpus().length}`, 'green');
  log(`Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`, 'green');
  log(`Free Memory: ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`, 'green');
  log(`Working Directory: ${process.cwd()}`, 'green');
}

// Environment validation
function validateEnvironment() {
  logSection('Environment Validation');
  
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    log(`❌ Missing required environment variables: ${missing.join(', ')}`, 'red');
    log('Please set these variables in your .env file or environment', 'yellow');
    return false;
  }
  
  log('✅ All required environment variables are set', 'green');
  
  // Check optional variables
  const optional = [
    'JWT_SECRET',
    'TOSS_PAYMENTS_SECRET_KEY',
    'TOSS_PAYMENTS_CLIENT_KEY',
    'FCM_SERVER_KEY',
    'FCM_PROJECT_ID'
  ];
  
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    log(`⚠️  Missing optional variables (using defaults): ${missingOptional.join(', ')}`, 'yellow');
  }
  
  return true;
}

// Check test files existence
function checkTestFiles() {
  logSection('Test Files Validation');
  
  const missing = TEST_CONFIG.testSuites.filter(suite => !fs.existsSync(suite.file));
  
  if (missing.length > 0) {
    log(`❌ Missing test files:`, 'red');
    missing.forEach(suite => log(`  - ${suite.file}`, 'red'));
    return false;
  }
  
  log('✅ All test files exist', 'green');
  
  // Log test suite information
  log(`\nTest Suites to Run: ${TEST_CONFIG.testSuites.length}`, 'bright');
  TEST_CONFIG.testSuites.forEach((suite, index) => {
    const critical = suite.critical ? '🔴' : '🟡';
    log(`  ${index + 1}. ${critical} ${suite.name}`, 'white');
    log(`     File: ${suite.file}`, 'white');
    log(`     Timeout: ${suite.timeout}ms`, 'white');
  });
  
  return true;
}

// Run a single test suite
function runTestSuite(suite) {
  return new Promise((resolve) => {
    logSubSection(`Running: ${suite.name}`);
    
    const startTime = Date.now();
    const env = { ...process.env, ...TEST_CONFIG.environment };
    
    const jest = spawn('npx', [
      'jest', 
      suite.file, 
      '--verbose', 
      '--detectOpenHandles',
      '--forceExit',
      '--no-cache'
    ], {
      env,
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    let stdout = '';
    let stderr = '';
    
    jest.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    jest.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    jest.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      const result = {
        suite: suite.name,
        file: suite.file,
        status: code === 0 ? 'passed' : 'failed',
        duration,
        code,
        stdout,
        stderr,
        critical: suite.critical
      };
      
      if (code === 0) {
        log(`✅ ${suite.name} - PASSED (${duration}ms)`, 'green');
      } else {
        log(`❌ ${suite.name} - FAILED (${duration}ms)`, 'red');
        if (suite.critical) {
          log(`🔴 CRITICAL TEST FAILED`, 'red');
        }
      }
      
      resolve(result);
    });
    
    jest.on('error', (error) => {
      const duration = Date.now() - startTime;
      log(`💥 ${suite.name} - ERROR: ${error.message}`, 'magenta');
      
      resolve({
        suite: suite.name,
        file: suite.file,
        status: 'error',
        duration,
        error: error.message,
        critical: suite.critical
      });
    });
    
    // Set timeout
    setTimeout(() => {
      jest.kill('SIGTERM');
      log(`⏰ ${suite.name} - TIMEOUT`, 'yellow');
      resolve({
        suite: suite.name,
        file: suite.file,
        status: 'timeout',
        duration: suite.timeout,
        critical: suite.critical
      });
    }, suite.timeout);
  });
}

// Run all test suites
async function runAllTests() {
  logSection('Running Comprehensive API Tests');
  
  const results = [];
  const startTime = Date.now();
  
  // Run critical tests first
  const criticalTests = TEST_CONFIG.testSuites.filter(suite => suite.critical);
  const nonCriticalTests = TEST_CONFIG.testSuites.filter(suite => !suite.critical);
  
  logSubSection('Running Critical Tests');
  for (const suite of criticalTests) {
    const result = await runTestSuite(suite);
    results.push(result);
    
    // Stop if critical test fails
    if (result.status === 'failed' || result.status === 'error') {
      log(`🛑 Stopping test execution due to critical test failure`, 'red');
      break;
    }
    
    // Add delay between tests
    if (suite !== criticalTests[criticalTests.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delay));
    }
  }
  
  // Run non-critical tests if all critical tests passed
  const criticalFailed = results.some(r => r.critical && (r.status === 'failed' || r.status === 'error'));
  
  if (!criticalFailed) {
    logSubSection('Running Non-Critical Tests');
    for (const suite of nonCriticalTests) {
      const result = await runTestSuite(suite);
      results.push(result);
      
      // Add delay between tests
      if (suite !== nonCriticalTests[nonCriticalTests.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delay));
      }
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  return { results, totalDuration };
}

// Generate comprehensive report
function generateReport(results, totalDuration) {
  logSection('Comprehensive Test Report');
  
  const passed = results.filter(r => r.status === 'passed');
  const failed = results.filter(r => r.status === 'failed');
  const timeout = results.filter(r => r.status === 'timeout');
  const errors = results.filter(r => r.status === 'error');
  
  const criticalPassed = passed.filter(r => r.critical);
  const criticalFailed = failed.filter(r => r.critical);
  const criticalTimeout = timeout.filter(r => r.critical);
  const criticalErrors = errors.filter(r => r.critical);
  
  // Summary statistics
  log(`\nOverall Summary:`, 'bright');
  log(`  Total Test Suites: ${results.length}`, 'white');
  log(`  ✅ Passed: ${passed.length} (${(passed.length / results.length * 100).toFixed(1)}%)`, 'green');
  log(`  ❌ Failed: ${failed.length} (${(failed.length / results.length * 100).toFixed(1)}%)`, 'red');
  log(`  ⏰ Timeout: ${timeout.length} (${(timeout.length / results.length * 100).toFixed(1)}%)`, 'yellow');
  log(`  💥 Errors: ${errors.length} (${(errors.length / results.length * 100).toFixed(1)}%)`, 'magenta');
  log(`  ⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'cyan');
  
  // Critical tests summary
  log(`\nCritical Tests Summary:`, 'bright');
  log(`  🔴 Critical Tests: ${results.filter(r => r.critical).length}`, 'white');
  log(`  ✅ Critical Passed: ${criticalPassed.length}`, 'green');
  log(`  ❌ Critical Failed: ${criticalFailed.length}`, 'red');
  log(`  ⏰ Critical Timeout: ${criticalTimeout.length}`, 'yellow');
  log(`  💥 Critical Errors: ${criticalErrors.length}`, 'magenta');
  
  // Detailed results
  log(`\nDetailed Results:`, 'bright');
  results.forEach((result, index) => {
    const critical = result.critical ? '🔴' : '🟡';
    const status = result.status === 'passed' ? '✅' : 
                   result.status === 'failed' ? '❌' :
                   result.status === 'timeout' ? '⏰' : '💥';
    
    log(`  ${index + 1}. ${critical} ${status} ${result.suite}`, 'white');
    log(`     Duration: ${result.duration}ms`, 'white');
    
    if (result.status === 'failed' || result.status === 'error') {
      if (result.stderr) {
        log(`     Error: ${result.stderr.split('\n')[0]}`, 'red');
      }
    }
  });
  
  // Performance analysis
  log(`\nPerformance Analysis:`, 'bright');
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95Duration = durations[Math.floor(durations.length * 0.95)];
  
  log(`  Average Duration: ${avgDuration.toFixed(2)}ms`, 'white');
  log(`  95th Percentile: ${p95Duration}ms`, 'white');
  log(`  Fastest: ${Math.min(...durations)}ms`, 'green');
  log(`  Slowest: ${Math.max(...durations)}ms`, 'yellow');
  
  // Recommendations
  log(`\nRecommendations:`, 'bright');
  
  if (criticalFailed.length > 0) {
    log(`  🚨 CRITICAL: Fix failing critical tests before deployment`, 'red');
  }
  
  if (timeout.length > 0) {
    log(`  ⚠️  Consider optimizing slow tests or increasing timeouts`, 'yellow');
  }
  
  if (failed.length > 0 && failed.length <= 2) {
    log(`  ✅ Minor issues detected, review and fix non-critical failures`, 'green');
  }
  
  if (passed.length === results.length) {
    log(`  🎉 All tests passed! System is ready for deployment`, 'green');
  }
  
  // Overall result
  const hasCriticalFailures = criticalFailed.length > 0 || criticalTimeout.length > 0 || criticalErrors.length > 0;
  
  if (hasCriticalFailures) {
    log(`\n❌ CRITICAL TESTS FAILED - DEPLOYMENT BLOCKED`, 'red');
    return false;
  } else if (failed.length > 0) {
    log(`\n⚠️  SOME TESTS FAILED - REVIEW BEFORE DEPLOYMENT`, 'yellow');
    return false;
  } else {
    log(`\n✅ ALL TESTS PASSED - READY FOR DEPLOYMENT`, 'green');
    return true;
  }
}

// Cleanup function
function cleanup() {
  log('\n🔄 Cleaning up...', 'yellow');
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
    logSection('Supabase API Comprehensive Test Suite');
    log('Starting comprehensive testing of all Supabase APIs...', 'bright');
    
    logSystemInfo();
    
    if (!validateEnvironment()) {
      process.exit(1);
    }
    
    if (!checkTestFiles()) {
      process.exit(1);
    }
    
    const { results, totalDuration } = await runAllTests();
    const success = generateReport(results, totalDuration);
    
    log('\n🎉 Test execution completed!', success ? 'green' : 'red');
    
    process.exit(success ? 0 : 1);
    
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
  runTestSuite,
  validateEnvironment,
  checkTestFiles,
  generateReport,
  TEST_CONFIG
};
