/**
 * Test iOS push notification with full APNs configuration
 * This uses iOS-specific settings to ensure notification appears
 */

import * as admin from 'firebase-admin';
import { getSupabaseClient } from './src/config/database';
import { logger } from './src/utils/logger';

const TEST_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';

async function testIOSPush() {
  console.log('📱 Testing iOS Push Notification with APNs Config\n');

  try {
    // Initialize Firebase Admin SDK
    const serviceAccountPath = './e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json';
    const serviceAccount = require(serviceAccountPath);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }

    console.log('✅ Firebase initialized\n');

    // Get FCM tokens
    const supabase = getSupabaseClient();
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('is_active', true);

    if (error || !tokens || tokens.length === 0) {
      console.error('❌ No FCM tokens found');
      process.exit(1);
    }

    console.log(`Found ${tokens.length} active token(s)\n`);

    // Test different notification formats
    const testCases = [
      {
        name: 'iOS with APNs alert',
        message: (token: string) => ({
          token,
          notification: {
            title: '🔔 Test from Backend',
            body: 'iOS APNs format test - ' + new Date().toLocaleTimeString('ko-KR')
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: '🔔 Test from Backend',
                  body: 'iOS APNs format test - ' + new Date().toLocaleTimeString('ko-KR')
                },
                sound: 'default',
                badge: 1,
                'content-available': 1
              }
            },
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert'
            }
          },
          data: {
            type: 'test_ios',
            timestamp: new Date().toISOString()
          }
        })
      },
      {
        name: 'iOS with mutable content',
        message: (token: string) => ({
          token,
          notification: {
            title: '💬 Shop Notification',
            body: 'Your reservation has been confirmed!'
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: '💬 Shop Notification',
                  body: 'Your reservation has been confirmed!'
                },
                sound: 'default',
                badge: 1,
                'mutable-content': 1,
                'content-available': 1
              }
            },
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert'
            }
          },
          data: {
            type: 'reservation_confirmed',
            reservationId: 'test-123',
            shopName: 'Test Beauty Salon'
          }
        })
      },
      {
        name: 'Data-only (silent)',
        message: (token: string) => ({
          token,
          data: {
            type: 'data_only',
            title: '📦 Data Message',
            body: 'Silent notification test',
            timestamp: new Date().toISOString()
          },
          apns: {
            payload: {
              aps: {
                'content-available': 1
              }
            },
            headers: {
              'apns-priority': '5',
              'apns-push-type': 'background'
            }
          }
        })
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n${i + 1}. Testing: ${testCase.name}`);
      console.log('─'.repeat(60));

      for (const token of tokens) {
        try {
          const message = testCase.message(token.token);
          const response = await admin.messaging().send(message);

          console.log(`✅ Sent to device ${token.id.substring(0, 8)}...`);
          console.log(`   FCM Message ID: ${response}`);
        } catch (error: any) {
          console.error(`❌ Failed to send:`, error.message);
          if (error.errorInfo) {
            console.error(`   Error code: ${error.errorInfo.code}`);
          }
        }
      }

      // Wait between test cases
      if (i < testCases.length - 1) {
        console.log('\n⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All test cases completed');
    console.log('='.repeat(60));
    console.log('\n📱 Check your iOS device for notifications!');
    console.log('💡 Tip: Pull down notification center to see all notifications');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testIOSPush()
  .then(() => {
    console.log('\n🎉 Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  });
