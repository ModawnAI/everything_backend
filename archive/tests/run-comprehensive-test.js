#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');

/**
 * Run the comprehensive test with all dependencies
 */
async function runComprehensiveTest() {
  try {
    console.log('🎯 Starting comprehensive API test with dependencies...\n');
    
    // First, start all dependencies
    console.log('📋 Step 1: Starting dependencies...');
    const { startDependencies } = require('./start-dependencies');
    await startDependencies();
    
    // Wait a moment for everything to stabilize
    console.log('\n⏳ Waiting for services to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Now run the comprehensive test
    console.log('\n📋 Step 2: Running comprehensive test...');
    await runTest();
    
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error.message);
    process.exit(1);
  }
}

/**
 * Run the actual Jest test
 */
function runTest() {
  return new Promise((resolve, reject) => {
    console.log('🧪 Running comprehensive API test...\n');
    
    const testProcess = spawn('npm', ['run', 'test:comprehensive'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Comprehensive test completed successfully!');
        resolve();
      } else {
        console.log(`\n❌ Comprehensive test failed with exit code ${code}`);
        reject(new Error(`Test failed with exit code ${code}`));
      }
    });
    
    testProcess.on('error', (error) => {
      console.error('❌ Failed to run test:', error.message);
      reject(error);
    });
  });
}

// Run if called directly
if (require.main === module) {
  runComprehensiveTest();
}

module.exports = { runComprehensiveTest };
