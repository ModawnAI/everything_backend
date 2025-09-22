#!/usr/bin/env node

/**
 * Payment Reconciliation Test Runner
 * 
 * Runs comprehensive tests for the payment reconciliation system including:
 * - Unit tests for reconciliation services
 * - Integration tests with real database
 * - Performance tests for large datasets
 * - End-to-end reconciliation workflows
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configurations
const testConfigs = {
  unit: {
    description: 'Unit tests for payment reconciliation services',
    pattern: 'tests/unit/payment-reconciliation.test.ts',
    timeout: 30000
  },
  integration: {
    description: 'Integration tests with real database',
    pattern: 'tests/integration/payment-reconciliation-integration.test.ts',
    timeout: 60000
  },
  performance: {
    description: 'Performance tests for large datasets',
    pattern: 'tests/performance/payment-reconciliation-performance.test.ts',
    timeout: 120000
  },
  comprehensive: {
    description: 'All reconciliation tests',
    pattern: 'tests/**/payment-reconciliation*.test.ts',
    timeout: 180000
  }
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runJest(testPattern, options = {}) {
  return new Promise((resolve, reject) => {
    const jestArgs = [
      '--testPathPattern',
      testPattern,
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      '--maxWorkers=1'
    ];

    if (options.timeout) {
      jestArgs.push('--testTimeout', options.timeout.toString());
    }

    if (options.coverage) {
      jestArgs.push('--coverage');
    }

    if (options.watch) {
      jestArgs.push('--watch');
    }

    log(`\n${colors.bright}Running: jest ${jestArgs.join(' ')}${colors.reset}\n`, 'cyan');

    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    jest.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Jest exited with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      reject(error);
    });
  });
}

async function runTests(testType) {
  const config = testConfigs[testType];
  
  if (!config) {
    log(`❌ Unknown test type: ${testType}`, 'red');
    log(`Available types: ${Object.keys(testConfigs).join(', ')}`, 'yellow');
    process.exit(1);
  }

  log(`\n${colors.bright}🧪 ${config.description}${colors.reset}`, 'blue');
  log(`Pattern: ${config.pattern}`, 'cyan');
  log(`Timeout: ${config.timeout}ms`, 'cyan');

  try {
    await runJest(config.pattern, {
      timeout: config.timeout,
      coverage: testType === 'comprehensive'
    });
    
    log(`\n✅ ${config.description} completed successfully`, 'green');
    return true;
  } catch (error) {
    log(`\n❌ ${config.description} failed: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log(`\n${colors.bright}🚀 Running All Payment Reconciliation Tests${colors.reset}`, 'magenta');
  
  const testTypes = ['unit', 'integration', 'comprehensive'];
  const results = [];
  
  for (const testType of testTypes) {
    const success = await runTests(testType);
    results.push({ testType, success });
    
    if (!success) {
      log(`\n⚠️  ${testType} tests failed, but continuing with remaining tests...`, 'yellow');
    }
  }
  
  // Summary
  log(`\n${colors.bright}📊 Test Results Summary${colors.reset}`, 'blue');
  results.forEach(({ testType, success }) => {
    const status = success ? '✅ PASSED' : '❌ FAILED';
    const color = success ? 'green' : 'red';
    log(`${testType.padEnd(15)} ${status}`, color);
  });
  
  const allPassed = results.every(r => r.success);
  if (allPassed) {
    log(`\n🎉 All payment reconciliation tests passed!`, 'green');
  } else {
    log(`\n⚠️  Some tests failed. Check the output above for details.`, 'yellow');
    process.exit(1);
  }
}

async function runPerformanceTests() {
  log(`\n${colors.bright}⚡ Running Payment Reconciliation Performance Tests${colors.reset}`, 'magenta');
  
  try {
    await runTests('performance');
    log(`\n✅ Performance tests completed successfully`, 'green');
  } catch (error) {
    log(`\n❌ Performance tests failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function runWithCoverage() {
  log(`\n${colors.bright}📊 Running Payment Reconciliation Tests with Coverage${colors.reset}`, 'magenta');
  
  try {
    await runJest(testConfigs.comprehensive.pattern, {
      timeout: testConfigs.comprehensive.timeout,
      coverage: true
    });
    
    log(`\n✅ Coverage report generated successfully`, 'green');
    log(`Check coverage/lcov-report/index.html for detailed coverage report`, 'cyan');
  } catch (error) {
    log(`\n❌ Coverage tests failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function runWatchMode() {
  log(`\n${colors.bright}👀 Running Payment Reconciliation Tests in Watch Mode${colors.reset}`, 'magenta');
  log(`Press 'q' to quit watch mode`, 'yellow');
  
  try {
    await runJest(testConfigs.comprehensive.pattern, {
      timeout: testConfigs.comprehensive.timeout,
      watch: true
    });
  } catch (error) {
    log(`\n❌ Watch mode failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  log(`\n${colors.bright}🔧 Payment Reconciliation Test Runner${colors.reset}`, 'blue');
  log(`Command: ${command}`, 'cyan');

  switch (command) {
    case 'unit':
      await runTests('unit');
      break;
    case 'integration':
      await runTests('integration');
      break;
    case 'performance':
      await runPerformanceTests();
      break;
    case 'comprehensive':
      await runTests('comprehensive');
      break;
    case 'coverage':
      await runWithCoverage();
      break;
    case 'watch':
      await runWatchMode();
      break;
    case 'all':
      await runAllTests();
      break;
    default:
      log(`\n❌ Unknown command: ${command}`, 'red');
      log(`\nAvailable commands:`, 'yellow');
      log(`  unit          - Run unit tests only`, 'cyan');
      log(`  integration   - Run integration tests only`, 'cyan');
      log(`  performance   - Run performance tests only`, 'cyan');
      log(`  comprehensive - Run all reconciliation tests`, 'cyan');
      log(`  coverage      - Run tests with coverage report`, 'cyan');
      log(`  watch         - Run tests in watch mode`, 'cyan');
      log(`  all           - Run all test types (default)`, 'cyan');
      process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log(`\n\n⚠️  Test execution interrupted by user`, 'yellow');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log(`\n\n⚠️  Test execution terminated`, 'yellow');
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  log(`\n💥 Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

