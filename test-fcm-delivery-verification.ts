/**
 * FCM Delivery Verification Test
 *
 * Uses Firebase Admin SDK to:
 * 1. Send test notification directly to FCM tokens
 * 2. Verify delivery status and token validity
 * 3. Check for any errors or invalid tokens
 */

import * as admin from 'firebase-admin';
import { getSupabaseClient } from './src/config/database';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('./e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const FCM_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';

async function testFCMDelivery() {
  console.log('='.repeat(80));
  console.log('🧪 FCM Delivery Verification Test');
  console.log('='.repeat(80));
  console.log();

  const db = getSupabaseClient();

  try {
    // Step 1: Get FCM tokens for the user
    console.log('📍 Step 1: Fetching FCM tokens...');

    const { data: tokens, error } = await db
      .from('push_tokens')
      .select('token, platform, created_at')
      .eq('user_id', FCM_USER_ID);

    if (error) throw error;

    if (!tokens || tokens.length === 0) {
      throw new Error('No FCM tokens found for user');
    }

    console.log(`   ✅ Found ${tokens.length} FCM token(s):`);
    tokens.forEach((t, i) => {
      console.log(`      ${i + 1}. ${t.platform}: ${t.token.substring(0, 40)}...`);
      console.log(`         Created: ${t.created_at}`);
    });
    console.log();

    // Step 2: Create test notification payload
    console.log('📍 Step 2: Creating test notification payload...');

    const testPayload = {
      notification: {
        title: '🧪 FCM Delivery Test',
        body: 'This is a test notification to verify FCM delivery at ' + new Date().toLocaleTimeString('ko-KR')
      },
      data: {
        test: 'true',
        timestamp: new Date().toISOString(),
        type: 'fcm_delivery_test'
      }
    };

    console.log('   Test Payload:');
    console.log('   Title:', testPayload.notification.title);
    console.log('   Body:', testPayload.notification.body);
    console.log();

    // Step 3: Send to each token and collect results
    console.log('📍 Step 3: Sending test notifications to FCM...');
    console.log();

    const results: Array<{
      token: string;
      platform: string;
      success: boolean;
      messageId?: string;
      error?: string;
      errorCode?: string;
    }> = [];

    for (let i = 0; i < tokens.length; i++) {
      const tokenData = tokens[i];
      console.log(`   Testing token ${i + 1}/${tokens.length}...`);
      console.log(`   Platform: ${tokenData.platform}`);
      console.log(`   Token: ${tokenData.token.substring(0, 50)}...`);

      try {
        // Send message using Firebase Admin SDK
        const message: admin.messaging.Message = {
          ...testPayload,
          token: tokenData.token,
          // iOS specific configuration
          apns: {
            payload: {
              aps: {
                alert: {
                  title: testPayload.notification.title,
                  body: testPayload.notification.body
                },
                sound: 'default',
                badge: 1
              }
            }
          }
        };

        const messageId = await admin.messaging().send(message);

        console.log(`   ✅ SUCCESS - Message sent!`);
        console.log(`      Message ID: ${messageId}`);
        console.log();

        results.push({
          token: tokenData.token,
          platform: tokenData.platform,
          success: true,
          messageId: messageId
        });

      } catch (error: any) {
        console.log(`   ❌ FAILED - Could not send message`);
        console.log(`      Error: ${error.message}`);
        console.log(`      Error Code: ${error.code || 'N/A'}`);

        // Check for specific error codes
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          console.log(`      ⚠️  Token is INVALID or EXPIRED`);
        }
        console.log();

        results.push({
          token: tokenData.token,
          platform: tokenData.platform,
          success: false,
          error: error.message,
          errorCode: error.code
        });
      }
    }

    // Step 4: Summary
    console.log('='.repeat(80));
    console.log('📊 FCM Delivery Test Results');
    console.log('='.repeat(80));
    console.log();

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Total Tokens Tested: ${results.length}`);
    console.log(`✅ Successful Deliveries: ${successCount}`);
    console.log(`❌ Failed Deliveries: ${failCount}`);
    console.log();

    // Show detailed results
    console.log('Detailed Results:');
    console.log('-'.repeat(80));

    results.forEach((result, i) => {
      console.log(`\n${i + 1}. Token: ${result.token.substring(0, 40)}...`);
      console.log(`   Platform: ${result.platform}`);

      if (result.success) {
        console.log(`   Status: ✅ DELIVERED`);
        console.log(`   Message ID: ${result.messageId}`);
      } else {
        console.log(`   Status: ❌ FAILED`);
        console.log(`   Error: ${result.error}`);
        console.log(`   Error Code: ${result.errorCode}`);
      }
    });

    console.log();
    console.log('='.repeat(80));

    if (successCount > 0) {
      console.log('✅ FCM DELIVERY WORKING!');
      console.log(`   ${successCount} message(s) successfully sent to FCM`);
      console.log('   Check the mobile device(s) to confirm receipt');
      console.log();
      console.log('📱 What to check on the device:');
      console.log('   1. Device notification tray/center');
      console.log('   2. App should show notification even when app is closed');
      console.log('   3. Notification should appear with title and body');
      console.log();
    } else {
      console.log('❌ ALL FCM DELIVERIES FAILED');
      console.log('   All tokens appear to be invalid or expired');
      console.log('   User needs to reinstall app and register new tokens');
      console.log();
    }

    if (failCount > 0) {
      console.log('⚠️  Note on Failed Tokens:');
      console.log('   - Tokens may be from uninstalled apps');
      console.log('   - Tokens may be expired (typically after ~60 days)');
      console.log('   - User needs to log into app to register fresh tokens');
      console.log('   - Consider cleaning up invalid tokens from database');
      console.log();
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testFCMDelivery()
  .then(() => {
    console.log('🎉 FCM Delivery Test Completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
