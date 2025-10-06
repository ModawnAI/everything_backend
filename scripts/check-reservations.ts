import { getSupabaseClient } from '../src/config/database';

async function checkReservations() {
  const supabase = getSupabaseClient();

  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, reservation_date, reservation_time, status, total_amount')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching reservations:', error.message);
      return;
    }

    if (!reservations || reservations.length === 0) {
      console.log('📭 No reservations found in database');
      return;
    }

    console.log(`\n📊 Found ${reservations.length} reservations:\n`);
    reservations.forEach((r, i) => {
      console.log(`${i + 1}. ID: ${r.id}`);
      console.log(`   Date/Time: ${r.reservation_date} ${r.reservation_time}`);
      console.log(`   Status: ${r.status}`);
      console.log(`   Amount: ₩${r.total_amount?.toLocaleString() || 0}`);
      console.log('');
    });

    console.log('✅ Reservations are in Supabase!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkReservations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
