#!/usr/bin/env node

/**
 * End-to-End Test Runner
 * 
 * Comprehensive E2E testing script for reservation system with real user simulation
 * Supports different test types and realistic user behavior patterns
 */

const { spawn } = require('child_process');
const path = require('path');

// E2E test configurations
const E2E_CONFIGS = {
  quick: {
    description: 'Quick E2E validation',
    testPattern: 'tests/e2e/*real*.test.ts',
    timeout: 60000,
    maxWorkers: 1,
    runInBand: true
  },
  journey: {
    description: 'Complete user journey E2E testing',
    testPattern: 'tests/e2e/user-journey-real.test.ts',
    timeout: 120000,
    maxWorkers: 1,
    runInBand: true,
    verbose: true
  },
  simulation: {
    description: 'Automated user simulation E2E testing',
    testPattern: 'tests/e2e/automated-simulation-real.test.ts',
    timeout: 300000,
    maxWorkers: 1,
    runInBand: true,
    verbose: true
  },
  comprehensive: {
    description: 'Comprehensive E2E testing suite',
    testPattern: 'tests/e2e/',
    timeout: 360000,
    maxWorkers: 1,
    runInBand: true,
    verbose: true
  },
  stress: {
    description: 'Stress testing with concurrent users',
    testPattern: 'tests/e2e/automated-simulation-real.test.ts',
    timeout: 600000,
    maxWorkers: 1,
    runInBand: true,
    testNamePattern: 'stress|concurrent|load'
  },
  analytics: {
    description: 'User journey analytics and behavior testing',
    testPattern: 'tests/e2e/automated-simulation-real.test.ts',
    timeout: 300000,
    maxWorkers: 1,
    runInBand: true,
    testNamePattern: 'analytics|behavior|journey'
  },
  smoke: {
    description: 'Smoke testing for critical user paths',
    testPattern: 'tests/e2e/user-journey-real.test.ts',
    timeout: 90000,
    maxWorkers: 1,
    runInBand: true,
    testNamePattern: 'complete.*booking.*journey'
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'quick';
const config = E2E_CONFIGS[testType];

if (!config) {
  console.error(`❌ Unknown test type: ${testType}`);
  console.log(`Available test types: ${Object.keys(E2E_CONFIGS).join(', ')}`);
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

// Add test name pattern if specified
if (config.testNamePattern) {
  jestArgs.push('--testNamePattern=' + config.testNamePattern);
}

// Add test pattern at the end
jestArgs.push(config.testPattern);

// Add coverage if requested
if (args.includes('--coverage')) {
  jestArgs.push('--coverage');
  jestArgs.push('--coverageDirectory', 'coverage/e2e');
}

// Add watch mode if requested
if (args.includes('--watch')) {
  jestArgs.push('--watch');
}

// Add bail option for quick failure detection
if (args.includes('--bail')) {
  jestArgs.push('--bail');
}

// Add specific test filter if provided
const testFilter = args.find(arg => arg.startsWith('--testNamePattern='));
if (testFilter && !config.testNamePattern) {
  jestArgs.push(testFilter);
}

// Set environment variables for E2E testing
process.env.NODE_ENV = 'test';
process.env.E2E_TEST = 'true';
process.env.REAL_DATABASE = 'true';

// Add performance monitoring
if (testType === 'stress' || testType === 'comprehensive') {
  process.env.PERFORMANCE_MONITORING = 'true';
}

// Add user simulation flags
if (testType === 'simulation' || testType === 'analytics') {
  process.env.USER_SIMULATION = 'true';
  process.env.REALISTIC_TIMING = 'true';
}

console.log(`🔧 Jest command: npx jest ${jestArgs.join(' ')}`);
console.log('');

// Pre-test validation
console.log('🔍 Pre-test validation...');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required Supabase environment variables');
  console.log('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

console.log('✅ Environment validation passed');
console.log('');

// Run Jest with E2E configuration
const jest = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    E2E_TEST: 'true',
    REAL_DATABASE: 'true'
  }
});

jest.on('close', (code) => {
  if (code === 0) {
    console.log('');
    console.log('✅ E2E tests completed successfully!');
    
    // E2E test summary
    console.log(`📊 E2E Test Summary:`);
    console.log(`   Test type: ${testType}`);
    console.log(`   Configuration: ${config.description}`);
    console.log(`   Pattern: ${config.testPattern}`);
    console.log(`   Duration: ${config.timeout}ms timeout`);
    
    if (config.testNamePattern) {
      console.log(`   Filter: ${config.testNamePattern}`);
    }
    
    if (args.includes('--coverage')) {
      console.log(`   Coverage report: coverage/e2e/`);
    }

    // Performance recommendations
    if (testType === 'stress' || testType === 'comprehensive') {
      console.log('');
      console.log('💡 Performance Recommendations:');
      console.log('   - Review test output for any performance bottlenecks');
      console.log('   - Check database connection pool usage');
      console.log('   - Monitor memory usage during concurrent user simulation');
    }

    // User simulation insights
    if (testType === 'simulation' || testType === 'analytics') {
      console.log('');
      console.log('📈 User Simulation Insights:');
      console.log('   - Review conversion rates by user type');
      console.log('   - Analyze average session durations');
      console.log('   - Check for any user behavior anomalies');
    }
  } else {
    console.error(`❌ E2E tests failed with exit code ${code}`);
    
    // Failure analysis
    console.log('');
    console.log('🔍 Failure Analysis:');
    console.log('   - Check database connectivity and permissions');
    console.log('   - Verify all required environment variables are set');
    console.log('   - Review test logs for specific error messages');
    console.log('   - Ensure test data cleanup completed properly');
    
    if (testType === 'stress' || testType === 'comprehensive') {
      console.log('   - Consider reducing concurrent user count for debugging');
      console.log('   - Check system resource availability (CPU, memory, connections)');
    }
    
    process.exit(code);
  }
});

jest.on('error', (error) => {
  console.error(`❌ Failed to start E2E tests: ${error.message}`);
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('   - Ensure Jest is installed: npm install --save-dev jest');
  console.log('   - Check Node.js version compatibility');
  console.log('   - Verify project dependencies are installed');
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 E2E tests interrupted by user');
  console.log('🧹 Cleaning up test data...');
  jest.kill('SIGINT');
  
  // Give some time for cleanup
  setTimeout(() => {
    process.exit(130);
  }, 5000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 E2E tests terminated');
  console.log('🧹 Cleaning up test data...');
  jest.kill('SIGTERM');
  
  // Give some time for cleanup
  setTimeout(() => {
    process.exit(143);
  }, 5000);
});

// Cleanup handler for unexpected exits
process.on('exit', (code) => {
  if (code !== 0) {
    console.log('\n🧹 Performing emergency cleanup...');
    // Note: Synchronous cleanup only in exit handler
  }
});

