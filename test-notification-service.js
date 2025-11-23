#!/usr/bin/env node

/**
 * Test NotificationService initialization
 * Verifies the actual service class can initialize Firebase correctly
 */

require('dotenv').config();

console.log('🔥 Testing NotificationService Class\n');
console.log('📋 Environment:');
console.log(`   FIREBASE_AUTH_METHOD: ${process.env.FIREBASE_AUTH_METHOD}`);
console.log(`   FIREBASE_ADMIN_SDK_PATH: ${process.env.FIREBASE_ADMIN_SDK_PATH}`);
console.log(`   FCM_PROJECT_ID: ${process.env.FCM_PROJECT_ID}\n`);

try {
  // Import the actual NotificationService
  console.log('📦 Loading NotificationService...');
  
  // We need to use ts-node to load TypeScript files
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  // Create a test script that imports the service
  const testScript = `
require('dotenv').config();
const tsNode = require('ts-node');

// Register TypeScript compiler
tsNode.register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true
  }
});

async function test() {
  try {
    // Import NotificationService
    const { NotificationService } = require('./src/services/notification.service.ts');
    
    console.log('✅ NotificationService imported successfully');
    
    // Create instance (this will initialize Firebase in constructor)
    console.log('🚀 Creating NotificationService instance...');
    const service = new NotificationService();
    
    console.log('✅ NotificationService initialized successfully');
    console.log('✅ Firebase Admin SDK is working in the service\\n');
    
    console.log('🎉 All checks passed!');
    console.log('✨ NotificationService is ready to use\\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('\\nStack:', error.stack);
    }
    process.exit(1);
  }
}

test();
  `;
  
  // Save and run the test script
  const fs = require('fs');
  fs.writeFileSync('temp-service-test.js', testScript);
  
  console.log('🧪 Running NotificationService test...\n');
  
  execAsync('node temp-service-test.js')
    .then(({ stdout, stderr }) => {
      console.log(stdout);
      if (stderr) console.error('Stderr:', stderr);
      
      // Cleanup
      fs.unlinkSync('temp-service-test.js');
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error.message);
      
      // Cleanup
      try {
        fs.unlinkSync('temp-service-test.js');
      } catch (e) {}
      
      process.exit(1);
    });
  
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  if (error.stack) {
    console.error('\nStack:', error.stack);
  }
  process.exit(1);
}
