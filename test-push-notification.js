/**
 * Push Notification Test Script
 *
 * This script tests sending a push notification via Firebase FCM.
 * Note: You need a valid FCM token from a mobile device to actually deliver the notification.
 */

require('dotenv').config();
const admin = require('firebase-admin');

console.log('\n📱 Push Notification Test\n');

// Test FCM token (this is a dummy token - replace with real token from mobile app)
const TEST_FCM_TOKEN = process.argv[2] || 'DUMMY_TOKEN_FOR_TESTING';

console.log('Configuration:');
console.log('  FCM_PROJECT_ID:', process.env.FCM_PROJECT_ID);
console.log('  Test Token:', TEST_FCM_TOKEN.substring(0, 20) + '...');
console.log('\n');

async function testPushNotification() {
  try {
    // Initialize Firebase Admin SDK
    console.log('🔥 Initializing Firebase Admin SDK...');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FCM_PROJECT_ID || 'e-beautything'
      });
    }

    console.log('✅ Firebase initialized\n');

    // Prepare test notification
    const message = {
      notification: {
        title: '🎉 Test Notification',
        body: 'This is a test push notification from 에뷰리띵 Backend!',
      },
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        source: 'backend-test-script'
      },
      token: TEST_FCM_TOKEN
    };

    console.log('📨 Preparing to send notification:');
    console.log('   Title:', message.notification.title);
    console.log('   Body:', message.notification.body);
    console.log('   Token:', TEST_FCM_TOKEN === 'DUMMY_TOKEN_FOR_TESTING' ? 'DUMMY (will fail)' : 'Real token');
    console.log('\n');

    if (TEST_FCM_TOKEN === 'DUMMY_TOKEN_FOR_TESTING') {
      console.log('⚠️  WARNING: Using dummy token. This test will fail at the send stage.');
      console.log('             To test with a real device, run:');
      console.log('             node test-push-notification.js YOUR_ACTUAL_FCM_TOKEN\n');
      console.log('📋 How to get a real FCM token:');
      console.log('   1. Install your mobile app on a device');
      console.log('   2. App requests notification permission');
      console.log('   3. App calls Firebase.getToken() to get FCM token');
      console.log('   4. App registers token with backend: POST /api/notifications/register');
      console.log('   5. Use that token for testing\n');
    }

    // Attempt to send
    console.log('🚀 Attempting to send notification...\n');

    const messaging = admin.messaging();
    const response = await messaging.send(message);

    console.log('✅ SUCCESS! Notification sent!\n');
    console.log('Response:');
    console.log('  Message ID:', response);
    console.log('\n🎊 Push notification system is fully operational!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Failed to send notification\n');
    console.error('Error:', error.message);

    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('\n📝 This error is EXPECTED when using a dummy token.');
      console.log('   Firebase connection is working! ✅');
      console.log('   The error just means the token is not valid.\n');
      console.log('To test with a real device:');
      console.log('  1. Get FCM token from mobile app');
      console.log('  2. Run: node test-push-notification.js <YOUR_ACTUAL_TOKEN>\n');
    } else if (error.code === 'auth/invalid-credential') {
      console.log('\n📝 Authentication Error:');
      console.log('   Application Default Credentials failed.');
      console.log('   See FIREBASE_AUTH_WORKAROUND.md for solutions.\n');
    } else {
      console.log('\n📝 Error details:');
      console.log('  Code:', error.code);
      console.log('  Message:', error.message);
      console.log('\n');
    }

    // Exit with 0 if it's just an invalid token error (means Firebase works)
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('✅ Firebase Cloud Messaging is working correctly!\n');
      process.exit(0);
    }

    process.exit(1);
  }
}

// Run the test
testPushNotification();
