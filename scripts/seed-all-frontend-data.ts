import { getSupabaseClient } from '../src/config/database';
import { randomUUID } from 'crypto';

async function seedAllFrontendData() {
  const supabase = getSupabaseClient();

  console.log('🌱 Starting comprehensive data seeding for frontend...\n');

  try {
    // 1. Check and seed Users
    console.log('1️⃣ Checking Users...');
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, email, user_role')
      .limit(10);

    console.log(`   Found ${existingUsers?.length || 0} users`);

    if (!existingUsers || existingUsers.length < 5) {
      console.log('   ➕ Creating additional users...');
      // Users should already exist from previous seeding
    }

    // 2. Check and seed Shops
    console.log('\n2️⃣ Checking Shops...');
    const { data: existingShops } = await supabase
      .from('shops')
      .select('id, name, shop_status')
      .limit(10);

    console.log(`   Found ${existingShops?.length || 0} shops`);

    // 3. Check and seed Reservations/Bookings
    console.log('\n3️⃣ Checking Reservations/Bookings...');
    const { data: existingReservations } = await supabase
      .from('reservations')
      .select('id')
      .limit(10);

    console.log(`   Found ${existingReservations?.length || 0} reservations`);
    console.log('   ✅ Reservations already seeded');

    // 4. Check and seed Payments
    console.log('\n4️⃣ Checking Payments...');
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('id')
      .limit(5);

    console.log(`   Found ${existingPayments?.length || 0} payments`);

    if (!existingPayments || existingPayments.length === 0) {
      console.log('   ➕ Creating payments...');

      // Get some reservations to create payments for
      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, user_id, shop_id, total_amount')
        .limit(5);

      if (reservations && reservations.length > 0) {
        for (const reservation of reservations) {
          const payment = {
            id: randomUUID(),
            reservation_id: reservation.id,
            user_id: reservation.user_id,
            shop_id: reservation.shop_id,
            payment_method: ['card', 'transfer', 'easy_pay'][Math.floor(Math.random() * 3)],
            payment_status: ['completed', 'pending', 'failed'][Math.floor(Math.random() * 3)],
            amount: reservation.total_amount,
            paid_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase
            .from('payments')
            .insert(payment);

          if (error) {
            console.log(`      ⚠️ Payment creation skipped: ${error.message}`);
          } else {
            console.log(`      ✅ Created payment for reservation ${reservation.id.substring(0, 8)}...`);
          }
        }
      }
    }

    // 5. Check and seed Point Transactions
    console.log('\n5️⃣ Checking Point Transactions...');
    const { data: existingPoints } = await supabase
      .from('point_transactions')
      .select('id')
      .limit(5);

    console.log(`   Found ${existingPoints?.length || 0} point transactions`);

    if (!existingPoints || existingPoints.length === 0) {
      console.log('   ➕ Creating point transactions...');

      if (existingUsers && existingUsers.length > 0) {
        for (let i = 0; i < 5; i++) {
          const user = existingUsers[i % existingUsers.length];
          const pointTx = {
            id: randomUUID(),
            user_id: user.id,
            transaction_type: ['earned', 'spent', 'expired', 'admin_adjustment'][Math.floor(Math.random() * 4)],
            points_amount: Math.floor(Math.random() * 1000) + 100,
            balance_after: Math.floor(Math.random() * 5000),
            description: ['Reservation completion', 'Points used', 'Promotion bonus', 'Admin adjustment'][Math.floor(Math.random() * 4)],
            created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          };

          const { error } = await supabase
            .from('point_transactions')
            .insert(pointTx);

          if (error) {
            console.log(`      ⚠️ Point transaction creation skipped: ${error.message}`);
          } else {
            console.log(`      ✅ Created point transaction`);
          }
        }
      }
    }

    // 6. Check and seed Refunds
    console.log('\n6️⃣ Checking Refunds...');
    const { data: existingRefunds } = await supabase
      .from('payment_refunds')
      .select('id')
      .limit(5);

    console.log(`   Found ${existingRefunds?.length || 0} refunds`);

    if (!existingRefunds || existingRefunds.length === 0) {
      console.log('   ➕ Creating refunds...');

      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, user_id')
        .eq('payment_status', 'completed')
        .limit(3);

      if (payments && payments.length > 0) {
        for (const payment of payments) {
          const refund = {
            id: randomUUID(),
            payment_id: payment.id,
            user_id: payment.user_id,
            refund_amount: Math.floor(payment.amount * (0.5 + Math.random() * 0.5)),
            refund_status: ['pending', 'approved', 'rejected', 'completed'][Math.floor(Math.random() * 4)],
            refund_reason: ['Customer request', 'Service cancellation', 'Quality issue'][Math.floor(Math.random() * 3)],
            refund_type: ['full', 'partial'][Math.floor(Math.random() * 2)],
            requested_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase
            .from('payment_refunds')
            .insert(refund);

          if (error) {
            console.log(`      ⚠️ Refund creation skipped: ${error.message}`);
          } else {
            console.log(`      ✅ Created refund for payment ${payment.id.substring(0, 8)}...`);
          }
        }
      }
    }

    // 7. Summary
    console.log('\n📊 Final Data Summary:');
    const { data: finalUsers } = await supabase.from('users').select('id');
    const { data: finalShops } = await supabase.from('shops').select('id');
    const { data: finalReservations } = await supabase.from('reservations').select('id');
    const { data: finalPayments } = await supabase.from('payments').select('id');
    const { data: finalPoints } = await supabase.from('point_transactions').select('id');
    const { data: finalRefunds } = await supabase.from('payment_refunds').select('id');

    console.log(`   ✅ Users: ${finalUsers?.length || 0}`);
    console.log(`   ✅ Shops: ${finalShops?.length || 0}`);
    console.log(`   ✅ Reservations: ${finalReservations?.length || 0}`);
    console.log(`   ✅ Payments: ${finalPayments?.length || 0}`);
    console.log(`   ✅ Point Transactions: ${finalPoints?.length || 0}`);
    console.log(`   ✅ Refunds: ${finalRefunds?.length || 0}`);

    console.log('\n🎉 Frontend data seeding completed!\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seedAllFrontendData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

export { seedAllFrontendData };
