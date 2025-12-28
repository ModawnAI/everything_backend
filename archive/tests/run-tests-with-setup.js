#!/usr/bin/env node

/**
 * Test Runner with Setup
 * 
 * This script ensures the test environment is properly set up before running tests.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Running tests with comprehensive setup...');

try {
  // Load test environment
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });
  
  // Run the tests
  const args = process.argv.slice(2);
  let testCommand;
  
  if (args.length === 0) {
    testCommand = 'npm test';
  } else if (args[0].startsWith('tests/')) {
    // Handle directory arguments
    testCommand = `npx jest ${args.join(' ')}`;
  } else {
    // Handle Jest arguments
    testCommand = `npx jest ${args.join(' ')}`;
  }
  
  execSync(testCommand, { 
    stdio: 'inherit', 
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });
  
  console.log('✅ Tests completed successfully');
} catch (error) {
  console.error('❌ Tests failed:', error.message);
  process.exit(1);
}
