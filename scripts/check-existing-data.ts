/**
 * Check what data already exists in the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkData() {
  console.log('📊 Checking existing data...\n');

  // Check users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name, user_role, user_status')
    .limit(10);

  console.log('👥 USERS:');
  if (usersError) {
    console.error('Error:', usersError.message);
  } else {
    console.log(`  Found ${users?.length || 0} users`);
    users?.forEach(u => console.log(`    - ${u.email} (${u.user_role}) [${u.user_status}]`));
  }

  // Check shops
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, shop_status')
    .limit(10);

  console.log('\n🏪 SHOPS:');
  console.log(`  Found ${shops?.length || 0} shops`);
  shops?.forEach(s => console.log(`    - ${s.name} [${s.shop_status}]`));

  // Check reservations
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, status')
    .limit(10);

  console.log('\n📅 RESERVATIONS:');
  console.log(`  Found ${reservations?.length || 0} reservations`);

  // Check payments
  const { data: payments } = await supabase
    .from('payments')
    .select('id, payment_status, amount')
    .limit(10);

  console.log('\n💳 PAYMENTS:');
  console.log(`  Found ${payments?.length || 0} payments`);

  // Check point transactions
  const { data: points } = await supabase
    .from('point_transactions')
    .select('id, transaction_type, amount')
    .limit(10);

  console.log('\n🎁 POINT TRANSACTIONS:');
  console.log(`  Found ${points?.length || 0} point transactions`);

  // Check support tickets
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, subject, status')
    .limit(10);

  console.log('\n🎫 SUPPORT TICKETS:');
  console.log(`  Found ${tickets?.length || 0} support tickets`);

  process.exit(0);
}

checkData();
