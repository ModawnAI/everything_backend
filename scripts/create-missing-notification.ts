/**
 * Create notification for existing reservation that's missing one
 */
import { getSupabaseClient } from '../src/config/database';

const RESERVATION_ID = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';
const USER_ID = 'ab60a268-ddff-47ca-b605-fd7830c9560a';

async function createMissingNotification() {
  const client = getSupabaseClient();

  console.log('=== Creating Missing Notification ===\n');

  // 1. Get reservation details
  console.log('1. Fetching reservation details...');
  const { data: reservation, error: resError } = await client
    .from('reservations')
    .select(`
      *,
      shops(name)
    `)
    .eq('id', RESERVATION_ID)
    .single();

  if (resError || !reservation) {
    console.error('❌ Reservation not found:', resError?.message);
    return;
  }

  console.log('✅ Reservation found:');
  console.log(`   ID: ${reservation.id}`);
  console.log(`   Shop: ${reservation.shops?.name || 'Unknown'}`);
  console.log(`   Date: ${reservation.reservation_date}`);
  console.log(`   Time: ${reservation.reservation_time}`);
  console.log(`   Status: ${reservation.status}`);
  console.log(`   Amount: ${reservation.total_amount}`);

  // 2. Check if notification already exists
  console.log('\n2. Checking if notification already exists...');
  const { data: existingNotif } = await client
    .from('notifications')
    .select('id')
    .eq('related_id', RESERVATION_ID)
    .single();

  if (existingNotif) {
    console.log('⚠️  Notification already exists:', existingNotif.id);
    console.log('   Skipping creation.');
    return;
  }

  console.log('✅ No existing notification found.');

  // 3. Create notification
  console.log('\n3. Creating notification...');
  const { data: notification, error: notifError } = await client
    .from('notifications')
    .insert({
      user_id: USER_ID,
      notification_type: 'reservation_confirmed',
      title: '✅ 예약이 확정되었습니다',
      message: `${reservation.shops?.name || '샵'}에서 ${reservation.reservation_date} ${reservation.reservation_time} 예약이 확정되었습니다.`,
      related_id: RESERVATION_ID,
      action_url: `/reservations/${RESERVATION_ID}`,
      status: 'unread'
    })
    .select('id')
    .single();

  if (notifError) {
    console.error('❌ Failed to create notification:', notifError.message);
    return;
  }

  console.log('✅ Notification created successfully!');
  console.log(`   Notification ID: ${notification.id}`);
  console.log(`   Reservation ID: ${RESERVATION_ID}`);
  console.log(`   User ID: ${USER_ID}`);
  console.log(`   Action URL: /reservations/${RESERVATION_ID}`);

  // 4. Verify
  console.log('\n4. Verifying notification was created...');
  const { data: verifyNotif, error: verifyError } = await client
    .from('notifications')
    .select('*')
    .eq('id', notification.id)
    .single();

  if (verifyError || !verifyNotif) {
    console.error('❌ Verification failed:', verifyError?.message);
    return;
  }

  console.log('✅ Verification successful!');
  console.log('   Related ID:', verifyNotif.related_id);
  console.log('   Action URL:', verifyNotif.action_url);
  console.log('   Status:', verifyNotif.status);
}

createMissingNotification()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
