/**
 * Check notification and reservation data in Supabase
 */
import { getSupabaseClient } from '../src/config/database';

const RESERVATION_ID = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';

async function checkData() {
  const client = getSupabaseClient();

  console.log('=== Checking Reservation ===');
  const { data: reservation, error: reservationError } = await client
    .from('reservations')
    .select('*')
    .eq('id', RESERVATION_ID)
    .single();

  if (reservationError) {
    console.error('❌ Reservation not found:', reservationError.message);
  } else {
    console.log('✅ Reservation found:');
    console.log(JSON.stringify(reservation, null, 2));
  }

  console.log('\n=== Checking Notifications for this Reservation ===');
  const { data: notifications, error: notifError } = await client
    .from('notifications')
    .select('*')
    .eq('reservation_id', RESERVATION_ID);

  if (notifError) {
    console.error('❌ Error fetching notifications:', notifError.message);
  } else if (!notifications || notifications.length === 0) {
    console.error('❌ No notifications found for this reservation');
  } else {
    console.log(`✅ Found ${notifications.length} notification(s):`);
    notifications.forEach((notif, idx) => {
      console.log(`\n📬 Notification ${idx + 1}:`);
      console.log(JSON.stringify(notif, null, 2));
    });
  }

  if (reservation) {
    console.log('\n=== Checking User for this Reservation ===');
    const { data: user, error: userError } = await client
      .from('auth_users')
      .select('id, email')
      .eq('id', reservation.user_id)
      .single();

    if (userError) {
      console.error('❌ User not found:', userError.message);
    } else {
      console.log('✅ User found:', user);

      console.log('\n=== Checking all notifications for this User ===');
      const { data: userNotifications, error: userNotifError } = await client
        .from('notifications')
        .select('*')
        .eq('user_id', reservation.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (userNotifError) {
        console.error('❌ Error fetching user notifications:', userNotifError.message);
      } else {
        console.log(`✅ Found ${userNotifications?.length || 0} recent notification(s) for user:`);
        userNotifications?.forEach((notif, idx) => {
          console.log(`\n📬 Notification ${idx + 1}:`);
          console.log(`  ID: ${notif.id}`);
          console.log(`  Type: ${notif.notification_type}`);
          console.log(`  Title: ${notif.title}`);
          console.log(`  Reservation ID: ${notif.reservation_id || 'N/A'}`);
          console.log(`  Created: ${notif.created_at}`);
          console.log(`  Read: ${notif.is_read}`);
        });
      }
    }
  }

  console.log('\n=== Checking Notification Routes in Backend ===');
  // This will be manually checked
  console.log('Check if these endpoints are registered:');
  console.log('- GET /api/user/notifications');
  console.log('- GET /api/notifications/preferences');
  console.log('- POST /api/notifications/:id/read');
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
