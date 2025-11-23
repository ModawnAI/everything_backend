/**
 * Direct Notification Service Test
 *
 * Directly trigger the notification service to send a push notification
 * bypassing API authentication.
 */

import { notificationService } from './src/services/notification.service';
import { getSupabaseClient } from './src/config/database';

const RESERVATION_ID = 'dcc716de-6dae-4be8-b942-f5bd243ded58';
const USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';

async function testDirectNotification() {
  console.log('='.repeat(80));
  console.log('🧪 Direct FCM Notification Test');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Get reservation details
    console.log('📋 Step 1: Fetching reservation details');
    console.log('-'.repeat(80));

    const supabase = getSupabaseClient();
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select(`
        *,
        shop:shops(id, name)
      `)
      .eq('id', RESERVATION_ID)
      .single();

    if (resError || !reservation) {
      throw new Error(`Failed to fetch reservation: ${resError?.message || 'Not found'}`);
    }

    console.log('✅ Reservation found:');
    console.log('  - ID:', reservation.id);
    console.log('  - Status:', reservation.status);
    console.log('  - User ID:', reservation.user_id);
    console.log('  - Shop:', reservation.shop?.name);
    console.log();

    // Step 2: Check FCM tokens
    console.log('📱 Step 2: Checking FCM tokens for user');
    console.log('-'.repeat(80));

    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('is_active', true);

    if (tokenError) {
      throw new Error(`Failed to fetch tokens: ${tokenError.message}`);
    }

    console.log(`✅ Found ${tokens?.length || 0} active FCM token(s)`);
    tokens?.forEach((token, index) => {
      console.log(`  Token ${index + 1}:`, token.token.substring(0, 30) + '...');
      console.log(`    Platform:`, token.platform);
      console.log(`    Device ID:`, token.device_id || 'none');
    });
    console.log();

    if (!tokens || tokens.length === 0) {
      console.warn('⚠️  No active FCM tokens found for user');
      console.warn('Push notification cannot be sent without valid FCM token');
      console.warn('User needs to register device with FCM token');
      process.exit(1);
    }

    // Step 3: Send push notification directly
    console.log('📤 Step 3: Sending push notification');
    console.log('-'.repeat(80));

    const notificationData = {
      title: '예약이 확정되었습니다!',
      body: `${reservation.shop?.name || '매장'}에서 예약을 확정했습니다.`,
      data: {
        type: 'reservation_confirmed',
        reservationId: RESERVATION_ID,
        shopId: reservation.shop_id,
        shopName: reservation.shop?.name || ''
      }
    };

    console.log('Notification payload:');
    console.log(JSON.stringify(notificationData, null, 2));
    console.log();

    await notificationService.sendNotificationToUser(USER_ID, {
      title: notificationData.title,
      body: notificationData.body,
      type: 'reservation_confirmed',
      priority: 'high',
      data: notificationData.data
    });

    console.log('✅ Push notification sent successfully!');
    console.log();

    // Step 4: Verify notification was logged
    console.log('📊 Step 4: Verifying notification history');
    console.log('-'.repeat(80));

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!notifError && notifications) {
      console.log(`✅ Latest ${notifications.length} notifications for user:`);
      notifications.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${notif.title}`);
        console.log(`     Type: ${notif.notification_type}`);
        console.log(`     Status: ${notif.status}`);
        console.log(`     Created: ${notif.created_at}`);
      });
    }
    console.log();

    console.log('='.repeat(80));
    console.log('✅ TEST COMPLETE!');
    console.log('='.repeat(80));
    console.log();
    console.log('Summary:');
    console.log(`- User ID: ${USER_ID}`);
    console.log(`- FCM Tokens: ${tokens.length} active`);
    console.log(`- Notification sent: Yes`);
    console.log(`- Check user device for push notification`);
    console.log();

    process.exit(0);

  } catch (error) {
    console.error();
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));

    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }

    console.error();
    process.exit(1);
  }
}

testDirectNotification();
