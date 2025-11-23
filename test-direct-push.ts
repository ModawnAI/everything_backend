/**
 * Direct test of NotificationService
 * Bypasses HTTP layer to test Firebase messaging directly
 */

import { NotificationService } from './src/services/notification.service';
import { logger } from './src/utils/logger';

const TEST_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';

async function testDirectPush() {
  console.log('🔍 Testing Firebase Push Notification Service directly...\n');

  try {
    // Initialize notification service
    const notificationService = new NotificationService();

    console.log('✅ NotificationService initialized\n');

    // Test 1: Check user's FCM tokens
    console.log('1️⃣ Checking user FCM tokens...');
    const tokens = await notificationService.getUserDeviceTokens(TEST_USER_ID);
    console.log(`Found ${tokens.length} active tokens for user:`, JSON.stringify(tokens, null, 2));

    if (tokens.length === 0) {
      console.error('❌ No active tokens found! Cannot send notification.');
      process.exit(1);
    }

    // Test 2: Send notification
    console.log('\n2️⃣ Sending test notification...');
    const payload = {
      title: '🧪 Direct Service Test',
      body: `Direct test at ${new Date().toLocaleTimeString('ko-KR')}. If you see this, Firebase is working!`,
      data: {
        type: 'direct_test',
        timestamp: new Date().toISOString(),
        test_id: `direct_${Date.now()}`
      }
    };

    const history = await notificationService.sendNotificationToUser(TEST_USER_ID, payload);

    console.log('\n✅ Notification sent successfully!');
    console.log('History:', JSON.stringify(history, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

console.log('='.repeat(60));
console.log('Direct Firebase Push Notification Test');
console.log('='.repeat(60));

testDirectPush()
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully');
    console.log('='.repeat(60));
    process.exit(0);
  })
  .catch(error => {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Test failed:', error);
    console.error('='.repeat(60));
    process.exit(1);
  });
