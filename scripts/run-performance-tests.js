#!/usr/bin/env node

/**
 * Performance Test Runner
 * 
 * Comprehensive performance testing script for reservation system
 * Supports different load levels and test types
 */

const { spawn } = require('child_process');
const path = require('path');

// Performance test configurations
const PERFORMANCE_CONFIGS = {
  quick: {
    description: 'Quick performance validation',
    testPattern: 'tests/performance/*real*.test.ts',
    timeout: 30000,
    maxWorkers: 1,
    runInBand: true
  },
  standard: {
    description: 'Standard performance testing',
    testPattern: 'tests/performance/',
    timeout: 60000,
    maxWorkers: 2,
    runInBand: true
  },
  comprehensive: {
    description: 'Comprehensive load and performance testing',
    testPattern: 'tests/performance/',
    timeout: 120000,
    maxWorkers: 1,
    runInBand: true,
    verbose: true
  },
  database: {
    description: 'Database-focused performance testing',
    testPattern: 'tests/performance/database-performance-real.test.ts',
    timeout: 60000,
    maxWorkers: 1,
    runInBand: true
  },
  reservation: {
    description: 'Reservation system load testing',
    testPattern: 'tests/performance/reservation-load-real.test.ts',
    timeout: 90000,
    maxWorkers: 1,
    runInBand: true
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'quick';
const config = PERFORMANCE_CONFIGS[testType];

if (!config) {
  console.error(`❌ Unknown test type: ${testType}`);
  console.log(`Available test types: ${Object.keys(PERFORMANCE_CONFIGS).join(', ')}`);
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
  jestArgs.push('--coverageDirectory', 'coverage/performance');
}

// Add specific test filter if provided
const testFilter = args.find(arg => arg.startsWith('--testNamePattern='));
if (testFilter) {
  jestArgs.push(testFilter);
}

// Set environment variables for performance testing
process.env.NODE_ENV = 'test';
process.env.PERFORMANCE_TEST = 'true';

console.log(`🔧 Jest command: npx jest ${jestArgs.join(' ')}`);
console.log('');

// Run Jest with performance configuration
const jest = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PERFORMANCE_TEST: 'true'
  }
});

jest.on('close', (code) => {
  if (code === 0) {
    console.log('');
    console.log('✅ Performance tests completed successfully!');
    
    // Performance test summary
    console.log(`📊 Performance Test Summary:`);
    console.log(`   Test type: ${testType}`);
    console.log(`   Configuration: ${config.description}`);
    console.log(`   Pattern: ${config.testPattern}`);
    console.log(`   Duration: ${config.timeout}ms timeout`);
    
    if (args.includes('--coverage')) {
      console.log(`   Coverage report: coverage/performance/`);
    }
  } else {
    console.error(`❌ Performance tests failed with exit code ${code}`);
    process.exit(code);
  }
});

jest.on('error', (error) => {
  console.error(`❌ Failed to start performance tests: ${error.message}`);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Performance tests interrupted by user');
  jest.kill('SIGINT');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Performance tests terminated');
  jest.kill('SIGTERM');
  process.exit(143);
});
