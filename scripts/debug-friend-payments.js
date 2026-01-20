/**
 * Debug script to check friend payment history
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFriendPayments() {
  const friendId = '3fc00cc7-e748-45c1-9e30-07a779678a76';
  const referrerId = '33b92c15-e34c-41f7-83ed-c6582ef7fc68';

  console.log('=== 1. 친구의 모든 결제 내역 (fully_paid만) ===');
  const { data: payments, error: paymentError, count } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      paid_at,
      payment_status,
      reservation_id
    `, { count: 'exact' })
    .eq('user_id', friendId)
    .eq('payment_status', 'fully_paid')
    .order('paid_at', { ascending: false })
    .limit(10);

  if (paymentError) {
    console.error('Payment Error:', paymentError);
  } else {
    console.log(`Total fully_paid payments: ${count}`);
    console.log(JSON.stringify(payments, null, 2));
  }

  console.log('\n=== 2. 친구로부터 받은 모든 커미션 ===');
  const { data: commissions, error: commissionError } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', referrerId)
    .eq('referred_user_id', friendId)
    .eq('transaction_type', 'earned_referral')
    .order('created_at', { ascending: false })
    .limit(10);

  if (commissionError) {
    console.error('Commission Error:', commissionError);
  } else {
    console.log(`Total commissions: ${commissions?.length}`);
    console.log(JSON.stringify(commissions, null, 2));
  }

  console.log('\n=== 3. 결제와 커미션 매핑 확인 ===');
  if (payments && commissions) {
    payments.forEach(payment => {
      const matchedCommission = commissions.find(c =>
        c.payment_id === payment.id ||
        (c.reservation_id === payment.reservation_id && !c.payment_id)
      );
      console.log(`Payment ${payment.id} (${payment.amount}원, ${payment.paid_at}):`);
      console.log(`  → Commission: ${matchedCommission ? matchedCommission.amount + 'P' : 'NOT FOUND ❌'}`);
    });
  }

  console.log('\n=== 4. LEFT JOIN으로 결제 조회 (shops 포함) ===');
  const { data: paymentsWithShops, error: joinError } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      paid_at,
      payment_status,
      reservation_id,
      reservations (
        id,
        shop_id,
        shops (
          id,
          name
        )
      )
    `)
    .eq('user_id', friendId)
    .eq('payment_status', 'fully_paid')
    .order('paid_at', { ascending: false })
    .limit(10);

  if (joinError) {
    console.error('Join Error:', joinError);
  } else {
    console.log(`Payments with shop info: ${paymentsWithShops?.length}`);
    paymentsWithShops?.forEach(p => {
      const shopName = p.reservations?.shops?.name || 'NULL';
      console.log(`  ${p.id}: ${p.amount}원, shop=${shopName}`);
    });
  }
}

debugFriendPayments().catch(console.error);
