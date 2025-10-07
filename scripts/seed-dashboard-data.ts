/**
 * Comprehensive Dashboard Data Seeding Script
 *
 * Seeds test data for all admin dashboard pages:
 * - Users
 * - Reservations/Bookings
 * - Payments
 * - Point transactions
 * - Support tickets
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper to generate random date in past 60 days
const randomPastDate = (daysAgo: number = 60) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
};

async function seedUsers() {
  console.log('\n📝 Seeding users...');

  const hashedPassword = await bcrypt.hash('Password123!', 12);

  const users = [
    {
      email: 'user1@example.com',
      password_hash: hashedPassword,
      role: 'customer',
      status: 'active',
      full_name: '김민수',
      phone_number: '010-1234-5678',
      created_at: randomPastDate(90)
    },
    {
      email: 'user2@example.com',
      password_hash: hashedPassword,
      role: 'customer',
      status: 'active',
      full_name: '이영희',
      phone_number: '010-2345-6789',
      created_at: randomPastDate(90)
    },
    {
      email: 'user3@example.com',
      password_hash: hashedPassword,
      role: 'customer',
      status: 'active',
      full_name: '박철수',
      phone_number: '010-3456-7890',
      created_at: randomPastDate(90)
    },
    {
      email: 'shopowner1@example.com',
      password_hash: hashedPassword,
      role: 'shop_owner',
      status: 'active',
      full_name: '최사장',
      phone_number: '010-4567-8901',
      created_at: randomPastDate(120)
    },
    {
      email: 'shopowner2@example.com',
      password_hash: hashedPassword,
      role: 'shop_owner',
      status: 'active',
      full_name: '강대표',
      phone_number: '010-5678-9012',
      created_at: randomPastDate(120)
    },
    {
      email: 'inactive@example.com',
      password_hash: hashedPassword,
      role: 'customer',
      status: 'inactive',
      full_name: '정비활',
      phone_number: '010-6789-0123',
      created_at: randomPastDate(150)
    },
    {
      email: 'suspended@example.com',
      password_hash: hashedPassword,
      role: 'customer',
      status: 'suspended',
      full_name: '서정지',
      phone_number: '010-7890-1234',
      created_at: randomPastDate(100)
    }
  ];

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (existing) {
      console.log(`  ⏭️  Skipped user: ${user.email}`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('users').insert([user]);

    if (error) {
      console.error(`  ❌ Error creating ${user.email}:`, error.message);
    } else {
      console.log(`  ✅ Created user: ${user.email} (${user.role})`);
      created++;
    }
  }

  console.log(`\n  📊 Users: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function seedReservations() {
  console.log('\n📅 Seeding reservations...');

  // Get existing shops and users
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name')
    .eq('shop_status', 'active')
    .limit(5);

  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .eq('role', 'customer')
    .eq('status', 'active')
    .limit(3);

  if (!shops?.length || !users?.length) {
    console.log('  ⚠️  No shops or users found. Skipping reservations.');
    return { created: 0, skipped: 0 };
  }

  const reservationStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  const reservations = [];

  // Create 15 reservations
  for (let i = 0; i < 15; i++) {
    const shop = shops[Math.floor(Math.random() * shops.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const status = reservationStatuses[Math.floor(Math.random() * reservationStatuses.length)];

    const reservationDate = new Date();
    reservationDate.setDate(reservationDate.getDate() + Math.floor(Math.random() * 30) - 15); // ±15 days

    reservations.push({
      shop_id: shop.id,
      user_id: user.id,
      service_name: '젤네일',
      reservation_date: reservationDate.toISOString().split('T')[0],
      reservation_time: `${10 + Math.floor(Math.random() * 8)}:00`,
      status,
      total_price: 50000 + Math.floor(Math.random() * 100000),
      created_at: randomPastDate(30)
    });
  }

  let created = 0;

  for (const reservation of reservations) {
    const { error } = await supabase.from('reservations').insert([reservation]);

    if (error) {
      console.error(`  ❌ Error creating reservation:`, error.message);
    } else {
      console.log(`  ✅ Created reservation: ${reservation.status} on ${reservation.reservation_date}`);
      created++;
    }
  }

  console.log(`\n  📊 Reservations: ${created} created`);
  return { created, skipped: 0 };
}

async function seedPayments() {
  console.log('\n💳 Seeding payments...');

  // Get completed reservations
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, user_id, total_price')
    .in('status', ['confirmed', 'completed'])
    .limit(10);

  if (!reservations?.length) {
    console.log('  ⚠️  No confirmed reservations found. Skipping payments.');
    return { created: 0, skipped: 0 };
  }

  const paymentStatuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'FAILED'];
  const paymentMethods = ['card', 'toss_payments', 'kakao_pay', 'naver_pay'];

  let created = 0;

  for (const reservation of reservations) {
    const payment = {
      reservation_id: reservation.id,
      user_id: reservation.user_id,
      amount: reservation.total_price,
      payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      payment_status: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
      payment_key: `test_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: randomPastDate(25)
    };

    const { error } = await supabase.from('payments').insert([payment]);

    if (error) {
      console.error(`  ❌ Error creating payment:`, error.message);
    } else {
      console.log(`  ✅ Created payment: ${payment.payment_status} - ₩${payment.amount.toLocaleString()}`);
      created++;
    }
  }

  console.log(`\n  📊 Payments: ${created} created`);
  return { created, skipped: 0 };
}

async function seedPointTransactions() {
  console.log('\n🎁 Seeding point transactions...');

  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .eq('role', 'customer')
    .eq('status', 'active')
    .limit(3);

  if (!users?.length) {
    console.log('  ⚠️  No active users found. Skipping point transactions.');
    return { created: 0, skipped: 0 };
  }

  const transactionTypes = ['EARNED', 'USED', 'EXPIRED', 'REFUNDED', 'ADMIN_ADJUSTMENT'];
  const reasons = [
    'Reservation completed',
    'Referral bonus',
    'Welcome bonus',
    'Points expired',
    'Refund processed',
    'Admin adjustment - Customer service',
    'Cancelled reservation refund'
  ];

  let created = 0;

  // Create 20 point transactions
  for (let i = 0; i < 20; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const transactionType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
    const isDebit = transactionType === 'USED' || transactionType === 'EXPIRED';

    const transaction = {
      user_id: user.id,
      amount: isDebit ? -(500 + Math.floor(Math.random() * 5000)) : (500 + Math.floor(Math.random() * 5000)),
      transaction_type: transactionType,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      balance_after: Math.floor(Math.random() * 10000),
      created_at: randomPastDate(45)
    };

    const { error } = await supabase.from('point_transactions').insert([transaction]);

    if (error) {
      console.error(`  ❌ Error creating point transaction:`, error.message);
    } else {
      console.log(`  ✅ Created point transaction: ${transaction.transaction_type} - ${transaction.amount > 0 ? '+' : ''}${transaction.amount}`);
      created++;
    }
  }

  console.log(`\n  📊 Point transactions: ${created} created`);
  return { created, skipped: 0 };
}

async function seedTickets() {
  console.log('\n🎫 Seeding support tickets...');

  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('role', 'customer')
    .limit(3);

  if (!users?.length) {
    console.log('  ⚠️  No users found. Skipping tickets.');
    return { created: 0, skipped: 0 };
  }

  const ticketStatuses = ['open', 'pending', 'resolved', 'closed'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const categories = ['payment', 'reservation', 'account', 'technical', 'general'];

  const ticketTemplates = [
    { title: '결제가 완료되지 않았어요', category: 'payment', priority: 'high' },
    { title: '예약 시간 변경 요청', category: 'reservation', priority: 'medium' },
    { title: '계정 비밀번호 재설정 문의', category: 'account', priority: 'low' },
    { title: '앱이 자주 멈춰요', category: 'technical', priority: 'high' },
    { title: '예약 취소 환불 문의', category: 'payment', priority: 'medium' },
    { title: '샵 정보가 잘못되어 있어요', category: 'general', priority: 'low' },
    { title: '포인트가 적립되지 않았습니다', category: 'payment', priority: 'medium' },
    { title: '로그인이 안 돼요', category: 'technical', priority: 'urgent' },
    { title: '리뷰 작성 방법 문의', category: 'general', priority: 'low' },
    { title: '예약 확인 메시지가 안 와요', category: 'reservation', priority: 'medium' }
  ];

  let created = 0;

  for (const template of ticketTemplates) {
    const user = users[Math.floor(Math.random() * users.length)];
    const status = ticketStatuses[Math.floor(Math.random() * ticketStatuses.length)];

    const ticket = {
      user_id: user.id,
      subject: template.title,
      description: `${template.title}에 대한 자세한 설명입니다. 빠른 도움 부탁드립니다.`,
      status,
      priority: template.priority,
      category: template.category,
      created_at: randomPastDate(30),
      updated_at: randomPastDate(15)
    };

    const { error } = await supabase.from('support_tickets').insert([ticket]);

    if (error) {
      console.error(`  ❌ Error creating ticket:`, error.message);
    } else {
      console.log(`  ✅ Created ticket: [${template.category}] ${template.title} - ${status}`);
      created++;
    }
  }

  console.log(`\n  📊 Support tickets: ${created} created`);
  return { created, skipped: 0 };
}

async function main() {
  console.log('🌱 Starting comprehensive dashboard data seeding...\n');
  console.log('=' .repeat(60));

  try {
    const results = {
      users: await seedUsers(),
      reservations: await seedReservations(),
      payments: await seedPayments(),
      pointTransactions: await seedPointTransactions(),
      tickets: await seedTickets()
    };

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SEEDING SUMMARY\n');
    console.log(`Users:              ${results.users.created} created, ${results.users.skipped} skipped`);
    console.log(`Reservations:       ${results.reservations.created} created`);
    console.log(`Payments:           ${results.payments.created} created`);
    console.log(`Point Transactions: ${results.pointTransactions.created} created`);
    console.log(`Support Tickets:    ${results.tickets.created} created`);
    console.log('\n🏁 Seeding complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error during seeding:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
