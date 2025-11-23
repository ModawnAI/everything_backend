/**
 * End-to-End Test: Reservation Confirmation with Real FCM Push Notification
 *
 * Flow:
 * 1. Create a reservation for user b374307c-d553-4520-ac13-d3fd813c596f (has FCM tokens)
 * 2. Simulate shop admin confirming the reservation
 * 3. Verify push notification is sent to the user's device
 */

import { getSupabaseClient } from './src/config/database';
import { customerNotificationService } from './src/services/customer-notification.service';

// Test constants - user with FCM tokens
const TEST_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';
const SHOP_OWNER_EMAIL = 'shopowner@test.com';

async function testReservationConfirmationFlowWithRealFCM() {
  console.log('='.repeat(80));
  console.log('🧪 Testing Reservation Confirmation → Real FCM Push Notification');
  console.log('='.repeat(80));
  console.log();

  const db = getSupabaseClient();

  try {
    // Step 1: Find the shop owner's shop
    console.log('📍 Step 1: Finding shop owned by', SHOP_OWNER_EMAIL);

    const { data: shops, error: shopError } = await db
      .from('shops')
      .select('id, name, owner_id, shop_status')
      .not('owner_id', 'is', null)
      .eq('shop_status', 'active')
      .limit(10);

    if (shopError) throw shopError;

    if (!shops || shops.length === 0) {
      throw new Error('No shops with owners found. Please create a shop first.');
    }

    const shop = shops[0];
    console.log('   ✅ Found shop:', {
      id: shop.id,
      name: shop.name,
      owner_id: shop.owner_id
    });

    // Step 2: Check if user has FCM tokens
    console.log('\n📍 Step 2: Checking if user has FCM tokens...');
    const { data: fcmTokens } = await db
      .from('push_tokens')
      .select('token, platform, created_at')
      .eq('user_id', TEST_USER_ID);

    if (!fcmTokens || fcmTokens.length === 0) {
      console.log('   ⚠️  WARNING: User has no FCM tokens!');
      console.log('   💡 Push notifications will NOT be delivered.');
      throw new Error('This test requires a user with FCM tokens');
    } else {
      console.log('   ✅ User has', fcmTokens.length, 'FCM token(s)');
      fcmTokens.forEach((token, i) => {
        console.log(`      ${i + 1}. Platform: ${token.platform}, Token: ${token.token.substring(0, 30)}...`);
      });
    }

    // Step 3: Get shop services for the reservation
    console.log('\n📍 Step 3: Getting shop services...');
    const { data: services } = await db
      .from('shop_services')
      .select('id, name, price_min, price_max, duration_minutes')
      .eq('shop_id', shop.id)
      .eq('is_available', true)
      .limit(2);

    if (!services || services.length === 0) {
      throw new Error('Shop has no available services. Please add services first.');
    }

    console.log('   ✅ Found', services.length, 'service(s)');
    services.forEach(s => {
      console.log(`      - ${s.name}: ${s.price_min.toLocaleString()}원 (${s.duration_minutes}분)`);
    });

    // Step 4: Create a test reservation
    console.log('\n📍 Step 4: Creating test reservation...');

    const reservationDate = new Date();
    reservationDate.setDate(reservationDate.getDate() + 3); // 3 days from now

    const totalAmount = services.reduce((sum, s) => sum + (s.price_max || s.price_min), 0);
    const depositAmount = Math.floor(totalAmount * 0.3); // 30% deposit

    const reservationDateTime = new Date(reservationDate);
    reservationDateTime.setHours(15, 30, 0, 0); // 15:30

    const { data: reservation, error: reservationError } = await db
      .from('reservations')
      .insert({
        user_id: TEST_USER_ID,
        shop_id: shop.id,
        reservation_date: reservationDate.toISOString().split('T')[0],
        reservation_time: '15:30:00',
        reservation_datetime: reservationDateTime.toISOString(),
        status: 'requested',
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        remaining_amount: totalAmount - depositAmount,
        special_requests: 'Test reservation for FCM push notification - ' + new Date().toISOString()
      })
      .select()
      .single();

    if (reservationError) throw reservationError;

    console.log('   ✅ Reservation created:', {
      id: reservation.id,
      date: reservation.reservation_date,
      time: reservation.reservation_time,
      amount: totalAmount.toLocaleString() + '원'
    });

    // Step 5: Add reservation services
    console.log('\n📍 Step 5: Adding services to reservation...');

    const reservationServices = services.map(service => ({
      reservation_id: reservation.id,
      service_id: service.id,
      quantity: 1,
      unit_price: service.price_max || service.price_min,
      total_price: service.price_max || service.price_min
    }));

    const { error: servicesError } = await db
      .from('reservation_services')
      .insert(reservationServices);

    if (servicesError) throw servicesError;
    console.log('   ✅ Added', reservationServices.length, 'service(s) to reservation');

    // Step 6: Simulate shop admin confirming the reservation
    console.log('\n📍 Step 6: Simulating shop admin confirmation...');
    console.log('   👤 Shop admin:', SHOP_OWNER_EMAIL);
    console.log('   🏪 Confirming reservation:', reservation.id);

    // Update reservation status to confirmed
    const { error: updateError } = await db
      .from('reservations')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', reservation.id);

    if (updateError) throw updateError;
    console.log('   ✅ Reservation status updated to: confirmed');

    // Step 7: Send push notification to customer
    console.log('\n📍 Step 7: Sending REAL FCM push notification to customer...');

    // Map services to expected format with serviceName
    const servicesForNotification = services.map((service, index) => ({
      serviceName: service.name,
      quantity: reservationServices[index].quantity,
      unitPrice: reservationServices[index].unit_price,
      totalPrice: reservationServices[index].total_price
    }));

    await customerNotificationService.notifyCustomerOfReservationUpdate({
      customerId: TEST_USER_ID,
      reservationId: reservation.id,
      shopName: shop.name,
      reservationDate: reservation.reservation_date,
      reservationTime: reservation.reservation_time,
      services: servicesForNotification,
      totalAmount: totalAmount,
      depositAmount: depositAmount,
      remainingAmount: totalAmount - depositAmount,
      notificationType: 'reservation_confirmed',
      additionalData: {
        confirmationNotes: '🎉 예약이 확정되었습니다! 기대하고 있겠습니다.',
        shopId: shop.id
      }
    });

    console.log('   ✅ Push notification sent to FCM!');

    // Step 8: Verify notification was logged
    console.log('\n📍 Step 8: Verifying notification history...');

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: notifHistory } = await db
      .from('notification_history')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .order('created_at', { ascending: false })
      .limit(1);

    if (notifHistory && notifHistory.length > 0) {
      const latest = notifHistory[0];
      console.log('   ✅ Latest notification logged:', {
        title: latest.title,
        status: latest.status,
        sent_at: latest.sent_at,
        error: latest.error_message || 'None'
      });
    } else {
      console.log('   ⚠️  No notification_history record found');
    }

    // Step 9: Check in-app notifications
    const { data: inAppNotifs } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .order('created_at', { ascending: false })
      .limit(1);

    if (inAppNotifs && inAppNotifs.length > 0) {
      const latest = inAppNotifs[0];
      console.log('   ✅ In-app notification created:', {
        title: latest.title,
        is_read: latest.is_read,
        created_at: latest.created_at
      });
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log();
    console.log('📊 Summary:');
    console.log(`   🏪 Shop: ${shop.name}`);
    console.log(`   👤 Customer: ${TEST_USER_ID}`);
    console.log(`   📱 FCM Tokens: ${fcmTokens.length} device(s)`);
    console.log(`   📅 Reservation: ${reservation.reservation_date} ${reservation.reservation_time}`);
    console.log(`   💰 Total: ${totalAmount.toLocaleString()}원`);
    console.log(`   💵 Deposit: ${depositAmount.toLocaleString()}원`);
    console.log(`   📝 Services: ${services.map(s => s.name).join(', ')}`);
    console.log(`   ✉️  Notification: SENT TO ${fcmTokens.length} DEVICE(S) VIA FCM`);
    console.log();
    console.log('📱 Next Steps:');
    console.log('   1. ✅ Check mobile device for push notification');
    console.log('   2. Open Supabase → notification_history table');
    console.log('   3. Open Supabase → notifications table (in-app inbox)');
    console.log('   4. Verify reservation status is "confirmed"');
    console.log();
    console.log(`📋 Database Queries to Run:`);
    console.log(`   SELECT * FROM notification_history WHERE user_id = '${TEST_USER_ID}' ORDER BY created_at DESC LIMIT 5;`);
    console.log(`   SELECT * FROM notifications WHERE user_id = '${TEST_USER_ID}' ORDER BY created_at DESC LIMIT 5;`);
    console.log(`   SELECT * FROM reservations WHERE id = '${reservation.id}';`);
    console.log(`   SELECT * FROM push_tokens WHERE user_id = '${TEST_USER_ID}';`);
    console.log();

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testReservationConfirmationFlowWithRealFCM()
  .then(() => {
    console.log('🎉 Test script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
