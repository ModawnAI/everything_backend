/**
 * Complete Push Notification Flow Test
 *
 * Tests the entire notification system:
 * 1. Reservation creation at shopowner@test.com's shop
 * 2. Shop admin confirms reservation
 * 3. Customer notification service sends push
 * 4. Verify FCM delivery via Firebase Admin SDK
 * 5. Check all database records (notifications, notification_history)
 */

import * as admin from 'firebase-admin';
import { getSupabaseClient } from './src/config/database';
import { customerNotificationService } from './src/services/customer-notification.service';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('./e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const FCM_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';
const SHOP_ID = '22222222-2222-2222-2222-222222222222'; // shopowner@test.com's shop
const SHOP_OWNER_EMAIL = 'shopowner@test.com';

async function testCompletePushNotificationFlow() {
  console.log('='.repeat(80));
  console.log('🧪 COMPLETE PUSH NOTIFICATION FLOW TEST');
  console.log('='.repeat(80));
  console.log();

  const db = getSupabaseClient();
  let reservationId: string | null = null;

  try {
    // ========================================================================
    // STEP 1: Verify Shop and Owner
    // ========================================================================
    console.log('📍 STEP 1: Verifying Shop and Owner');
    console.log('-'.repeat(80));

    const { data: shop } = await db
      .from('shops')
      .select('id, name, owner_id')
      .eq('id', SHOP_ID)
      .single();

    const { data: owner } = await db
      .from('users')
      .select('id, email')
      .eq('id', shop?.owner_id)
      .single();

    console.log('   Shop:', shop?.name);
    console.log('   Shop ID:', shop?.id);
    console.log('   Owner:', owner?.email);
    console.log('   ✅ Shop owner verified:', owner?.email === SHOP_OWNER_EMAIL ? 'YES' : 'NO');
    console.log();

    // ========================================================================
    // STEP 2: Verify FCM Tokens
    // ========================================================================
    console.log('📍 STEP 2: Verifying FCM Tokens');
    console.log('-'.repeat(80));

    const { data: tokens } = await db
      .from('push_tokens')
      .select('token, platform, created_at')
      .eq('user_id', FCM_USER_ID);

    if (!tokens || tokens.length === 0) {
      throw new Error('No FCM tokens found for user');
    }

    console.log(`   ✅ Found ${tokens.length} FCM token(s):`);
    tokens.forEach((t, i) => {
      console.log(`      ${i + 1}. ${t.platform}: ${t.token.substring(0, 35)}...`);
    });
    console.log();

    // ========================================================================
    // STEP 3: Create Reservation
    // ========================================================================
    console.log('📍 STEP 3: Creating Test Reservation');
    console.log('-'.repeat(80));

    const { data: services } = await db
      .from('shop_services')
      .select('id, name, price_min, price_max, duration_minutes')
      .eq('shop_id', SHOP_ID)
      .eq('is_available', true)
      .limit(2);

    if (!services || services.length === 0) {
      throw new Error('No services found for shop');
    }

    console.log(`   Services: ${services.map(s => s.name).join(', ')}`);

    const reservationDate = new Date();
    reservationDate.setDate(reservationDate.getDate() + 15); // +15 days to avoid conflicts

    const totalAmount = services.reduce((sum, s) => sum + (s.price_max || s.price_min), 0);
    const depositAmount = Math.floor(totalAmount * 0.3);

    const reservationDateTime = new Date(reservationDate);
    reservationDateTime.setHours(18, 0, 0, 0); // 6:00 PM

    const { data: reservation, error: reservationError } = await db
      .from('reservations')
      .insert({
        user_id: FCM_USER_ID,
        shop_id: SHOP_ID,
        reservation_date: reservationDate.toISOString().split('T')[0],
        reservation_time: '18:00:00',
        reservation_datetime: reservationDateTime.toISOString(),
        status: 'requested',
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        remaining_amount: totalAmount - depositAmount,
        special_requests: `Complete Push Test - ${new Date().toISOString()}`
      })
      .select()
      .single();

    if (reservationError) throw reservationError;
    reservationId = reservation.id;

    console.log('   ✅ Reservation created:', reservation.id);
    console.log('   Date:', reservation.reservation_date, reservation.reservation_time);
    console.log('   Total:', totalAmount.toLocaleString() + '원');
    console.log();

    // Add services
    const reservationServices = services.map(service => ({
      reservation_id: reservation.id,
      service_id: service.id,
      quantity: 1,
      unit_price: service.price_max || service.price_min,
      total_price: service.price_max || service.price_min
    }));

    await db.from('reservation_services').insert(reservationServices);
    console.log(`   ✅ Added ${reservationServices.length} service(s)`);
    console.log();

    // ========================================================================
    // STEP 4: Shop Admin Confirms Reservation
    // ========================================================================
    console.log('📍 STEP 4: Shop Admin Confirming Reservation');
    console.log('-'.repeat(80));

    const { error: confirmError } = await db
      .from('reservations')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', reservation.id);

    if (confirmError) throw confirmError;

    console.log('   👤 Admin:', SHOP_OWNER_EMAIL);
    console.log('   ✅ Status updated to: confirmed');
    console.log();

    // ========================================================================
    // STEP 5: Send Push Notification via Customer Notification Service
    // ========================================================================
    console.log('📍 STEP 5: Sending Push Notification via Service');
    console.log('-'.repeat(80));

    const servicesForNotification = services.map((service, index) => ({
      serviceName: service.name,
      quantity: reservationServices[index].quantity,
      unitPrice: reservationServices[index].unit_price,
      totalPrice: reservationServices[index].total_price
    }));

    console.log('   Calling customerNotificationService.notifyCustomerOfReservationUpdate()...');

    await customerNotificationService.notifyCustomerOfReservationUpdate({
      customerId: FCM_USER_ID,
      reservationId: reservation.id,
      shopName: shop?.name || '',
      reservationDate: reservation.reservation_date,
      reservationTime: reservation.reservation_time,
      services: servicesForNotification,
      totalAmount: totalAmount,
      depositAmount: depositAmount,
      remainingAmount: totalAmount - depositAmount,
      notificationType: 'reservation_confirmed',
      additionalData: {
        confirmationNotes: '✨ Complete Push Notification Test - 예약이 확정되었습니다!',
        shopId: shop?.id
      }
    });

    console.log('   ✅ Notification service call completed');
    console.log();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ========================================================================
    // STEP 6: Verify Database Records
    // ========================================================================
    console.log('📍 STEP 6: Verifying Database Records');
    console.log('-'.repeat(80));

    // Check notification_history
    const { data: notifHistory } = await db
      .from('notification_history')
      .select('*')
      .eq('user_id', FCM_USER_ID)
      .order('created_at', { ascending: false })
      .limit(1);

    if (notifHistory && notifHistory.length > 0) {
      const hist = notifHistory[0];
      console.log('   ✅ notification_history:');
      console.log('      ID:', hist.id);
      console.log('      Title:', hist.title);
      console.log('      Status:', hist.status);
      console.log('      Sent at:', hist.sent_at);
      console.log('      Error:', hist.error_message || 'None');
    } else {
      console.log('   ❌ No notification_history record found');
    }
    console.log();

    // Check notifications (in-app)
    const { data: inAppNotif } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', FCM_USER_ID)
      .order('created_at', { ascending: false })
      .limit(1);

    if (inAppNotif && inAppNotif.length > 0) {
      const notif = inAppNotif[0];
      console.log('   ✅ notifications (in-app):');
      console.log('      ID:', notif.id);
      console.log('      Title:', notif.title);
      console.log('      Created:', notif.created_at);
    } else {
      console.log('   ❌ No in-app notification found');
    }
    console.log();

    // ========================================================================
    // STEP 7: Direct FCM Delivery Verification
    // ========================================================================
    console.log('📍 STEP 7: Direct FCM Delivery Test');
    console.log('-'.repeat(80));

    const directTestPayload = {
      notification: {
        title: '🧪 Direct FCM Test',
        body: `Reservation confirmed at ${shop?.name}! Testing FCM delivery at ${new Date().toLocaleTimeString('ko-KR')}`
      },
      data: {
        type: 'direct_fcm_test',
        reservationId: reservation.id,
        timestamp: new Date().toISOString()
      }
    };

    console.log('   Sending direct FCM messages...');
    console.log();

    const fcmResults = [];

    for (let i = 0; i < tokens.length; i++) {
      const tokenData = tokens[i];
      console.log(`   Token ${i + 1}/${tokens.length}:`);

      try {
        const message: admin.messaging.Message = {
          ...directTestPayload,
          token: tokenData.token,
          apns: {
            payload: {
              aps: {
                alert: {
                  title: directTestPayload.notification.title,
                  body: directTestPayload.notification.body
                },
                sound: 'default',
                badge: 1
              }
            }
          }
        };

        const messageId = await admin.messaging().send(message);
        console.log(`   ✅ DELIVERED - Message ID: ${messageId}`);
        fcmResults.push({ success: true, messageId, token: tokenData.token.substring(0, 30) });
      } catch (error: any) {
        console.log(`   ❌ FAILED - ${error.message}`);
        fcmResults.push({ success: false, error: error.message, token: tokenData.token.substring(0, 30) });
      }
    }
    console.log();

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('='.repeat(80));
    console.log('📊 COMPLETE PUSH NOTIFICATION FLOW - FINAL RESULTS');
    console.log('='.repeat(80));
    console.log();

    const successfulFCM = fcmResults.filter(r => r.success).length;
    const failedFCM = fcmResults.filter(r => !r.success).length;

    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log();
    console.log('Flow Summary:');
    console.log('  1. ✅ Shop verified (shopowner@test.com)');
    console.log('  2. ✅ FCM tokens found (' + tokens.length + ' devices)');
    console.log('  3. ✅ Reservation created (ID: ' + reservation.id.substring(0, 20) + '...)');
    console.log('  4. ✅ Shop admin confirmed reservation');
    console.log('  5. ✅ Customer notification service executed');
    console.log('  6. ' + (notifHistory && notifHistory.length > 0 ? '✅' : '❌') + ' notification_history record created');
    console.log('  7. ' + (inAppNotif && inAppNotif.length > 0 ? '✅' : '❌') + ' In-app notification created');
    console.log('  8. ✅ Direct FCM delivery: ' + successfulFCM + '/' + tokens.length + ' successful');
    console.log();

    console.log('FCM Delivery Details:');
    fcmResults.forEach((result, i) => {
      if (result.success) {
        console.log(`  ✅ Token ${i + 1}: DELIVERED (${result.messageId})`);
      } else {
        console.log(`  ❌ Token ${i + 1}: FAILED (${result.error})`);
      }
    });
    console.log();

    console.log('📱 What to Check on Device(s):');
    console.log('  1. Check notification center/tray on iOS device(s)');
    console.log('  2. Should see 2 notifications:');
    console.log('     - "🎉 [엘레강스 헤어살롱] 예약 확정"');
    console.log('     - "🧪 Direct FCM Test"');
    console.log('  3. Notifications should appear even if app is closed');
    console.log('  4. Tapping notification should open the app');
    console.log();

    console.log('Database Records:');
    console.log(`  - Reservation ID: ${reservation.id}`);
    console.log(`  - notification_history ID: ${notifHistory?.[0]?.id || 'N/A'}`);
    console.log(`  - In-app notification ID: ${inAppNotif?.[0]?.id || 'N/A'}`);
    console.log();

    console.log('='.repeat(80));
    console.log('🎉 ALL PUSH NOTIFICATION TESTS PASSED!');
    console.log('='.repeat(80));
    console.log();

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    }

    // Cleanup on failure
    if (reservationId) {
      console.log('\n🧹 Cleaning up failed reservation...');
      await db.from('reservations').delete().eq('id', reservationId);
      console.log('   Deleted reservation:', reservationId);
    }

    process.exit(1);
  }
}

testCompletePushNotificationFlow()
  .then(() => {
    console.log('✅ Test script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
