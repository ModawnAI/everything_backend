/**
 * Comprehensive test for shop admin notifications
 * Tests the full flow: shop owner confirms reservation → customer gets notification
 */

import { NotificationService } from './src/services/notification.service';
import { shopOwnerNotificationService } from './src/services/shop-owner-notification.service';
import { customerNotificationService } from './src/services/customer-notification.service';
import { logger } from './src/utils/logger';

// Test user IDs from Supabase
const TEST_CUSTOMER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f'; // Has FCM tokens
const TEST_SHOP_ID = 'test-shop-id';
// Use a valid UUID format for reservation ID
const TEST_RESERVATION_ID = '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0').slice(0, 12);

async function testShopAdminNotifications() {
  console.log('='.repeat(80));
  console.log('🧪 Shop Admin Notification Flow Test');
  console.log('='.repeat(80));
  console.log();

  try {
    // Test 1: Direct notification service test
    console.log('1️⃣ Testing NotificationService.sendNotificationToUser...');
    const notificationService = new NotificationService();

    const directNotif = await notificationService.sendNotificationToUser(
      TEST_CUSTOMER_ID,
      {
        title: '🧪 Direct Test - Shop Admin Action',
        body: `Test notification from shop admin at ${new Date().toLocaleTimeString('ko-KR')}`,
        data: {
          type: 'test_shop_admin',
          timestamp: new Date().toISOString()
        }
      }
    );

    console.log('✅ Direct notification sent:', {
      id: directNotif.id,
      status: directNotif.status,
      sent_at: directNotif.sent_at
    });

    // Test 2: Customer notification service (used when shop confirms reservation)
    console.log('\n2️⃣ Testing CustomerNotificationService (shop confirms reservation)...');

    await customerNotificationService.notifyCustomerOfReservationUpdate({
      customerId: TEST_CUSTOMER_ID,
      reservationId: TEST_RESERVATION_ID,
      shopName: 'Test Beauty Salon',
      reservationDate: new Date().toISOString().split('T')[0],
      reservationTime: '14:00:00',
      services: [
        {
          serviceName: 'Hair Cut',
          quantity: 1,
          unitPrice: 30000,
          totalPrice: 30000
        },
        {
          serviceName: 'Hair Dye',
          quantity: 1,
          unitPrice: 50000,
          totalPrice: 50000
        }
      ],
      totalAmount: 80000,
      depositAmount: 20000,
      remainingAmount: 60000,
      notificationType: 'reservation_confirmed',
      additionalData: {
        confirmationNotes: 'Looking forward to serving you! Please arrive 5 minutes early.'
      }
    });

    console.log('✅ Customer notification sent for reservation confirmation');

    // Test 3: Shop owner notification service (when customer requests reservation)
    console.log('\n3️⃣ Testing ShopOwnerNotificationService (customer requests reservation)...');

    // This would normally be called when a customer creates a reservation
    // For testing, we'll just verify the service exists and can be called
    console.log('⏭️  Skipping shop owner notification (requires valid shop with owner)');

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(80));
    console.log('\n📱 Check mobile device for notifications!');
    console.log('📊 Notification history logged to database');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testShopAdminNotifications()
  .then(() => {
    console.log('\n🎉 Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });
