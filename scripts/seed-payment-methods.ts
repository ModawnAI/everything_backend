/**
 * Seed Test Payment Methods
 * Populate realistic test payment methods for testuser@example.com
 */

import { getSupabaseClient } from '../src/config/database';

const TEST_USER_EMAIL = 'testuser@example.com';
const TEST_USER_ID = 'ab60a268-ddff-47ca-b605-fd7830c9560a';

const testPaymentMethods = [
  {
    billing_key: 'billing_test_kb_card_primary',
    payment_method_type: 'CARD',
    card_company: 'KB국민카드',
    card_type: 'CREDIT',
    card_number_masked: '5421-****-****-3456',
    card_number_last4: '3456',
    card_brand: 'VISA',
    nickname: '내 KB 카드',
    is_default: true, // This is the default card
    is_active: true,
  },
  {
    billing_key: 'billing_test_shinhan_card_secondary',
    payment_method_type: 'CARD',
    card_company: '신한카드',
    card_type: 'CREDIT',
    card_number_masked: '9410-****-****-7890',
    card_number_last4: '7890',
    card_brand: 'MASTERCARD',
    nickname: '신한 체크카드',
    is_default: false,
    is_active: true,
  },
  {
    billing_key: 'billing_test_hyundai_card_third',
    payment_method_type: 'CARD',
    card_company: '현대카드',
    card_type: 'CREDIT',
    card_number_masked: '6210-****-****-1234',
    card_number_last4: '1234',
    card_brand: 'VISA',
    nickname: '현대카드 M',
    is_default: false,
    is_active: true,
  },
];

(async () => {
  const supabase = getSupabaseClient();

  console.log('🌱 Seeding Payment Methods for Test User\n');
  console.log('User:', TEST_USER_EMAIL);
  console.log('User ID:', TEST_USER_ID);
  console.log('='
.repeat(70) + '\n');

  // 1. Clear existing test payment methods
  console.log('1️⃣ Clearing existing test payment methods...');
  const { error: deleteErr } = await supabase
    .from('user_payment_methods')
    .delete()
    .eq('user_id', TEST_USER_ID);

  if (deleteErr && !deleteErr.message.includes('0 rows')) {
    console.log('   ⚠️  Error:', deleteErr.message);
  } else {
    console.log('   ✅ Cleared existing data\n');
  }

  // 2. Insert test payment methods
  console.log('2️⃣ Inserting test payment methods...\n');

  for (let i = 0; i < testPaymentMethods.length; i++) {
    const method = testPaymentMethods[i];

    const { data, error } = await supabase
      .from('user_payment_methods')
      .insert({
        user_id: TEST_USER_ID,
        ...method,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (3 * 365 * 24 * 60 * 60 * 1000)).toISOString(), // 3 years from now
        usage_count: Math.floor(Math.random() * 5), // Random usage count
        portone_metadata: {
          test_data: true,
          seeded_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) {
      console.log(`   ❌ Failed to insert ${method.nickname}:`, error.message);
    } else {
      const defaultBadge = data.is_default ? '⭐ DEFAULT' : '';
      console.log(`   ✅ ${method.nickname} ${defaultBadge}`);
      console.log(`      Card: ${data.card_company} ${data.card_brand} (${data.card_number_last4})`);
      console.log(`      Billing Key: ${data.billing_key}`);
      console.log(`      ID: ${data.id}`);
      console.log();
    }
  }

  // 3. Verify insertion
  console.log('3️⃣ Verification...\n');
  const { data: allMethods, error: selectErr } = await supabase
    .from('user_payment_methods')
    .select('*')
    .eq('user_id', TEST_USER_ID)
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  if (selectErr) {
    console.log('   ❌ Error:', selectErr.message);
  } else {
    console.log('   ✅ Verification successful');
    console.log('   Total payment methods:', allMethods.length);
    console.log('   Default payment method:', allMethods.find(m => m.is_default)?.nickname || 'None');
    console.log();

    console.log('   📋 All Payment Methods:');
    allMethods.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.nickname}`);
      console.log(`      ${m.card_company} (****-${m.card_number_last4})`);
      console.log(`      Default: ${m.is_default}, Active: ${m.is_active}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ SEEDING COMPLETE!\n');
  console.log('Test user testuser@example.com now has', allMethods?.length || 0, 'payment methods');
  console.log('\n🎯 Ready to test frontend integration!');

  process.exit(0);
})();
