/**
 * Firebase Admin SDK Initialization Test
 *
 * This script tests if Firebase Admin SDK can initialize with the current configuration.
 */

require('dotenv').config();
const admin = require('firebase-admin');

console.log('\n🔥 Firebase Admin SDK Initialization Test\n');
console.log('Configuration:');
console.log('  FCM_PROJECT_ID:', process.env.FCM_PROJECT_ID);
console.log('  FIREBASE_AUTH_METHOD:', process.env.FIREBASE_AUTH_METHOD);
console.log('  FCM_SENDER_ID:', process.env.FCM_SENDER_ID);
console.log('\n');

try {
  // Initialize Firebase Admin SDK
  const initMethod = process.env.FIREBASE_AUTH_METHOD || 'application_default';

  console.log(`📋 Attempting to initialize with method: ${initMethod}\n`);

  if (initMethod === 'application_default') {
    console.log('🔑 Using Application Default Credentials...');

    const app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FCM_PROJECT_ID || 'e-beautything'
    });

    console.log('✅ Firebase Admin SDK initialized successfully!\n');
    console.log('App details:');
    console.log('  Name:', app.name);
    console.log('  Project ID:', process.env.FCM_PROJECT_ID);

    // Try to get FCM service
    const messaging = admin.messaging();
    console.log('\n✅ Firebase Cloud Messaging service is available!');

    console.log('\n🎉 SUCCESS! Firebase is ready to send push notifications.\n');
    console.log('Next steps:');
    console.log('  1. Mobile app needs to register FCM tokens');
    console.log('  2. Admin can send notifications via /api/admin/push/send');
    console.log('  3. Check logs/combined.log for detailed logs\n');

    process.exit(0);

  } else {
    console.error('❌ Invalid FIREBASE_AUTH_METHOD:', initMethod);
    console.log('\nSupported methods:');
    console.log('  - application_default (recommended)');
    console.log('  - service_account (requires firebase-admin-sdk.json)');
    console.log('  - refresh_token (requires FIREBASE_REFRESH_TOKEN)\n');
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Firebase Admin SDK initialization FAILED!\n');
  console.error('Error:', error.message);

  if (error.code === 'auth/invalid-credential') {
    console.log('\n📝 Troubleshooting:');
    console.log('  Application Default Credentials not found.');
    console.log('  This means Google Cloud authentication is not configured.\n');
    console.log('Solutions:');
    console.log('  1. Contact Firebase project administrator for credentials');
    console.log('  2. OR enable Legacy FCM API and use server key');
    console.log('  3. OR get service account JSON file from Firebase Console\n');
    console.log('See FIREBASE_AUTH_WORKAROUND.md for detailed solutions.\n');
  } else {
    console.log('\n📝 Error details:');
    console.log('  Code:', error.code);
    console.log('  Message:', error.message);
    if (error.stack) {
      console.log('\n  Stack trace:');
      console.log('  ' + error.stack.split('\n').slice(0, 5).join('\n  '));
    }
    console.log('\n');
  }

  process.exit(1);
}
