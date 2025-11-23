/**
 * Test notification via NotificationService with proper APNs configuration
 * This will log to notification_history and send with APNs headers
 */

import { NotificationService } from './src/services/notification.service';
import { logger } from './src/utils/logger';

const TEST_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';

async function testNotificationWithAPNs() {
  console.log('📱 Testing Notification via NotificationService with APNs Headers\n');

  try {
    const notificationService = new NotificationService();

    console.log('Sending notification to user:', TEST_USER_ID);
    console.log('This will:');
    console.log('  ✅ Log to notification_history table');
    console.log('  ✅ Send with APNs priority headers');
    console.log('  ✅ Include sound and badge');
    console.log('  ✅ Enable content-available\n');

    const result = await notificationService.sendNotificationToUser(
      TEST_USER_ID,
      {
        title: '🔔 APNs Test - ' + new Date().toLocaleTimeString('ko-KR'),
        body: 'Testing with proper APNs headers. This should appear on your iOS device!',
        data: {
          type: 'apns_test',
          timestamp: new Date().toISOString()
        }
      }
    );

    console.log('\n✅ Notification sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\n📱 Check your iOS device now!');
    console.log('💡 Pull down notification center to see all notifications');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testNotificationWithAPNs()
  .then(() => {
    console.log('\n🎉 Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  });
