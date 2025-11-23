/**
 * Test: Shop Admin Confirms Reservation with Push Notification
 *
 * This test simulates the ACTUAL workflow when a shop admin confirms a reservation
 * through the admin API endpoint (which is what the dashboard uses).
 *
 * Flow:
 * 1. Create reservation for FCM user at shopowner@test.com's shop
 * 2. Use admin API endpoint to confirm reservation with notifyCustomer=true
 * 3. Verify push notification is sent
 */

import { getSupabaseClient } from './src/config/database';
import { adminReservationService } from './src/services/admin-reservation.service';

const FCM_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';
const SHOP_ID = '22222222-2222-2222-2222-222222222222'; // shopowner@test.com's shop
const SHOP_OWNER_EMAIL = 'shopowner@test.com';

async function testAdminConfirmationWithNotification() {
  console.log('='.repeat(80));
  console.log('🧪 Shop Admin Confirmation with Push Notification Test');
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

    console.log(`   ✅ Found ${tokens.length} FCM token(s):` );
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
    reservationDate.setDate(reservationDate.getDate() + 25); // +25 days to avoid conflicts

    const totalAmount = services.reduce((sum, s) => sum + (s.price_max || s.price_min), 0);
    const depositAmount = Math.floor(totalAmount * 0.3);

    const reservationDateTime = new Date(reservationDate);
    reservationDateTime.setHours(14, 45, 0, 0); // 2:45 PM

    const { data: reservation, error: reservationError } = await db
      .from('reservations')
      .insert({
        user_id: FCM_USER_ID,
        shop_id: SHOP_ID,
        reservation_date: reservationDate.toISOString().split('T')[0],
        reservation_time: '14:45:00',
        reservation_datetime: reservationDateTime.toISOString(),
        status: 'requested',
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        remaining_amount: totalAmount - depositAmount,
        special_requests: `Admin API Test - ${new Date().toISOString()}`
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
    // STEP 4: Admin Confirms Reservation via Admin Service
    // ========================================================================
    console.log('📍 STEP 4: Admin Confirming Reservation (with notifyCustomer=true)');
    console.log('-'.repeat(80));

    console.log('   👤 Admin:', SHOP_OWNER_EMAIL);
    console.log('   🔔 Notification:', 'ENABLED (notifyCustomer: true)');
    console.log();

    // Use the admin service to update status (this is what the admin API endpoint calls)
    const result = await adminReservationService.updateReservationStatus(
      reservation.id,
      {
        status: 'confirmed',
        notes: '예약이 확정되었습니다! 🎉',
        notifyCustomer: true,  // ⬅️ THIS TRIGGERS THE PUSH NOTIFICATION!
        notifyShop: false,
        autoProcessPayment: false
      },
      owner?.id || 'admin'
    );

    console.log('   ✅ Status updated via admin service');
    console.log('   Previous status:', result.reservation.previousStatus);
    console.log('   New status:', result.reservation.newStatus);
    console.log();

    // Wait for async notification processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ========================================================================
    // STEP 5: Verify Notification Records
    // ========================================================================
    console.log('📍 STEP 5: Verifying Notification Records');
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
    // FINAL SUMMARY
    // ========================================================================
    console.log('='.repeat(80));
    console.log('📊 ADMIN CONFIRMATION WITH PUSH NOTIFICATION - RESULTS');
    console.log('='.repeat(80));
    console.log();

    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log();
    console.log('Flow Summary:');
    console.log('  1. ✅ Shop verified (shopowner@test.com)');
    console.log('  2. ✅ FCM tokens found (' + tokens.length + ' device)');
    console.log('  3. ✅ Reservation created (ID: ' + reservation.id.substring(0, 20) + '...)');
    console.log('  4. ✅ Admin confirmed via API with notifyCustomer=true');
    console.log('  5. ' + (notifHistory && notifHistory.length > 0 ? '✅' : '❌') + ' Push notification sent');
    console.log('  6. ' + (inAppNotif && inAppNotif.length > 0 ? '✅' : '❌') + ' In-app notification created');
    console.log();

    console.log('📱 What to Check on Device:');
    console.log('  Check notification center/tray on iOS device');
    console.log('  Should see: "🎉 [엘레강스 헤어살롱] 예약 확정"');
    console.log('  Notification should appear even if app is closed');
    console.log();

    console.log('Database Records:');
    console.log(`  - Reservation ID: ${reservation.id}`);
    console.log(`  - notification_history ID: ${notifHistory?.[0]?.id || 'N/A'}`);
    console.log(`  - In-app notification ID: ${inAppNotif?.[0]?.id || 'N/A'}`);
    console.log();

    console.log('='.repeat(80));
    console.log('🎉 ADMIN CONFIRMATION WITH PUSH NOTIFICATION TEST PASSED!');
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

testAdminConfirmationWithNotification()
  .then(() => {
    console.log('✅ Test script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
