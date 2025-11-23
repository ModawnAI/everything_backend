/**
 * Test shop admin confirming reservation - sends notification with APNs headers
 * This simulates what happens when shop admin confirms a reservation via API
 */

import { customerNotificationService } from './src/services/customer-notification.service';
import { logger } from './src/utils/logger';

const TEST_CUSTOMER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';
const TEST_RESERVATION_ID = 'e149a0a6-5655-423f-9c76-84b6bd22af83';

async function testShopConfirmNotification() {
  console.log('='.repeat(80));
  console.log('🏪 Testing Shop Admin Reservation Confirmation Notification');
  console.log('='.repeat(80));
  console.log();
  console.log('Customer ID:', TEST_CUSTOMER_ID);
  console.log('Reservation ID:', TEST_RESERVATION_ID);
  console.log();
  console.log('This will:');
  console.log('  ✅ Send notification via CustomerNotificationService');
  console.log('  ✅ Use updated NotificationService with APNs headers');
  console.log('  ✅ Include priority: 10, push-type: alert');
  console.log('  ✅ Log to notification_history table');
  console.log('  ✅ Log to notifications table (for in-app inbox)');
  console.log();

  try {
    await customerNotificationService.notifyCustomerOfReservationUpdate({
      customerId: TEST_CUSTOMER_ID,
      reservationId: TEST_RESERVATION_ID,
      shopName: '엘레강스 헤어살롱',
      reservationDate: '2025-11-25',
      reservationTime: '15:00:00',
      services: [
        {
          serviceName: '프리미엄 헤어컷',
          quantity: 1,
          unitPrice: 35000,
          totalPrice: 35000
        }
      ],
      totalAmount: 35000,
      depositAmount: 10000,
      remainingAmount: 25000,
      notificationType: 'reservation_confirmed',
      additionalData: {
        confirmationNotes: '예약이 확정되었습니다! 기대하고 있겠습니다.'
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ NOTIFICATION SENT SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log();
    console.log('📱 Check your iOS device NOW!');
    console.log('💡 Pull down notification center');
    console.log('💡 Look for notification from "엘레강스 헤어살롱"');
    console.log();
    console.log('📊 Check database:');
    console.log('   notification_history - FCM delivery log');
    console.log('   notifications - In-app notification inbox');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testShopConfirmNotification()
  .then(() => {
    console.log('\n🎉 Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });
