/**
 * Check notification for reservation (using correct schema)
 */
import { getSupabaseClient } from '../src/config/database';

const RESERVATION_ID = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';

async function checkData() {
  const client = getSupabaseClient();

  console.log('=== 1. Checking Reservation ===');
  const { data: reservation, error: reservationError } = await client
    .from('reservations')
    .select('*')
    .eq('id', RESERVATION_ID)
    .single();

  if (reservationError) {
    console.error('❌ Reservation not found:', reservationError.message);
    return;
  }

  console.log('✅ Reservation found:');
  console.log(`  ID: ${reservation.id}`);
  console.log(`  User ID: ${reservation.user_id}`);
  console.log(`  Shop ID: ${reservation.shop_id}`);
  console.log(`  Status: ${reservation.status}`);
  console.log(`  Date: ${reservation.reservation_date}`);
  console.log(`  Time: ${reservation.reservation_time}`);

  console.log('\n=== 2. Checking Notifications linked to this Reservation ===');
  const { data: notifications, error: notifError } = await client
    .from('notifications')
    .select('*')
    .eq('related_id', RESERVATION_ID);

  if (notifError) {
    console.error('❌ Error fetching notifications:', notifError.message);
  } else if (!notifications || notifications.length === 0) {
    console.error('❌ NO NOTIFICATIONS FOUND for this reservation!');
    console.log('   This is the problem - notifications should be created when reservation is confirmed.');
  } else {
    console.log(`✅ Found ${notifications.length} notification(s):`);
    notifications.forEach((notif, idx) => {
      console.log(`\n📬 Notification ${idx + 1}:`);
      console.log(`  ID: ${notif.id}`);
      console.log(`  Type: ${notif.notification_type}`);
      console.log(`  Title: ${notif.title}`);
      console.log(`  Message: ${notif.message}`);
      console.log(`  Status: ${notif.status}`);
      console.log(`  Created: ${notif.created_at}`);
    });
  }

  console.log('\n=== 3. Checking User ===');
  const { data: user, error: userError } = await client
    .from('users')
    .select('id, email, full_name')
    .eq('id', reservation.user_id)
    .single();

  if (userError) {
    console.error('❌ User not found:', userError.message);
  } else {
    console.log('✅ User found:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.full_name}`);
  }

  console.log('\n=== 4. All Recent Notifications for this User ===');
  const { data: userNotifications, error: userNotifError } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', reservation.user_id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (userNotifError) {
    console.error('❌ Error:', userNotifError.message);
  } else {
    console.log(`✅ Found ${userNotifications?.length || 0} notification(s) for user:`);
    userNotifications?.forEach((notif, idx) => {
      console.log(`\n  ${idx + 1}. ${notif.notification_type} - ${notif.title}`);
      console.log(`     Related ID: ${notif.related_id || 'N/A'}`);
      console.log(`     Status: ${notif.status}`);
      console.log(`     Created: ${notif.created_at}`);
    });
  }

  console.log('\n=== 5. Diagnosis ===');
  if (!notifications || notifications.length === 0) {
    console.log('🔴 PROBLEM IDENTIFIED:');
    console.log('   No notification was created for this reservation.');
    console.log('   \n   SOLUTION: The notification service should create a notification when:');
    console.log('   - Reservation is created (status: pending)');
    console.log('   - Reservation is confirmed (status: confirmed)');
    console.log('   - Reservation is cancelled');
    console.log('   - Reservation is completed');
    console.log('   \n   The notification should have:');
    console.log('   - user_id: ' + reservation.user_id);
    console.log('   - related_id: ' + reservation.id);
    console.log('   - notification_type: reservation_confirmed');
    console.log('   - action_url: /reservations/' + reservation.id);
  }
}

checkData()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
