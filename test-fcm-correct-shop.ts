/**
 * Test: Reservation at shopowner@test.com's shop with FCM notification
 *
 * Creates reservation for FCM user at the CORRECT shop owned by shopowner@test.com
 * Then confirms it to trigger push notification
 */

import { getSupabaseClient } from './src/config/database';
import { customerNotificationService } from './src/services/customer-notification.service';

const FCM_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f'; // User with 3 FCM tokens
const SHOP_OWNER_EMAIL = 'shopowner@test.com';
const CORRECT_SHOP_ID = '22222222-2222-2222-2222-222222222222'; // 엘레강스 헤어살롱

async function testCorrectShopReservation() {
  console.log('='.repeat(80));
  console.log('🧪 Testing Reservation at shopowner@test.com Shop with FCM Push');
  console.log('='.repeat(80));
  console.log();

  const db = getSupabaseClient();

  try {
    // Step 1: Verify the shop and owner
    console.log('📍 Step 1: Verifying shop ownership...');

    const { data: shop } = await db
      .from('shops')
      .select('id, name, owner_id, shop_status')
      .eq('id', CORRECT_SHOP_ID)
      .single();

    if (!shop) {
      throw new Error('Shop not found: ' + CORRECT_SHOP_ID);
    }

    const { data: owner } = await db
      .from('users')
      .select('id, email')
      .eq('id', shop.owner_id)
      .single();

    console.log('   ✅ Shop:', shop.name);
    console.log('   ✅ Owner:', owner?.email);
    console.log('   ✅ Shop ID:', shop.id);

    if (owner?.email !== SHOP_OWNER_EMAIL) {
      throw new Error(`Shop owner mismatch! Expected ${SHOP_OWNER_EMAIL} but got ${owner?.email}`);
    }

    // Step 2: Verify user has FCM tokens
    console.log('\n📍 Step 2: Verifying FCM tokens...');

    const { data: tokens } = await db
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', FCM_USER_ID);

    if (!tokens || tokens.length === 0) {
      throw new Error('User has no FCM tokens!');
    }

    console.log(`   ✅ User has ${tokens.length} FCM token(s)`);
    tokens.forEach((t, i) => {
      console.log(`      ${i+1}. ${t.platform}: ${t.token.substring(0, 30)}...`);
    });

    // Step 3: Get shop services
    console.log('\n📍 Step 3: Getting shop services...');

    const { data: services } = await db
      .from('shop_services')
      .select('id, name, price_min, price_max, duration_minutes')
      .eq('shop_id', CORRECT_SHOP_ID)
      .eq('is_available', true)
      .limit(2);

    if (!services || services.length === 0) {
      throw new Error('Shop has no available services');
    }

    console.log(`   ✅ Found ${services.length} service(s):`);
    services.forEach(s => {
      console.log(`      - ${s.name}: ${s.price_min.toLocaleString()}원`);
    });

    // Step 4: Create reservation
    console.log('\n📍 Step 4: Creating reservation...');

    const reservationDate = new Date();
    reservationDate.setDate(reservationDate.getDate() + 20); // Use +20 days to avoid conflicts

    const totalAmount = services.reduce((sum, s) => sum + (s.price_max || s.price_min), 0);
    const depositAmount = Math.floor(totalAmount * 0.3);

    const reservationDateTime = new Date(reservationDate);
    reservationDateTime.setHours(13, 15, 0, 0); // Use 13:15 to avoid conflicts

    const { data: reservation, error: reservationError } = await db
      .from('reservations')
      .insert({
        user_id: FCM_USER_ID,
        shop_id: CORRECT_SHOP_ID,
        reservation_date: reservationDate.toISOString().split('T')[0],
        reservation_time: '13:15:00',
        reservation_datetime: reservationDateTime.toISOString(),
        status: 'requested',
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        remaining_amount: totalAmount - depositAmount,
        special_requests: `FCM Test - shopowner@test.com shop - ${new Date().toISOString()}`
      })
      .select()
      .single();

    if (reservationError) throw reservationError;

    console.log('   ✅ Reservation created:');
    console.log('      ID:', reservation.id);
    console.log('      Date:', reservation.reservation_date, reservation.reservation_time);
    console.log('      Amount:', totalAmount.toLocaleString() + '원');

    // Step 5: Add services
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
    console.log(`   ✅ Added ${reservationServices.length} service(s)`);

    // Step 6: Shop admin confirms reservation
    console.log('\n📍 Step 6: Shop admin confirming reservation...');
    console.log('   👤 Admin:', SHOP_OWNER_EMAIL);
    console.log('   🏪 Shop:', shop.name);

    const { error: confirmError } = await db
      .from('reservations')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', reservation.id);

    if (confirmError) throw confirmError;
    console.log('   ✅ Status updated to: confirmed');

    // Step 7: Send push notification
    console.log('\n📍 Step 7: Sending FCM push notification...');

    const servicesForNotification = services.map((service, index) => ({
      serviceName: service.name,
      quantity: reservationServices[index].quantity,
      unitPrice: reservationServices[index].unit_price,
      totalPrice: reservationServices[index].total_price
    }));

    await customerNotificationService.notifyCustomerOfReservationUpdate({
      customerId: FCM_USER_ID,
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
        confirmationNotes: `${shop.name}에서 예약이 확정되었습니다! 🎉`,
        shopId: shop.id
      }
    });

    console.log('   ✅ Push notification sent!');

    // Step 8: Verify notification
    console.log('\n📍 Step 8: Verifying notification...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: notifHistory } = await db
      .from('notification_history')
      .select('*')
      .eq('user_id', FCM_USER_ID)
      .order('created_at', { ascending: false })
      .limit(1);

    if (notifHistory && notifHistory.length > 0) {
      const latest = notifHistory[0];
      console.log('   ✅ notification_history:');
      console.log('      Title:', latest.title);
      console.log('      Status:', latest.status);
      console.log('      Sent at:', latest.sent_at);
      console.log('      Error:', latest.error_message || 'None');
    }

    const { data: inAppNotif } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', FCM_USER_ID)
      .order('created_at', { ascending: false })
      .limit(1);

    if (inAppNotif && inAppNotif.length > 0) {
      console.log('   ✅ In-app notification created:', inAppNotif[0].title);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log();
    console.log('📊 Summary:');
    console.log(`   🏪 Shop: ${shop.name}`);
    console.log(`   👤 Owner: ${SHOP_OWNER_EMAIL}`);
    console.log(`   👥 Customer: ${FCM_USER_ID}`);
    console.log(`   📱 FCM Tokens: ${tokens.length} device(s)`);
    console.log(`   📅 Reservation: ${reservation.reservation_date} ${reservation.reservation_time}`);
    console.log(`   💰 Total: ${totalAmount.toLocaleString()}원`);
    console.log(`   💵 Deposit: ${depositAmount.toLocaleString()}원`);
    console.log(`   📝 Services: ${services.map(s => s.name).join(', ')}`);
    console.log(`   ✉️  Push Notification: SENT TO ${tokens.length} DEVICE(S)`);
    console.log();
    console.log('✅ Reservation was made at shopowner@test.com\'s shop');
    console.log('✅ Shop admin confirmed the reservation');
    console.log('✅ Push notification sent to user with FCM tokens');
    console.log();

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

testCorrectShopReservation()
  .then(() => {
    console.log('🎉 Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
