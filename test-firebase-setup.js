#!/usr/bin/env node

/**
 * Test Firebase Admin SDK Setup
 * This script verifies that Firebase Admin SDK can be initialized with the service account file
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔥 Firebase Admin SDK Setup Test\n');

// Display environment configuration
console.log('📋 Environment Configuration:');
console.log(`   FIREBASE_AUTH_METHOD: ${process.env.FIREBASE_AUTH_METHOD}`);
console.log(`   FIREBASE_ADMIN_SDK_PATH: ${process.env.FIREBASE_ADMIN_SDK_PATH}`);
console.log(`   FCM_PROJECT_ID: ${process.env.FCM_PROJECT_ID}\n`);

try {
  // Check if service account file exists
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_PATH || './e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json';
  const fullPath = path.resolve(serviceAccountPath);
  
  console.log(`📂 Checking service account file:`);
  console.log(`   Path: ${fullPath}`);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Service account file not found at: ${fullPath}`);
  }
  
  console.log(`   ✅ File exists\n`);
  
  // Load and validate service account
  const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  
  console.log('🔑 Service Account Details:');
  console.log(`   Type: ${serviceAccount.type}`);
  console.log(`   Project ID: ${serviceAccount.project_id}`);
  console.log(`   Client Email: ${serviceAccount.client_email}`);
  console.log(`   Private Key: ${serviceAccount.private_key ? '✅ Present' : '❌ Missing'}\n`);
  
  // Initialize Firebase Admin SDK
  console.log('🚀 Initializing Firebase Admin SDK...');
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    console.log('✅ Firebase Admin SDK initialized successfully!\n');
  } else {
    console.log('ℹ️  Firebase Admin SDK already initialized\n');
  }
  
  // Test FCM messaging
  console.log('📬 Testing FCM Messaging Service...');
  const messaging = admin.messaging();
  console.log('✅ FCM Messaging service is available\n');
  
  // Verify app configuration
  const app = admin.app();
  console.log('📱 App Configuration:');
  console.log(`   Name: ${app.name}`);
  console.log(`   Project ID: ${app.options.projectId || 'Not set'}\n`);
  
  console.log('🎉 All checks passed!');
  console.log('\n✨ Firebase Admin SDK is properly configured and ready to send push notifications.\n');
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ Error during Firebase setup:');
  console.error(`   Message: ${error.message}`);
  if (error.stack) {
    console.error(`\n   Stack trace:`);
    console.error(error.stack);
  }
  
  console.error('\n💡 Troubleshooting:');
  console.error('   1. Verify FIREBASE_ADMIN_SDK_PATH in .env points to the correct file');
  console.error('   2. Ensure the service account JSON file has valid credentials');
  console.error('   3. Check that the file has proper read permissions');
  console.error('   4. Verify the Firebase project ID matches your project\n');
  
  process.exit(1);
}
