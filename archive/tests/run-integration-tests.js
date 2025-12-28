#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Comprehensive integration testing script for reservation system workflows
 * Supports different test types and configurations
 */

const { spawn } = require('child_process');
const path = require('path');

// Integration test configurations
const INTEGRATION_CONFIGS = {
  quick: {
    description: 'Quick integration validation',
    testPattern: 'tests/integration/*real*.test.ts',
    timeout: 45000,
    maxWorkers: 1,
    runInBand: true
  },
  workflow: {
    description: 'Complete workflow integration testing',
    testPattern: 'tests/integration/reservation-workflow-real.test.ts',
    timeout: 60000,
    maxWorkers: 1,
    runInBand: true,
    verbose: true
  },
  api: {
    description: 'API endpoint integration testing',
    testPattern: 'tests/integration/api-workflow-real.test.ts',
    timeout: 60000,
    maxWorkers: 1,
    runInBand: true,
    verbose: true
  },
  comprehensive: {
    description: 'Comprehensive integration testing',
    testPattern: 'tests/integration/',
    timeout: 90000,
    maxWorkers: 1,
    runInBand: true,
    verbose: true
  },
  database: {
    description: 'Database integration testing',
    testPattern: 'tests/integration/database-*.test.ts',
    timeout: 60000,
    maxWorkers: 1,
    runInBand: true
  },
  payment: {
    description: 'Payment workflow integration testing',
    testPattern: 'tests/integration/payment-*.test.ts',
    timeout: 60000,
    maxWorkers: 1,
    runInBand: true
  },
  notification: {
    description: 'Notification workflow integration testing',
    testPattern: 'tests/integration/notification-*.test.ts',
    timeout: 45000,
    maxWorkers: 1,
    runInBand: true
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'quick';
const config = INTEGRATION_CONFIGS[testType];

if (!config) {
  console.error(`❌ Unknown test type: ${testType}`);
  console.log(`Available test types: ${Object.keys(INTEGRATION_CONFIGS).join(', ')}`);
  process.exit(1);
}

console.log(`🚀 Starting ${config.description}...`);
console.log(`📁 Test pattern: ${config.testPattern}`);
console.log(`⏱️  Timeout: ${config.timeout}ms`);
console.log(`👥 Max workers: ${config.maxWorkers}`);

// Build Jest command
const jestArgs = [
  '--testTimeout=' + config.timeout.toString(),
  '--maxWorkers=' + config.maxWorkers.toString()
];

if (config.runInBand) {
  jestArgs.push('--runInBand');
}

if (config.verbose) {
  jestArgs.push('--verbose');
}

// Add test pattern at the end
jestArgs.push(config.testPattern);

// Add coverage if requested
if (args.includes('--coverage')) {
  jestArgs.push('--coverage');
  jestArgs.push('--coverageDirectory', 'coverage/integration');
}

// Add watch mode if requested
if (args.includes('--watch')) {
  jestArgs.push('--watch');
}

// Add specific test filter if provided
const testFilter = args.find(arg => arg.startsWith('--testNamePattern='));
if (testFilter) {
  jestArgs.push(testFilter);
}

// Set environment variables for integration testing
process.env.NODE_ENV = 'test';
process.env.INTEGRATION_TEST = 'true';

console.log(`🔧 Jest command: npx jest ${jestArgs.join(' ')}`);
console.log('');

// Run Jest with integration configuration
const jest = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    INTEGRATION_TEST: 'true'
  }
});

jest.on('close', (code) => {
  if (code === 0) {
    console.log('');
    console.log('✅ Integration tests completed successfully!');
    
    // Integration test summary
    console.log(`📊 Integration Test Summary:`);
    console.log(`   Test type: ${testType}`);
    console.log(`   Configuration: ${config.description}`);
    console.log(`   Pattern: ${config.testPattern}`);
    console.log(`   Duration: ${config.timeout}ms timeout`);
    
    if (args.includes('--coverage')) {
      console.log(`   Coverage report: coverage/integration/`);
    }
  } else {
    console.error(`❌ Integration tests failed with exit code ${code}`);
    process.exit(code);
  }
});

jest.on('error', (error) => {
  console.error(`❌ Failed to start integration tests: ${error.message}`);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Integration tests interrupted by user');
  jest.kill('SIGINT');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Integration tests terminated');
  jest.kill('SIGTERM');
  process.exit(143);
});

