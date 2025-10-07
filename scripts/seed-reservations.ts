import { getSupabaseClient } from '../src/config/database';
import { logger } from '../src/utils/logger';
import { randomUUID } from 'crypto';

async function seedReservations() {
  const supabase = getSupabaseClient();

  try {
    // Get existing users and shops for foreign keys
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .limit(5);

    const { data: shops } = await supabase
      .from('shops')
      .select('id')
      .limit(5);

    if (!users || users.length === 0) {
      console.error('❌ No users found. Please create users first.');
      return;
    }

    if (!shops || shops.length === 0) {
      console.error('❌ No shops found. Please create shops first.');
      return;
    }

    console.log(`📊 Found ${users.length} users and ${shops.length} shops`);

    const reservations = [
      {
        id: randomUUID(),
        user_id: users[0].id,
        shop_id: shops[0].id,
        reservation_date: new Date('2025-10-15').toISOString().split('T')[0],
        reservation_time: '14:00:00',
        status: 'confirmed',
        total_amount: 150000,
        deposit_amount: 30000,
        remaining_amount: 120000,
        special_requests: 'Window seat preferred',
        confirmed_at: new Date().toISOString(),
        created_at: new Date('2025-10-01').toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: randomUUID(),
        user_id: users[1]?.id || users[0].id,
        shop_id: shops[1]?.id || shops[0].id,
        reservation_date: new Date('2025-10-16').toISOString().split('T')[0],
        reservation_time: '15:30:00',
        status: 'confirmed',
        total_amount: 200000,
        deposit_amount: 50000,
        remaining_amount: 150000,
        special_requests: null,
        confirmed_at: new Date().toISOString(),
        created_at: new Date('2025-10-02').toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: randomUUID(),
        user_id: users[2]?.id || users[0].id,
        shop_id: shops[2]?.id || shops[0].id,
        reservation_date: new Date('2025-10-17').toISOString().split('T')[0],
        reservation_time: '11:00:00',
        status: 'requested',
        total_amount: 180000,
        deposit_amount: 0,
        remaining_amount: 180000,
        special_requests: 'First-time customer',
        confirmed_at: null,
        created_at: new Date('2025-10-03').toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: randomUUID(),
        user_id: users[3]?.id || users[0].id,
        shop_id: shops[3]?.id || shops[0].id,
        reservation_date: new Date('2025-10-18').toISOString().split('T')[0],
        reservation_time: '16:00:00',
        status: 'completed',
        total_amount: 250000,
        deposit_amount: 50000,
        remaining_amount: 0,
        special_requests: null,
        confirmed_at: new Date('2025-10-05').toISOString(),
        created_at: new Date('2025-10-04').toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: randomUUID(),
        user_id: users[4]?.id || users[0].id,
        shop_id: shops[4]?.id || shops[0].id,
        reservation_date: new Date('2025-10-19').toISOString().split('T')[0],
        reservation_time: '13:00:00',
        status: 'confirmed',
        total_amount: 175000,
        deposit_amount: 35000,
        remaining_amount: 140000,
        special_requests: 'Allergic to certain products',
        confirmed_at: new Date().toISOString(),
        created_at: new Date('2025-10-05').toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: randomUUID(),
        user_id: users[0].id,
        shop_id: shops[1]?.id || shops[0].id,
        reservation_date: new Date('2025-10-20').toISOString().split('T')[0],
        reservation_time: '10:00:00',
        status: 'confirmed',
        total_amount: 220000,
        deposit_amount: 44000,
        remaining_amount: 176000,
        special_requests: null,
        confirmed_at: new Date().toISOString(),
        created_at: new Date('2025-10-06').toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: randomUUID(),
        user_id: users[1]?.id || users[0].id,
        shop_id: shops[2]?.id || shops[0].id,
        reservation_date: new Date('2025-10-21').toISOString().split('T')[0],
        reservation_time: '14:30:00',
        status: 'confirmed',
        total_amount: 190000,
        deposit_amount: 38000,
        remaining_amount: 152000,
        special_requests: 'Birthday celebration',
        confirmed_at: new Date().toISOString(),
        created_at: new Date('2025-10-06').toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    console.log('🌱 Seeding reservations...');

    for (const reservation of reservations) {
      const { error } = await supabase
        .from('reservations')
        .upsert(reservation, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error seeding reservation ${reservation.id}:`, error.message);
      } else {
        console.log(`✅ Seeded reservation: ${reservation.id}`);
      }
    }

    console.log('🎉 Reservation seeding completed!');
  } catch (error) {
    console.error('❌ Reservation seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedReservations()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

export { seedReservations };
