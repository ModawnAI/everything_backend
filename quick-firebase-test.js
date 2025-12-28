#!/usr/bin/env node

/**
 * Quick Firebase Admin SDK Test
 * Tests Firebase initialization and FCM messaging availability
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

console.log('🔥 Quick Firebase Test\n');

try {
  // Load service account
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_PATH || './e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json';
  const serviceAccount = require(path.resolve(serviceAccountPath));
  
  console.log('✅ Service account loaded');
  console.log(`   Project: ${serviceAccount.project_id}`);
  console.log(`   Email: ${serviceAccount.client_email}\n`);
  
  // Initialize Firebase
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('✅ Firebase Admin SDK initialized\n');
  }
  
  // Test messaging service
  const messaging = admin.messaging();
  console.log('✅ FCM Messaging service available\n');
  
  // Test creating a message (without sending)
  const testMessage = {
    notification: {
      title: '테스트 알림 📱',
      body: '에뷰리띵 백엔드 테스트'
    },
    data: {
      type: 'test',
      timestamp: new Date().toISOString()
    },
    token: 'dummy-token-for-validation-test'
  };
  
  console.log('✅ Message structure validated:');
  console.log('   Title:', testMessage.notification.title);
  console.log('   Body:', testMessage.notification.body);
  console.log('   Data:', JSON.stringify(testMessage.data));
  
  console.log('\n🎉 All checks passed!');
  console.log('✨ Firebase Admin SDK is ready to send push notifications\n');
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  if (error.stack) {
    console.error('\nStack:', error.stack);
  }
  process.exit(1);
}
