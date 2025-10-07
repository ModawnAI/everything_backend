/**
 * Comprehensive Admin Data Seeding Script
 * Seeds all tables needed for frontend admin endpoints
 */

import { getSupabaseClient } from '../src/config/database';
import bcrypt from 'bcryptjs';

const supabase = getSupabaseClient();

async function seedAdminUsers() {
  console.log('🔐 Seeding admin users...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  const adminUsers = [
    {
      email: 'admin@ebeautything.com',
      password_hash: passwordHash,
      name: 'Super Admin',
      role: 'super_admin',
      permissions: ['all'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'manager@ebeautything.com',
      password_hash: passwordHash,
      name: 'Manager Kim',
      role: 'manager',
      permissions: ['users', 'shops', 'bookings', 'financial'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'support@ebeautything.com',
      password_hash: passwordHash,
      name: 'Support Lee',
      role: 'support',
      permissions: ['tickets', 'users'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'moderator@ebeautything.com',
      password_hash: passwordHash,
      name: 'Moderator Park',
      role: 'moderator',
      permissions: ['shops', 'moderation'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'finance@ebeautything.com',
      password_hash: passwordHash,
      name: 'Finance Choi',
      role: 'finance',
      permissions: ['financial', 'payments', 'refunds'],
      status: 'active',
      email_verified: true
    }
  ];

  const { data, error } = await supabase
    .from('admin_users')
    .upsert(adminUsers, { onConflict: 'email' })
    .select();

  if (error) {
    console.error('❌ Error seeding admin users:', error);
    throw error;
  }

  console.log(`✅ Seeded ${data?.length || 0} admin users`);
  return data || [];
}

async function seedTickets(adminUsers: any[], users: any[]) {
  console.log('🎫 Seeding tickets...');

  const tickets = [];
  const categories = ['payment', 'booking', 'refund', 'complaint', 'technical', 'account'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const statuses = ['open', 'in_progress', 'pending', 'resolved', 'closed'];

  const subjects = [
    '결제가 안돼요',
    '예약 취소하고 싶어요',
    '환불 문의',
    '샵 이용 불만',
    '포인트가 안 쌓여요',
    '앱 오류 신고',
    '계정 문제',
    '서비스 문의',
    '예약 변경 요청',
    '회원 탈퇴 요청',
    '비밀번호 재설정',
    '결제 내역 조회',
    '쿠폰 사용 문제',
    '앱 접속 오류',
    '예약 시간 변경'
  ];

  const descriptions = [
    '결제 진행 중 오류가 발생했습니다. 도와주세요.',
    '예약을 취소하고 싶은데 취소 버튼이 보이지 않습니다.',
    '환불 처리가 언제 되나요? 급합니다.',
    '샵 이용 시 불친절한 응대를 받았습니다.',
    '적립된 포인트가 제대로 표시되지 않습니다.',
    '앱이 자꾸 튕겨요.',
    '로그인이 안 됩니다.',
    '서비스 이용 방법을 알고 싶습니다.',
    '예약 시간을 변경하고 싶습니다.',
    '회원 탈퇴를 원합니다.'
  ];

  for (let i = 0; i < 30; i++) {
    tickets.push({
      subject: subjects[i % subjects.length],
      description: descriptions[i % descriptions.length],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      customer_id: users[i % users.length]?.id,
      customer_email: users[i % users.length]?.email,
      customer_name: users[i % users.length]?.name || `Customer ${i + 1}`,
      assigned_to: adminUsers[i % adminUsers.length]?.id,
      tags: [priorities[Math.floor(Math.random() * priorities.length)]]
    });
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert(tickets)
    .select();

  if (error) {
    console.error('❌ Error seeding tickets:', error);
    throw error;
  }

  console.log(`✅ Seeded ${data?.length || 0} tickets`);
  return data || [];
}

async function seedTicketResponses(tickets: any[], adminUsers: any[]) {
  console.log('💬 Seeding ticket responses...');

  const responses = [];
  const responseTexts = [
    '감사합니다. 확인 후 처리해드리겠습니다.',
    '추가 정보를 제공해주시면 빠르게 처리하겠습니다.',
    '해당 문제는 이미 해결되었습니다.',
    '죄송합니다. 불편을 드려 죄송합니다.',
    '문의 주셔서 감사합니다. 곧 답변드리겠습니다.',
    '관련 부서에 전달하여 처리하겠습니다.',
    '환불이 완료되었습니다.',
    '예약이 정상적으로 취소되었습니다.'
  ];

  for (const ticket of tickets.slice(0, 20)) {
    // Add 2-3 responses per ticket
    const numResponses = Math.floor(Math.random() * 2) + 2;
    for (let i = 0; i < numResponses; i++) {
      responses.push({
        ticket_id: ticket.id,
        content: responseTexts[Math.floor(Math.random() * responseTexts.length)],
        is_internal: i === 0, // First response is internal
        created_by: adminUsers[Math.floor(Math.random() * adminUsers.length)]?.id
      });
    }
  }

  const { data, error } = await supabase
    .from('ticket_responses')
    .insert(responses)
    .select();

  if (error) {
    console.error('❌ Error seeding ticket responses:', error);
    throw error;
  }

  console.log(`✅ Seeded ${data?.length || 0} ticket responses`);
}

async function seedTicketTemplates(adminUsers: any[]) {
  console.log('📝 Seeding ticket templates...');

  const templates = [
    {
      name: '결제 문제 자동 응답',
      content: '결제 문제가 발생하셨군요. 결제 내역을 확인하여 빠르게 처리해드리겠습니다.',
      conditions: { category: 'payment', priority: ['high', 'urgent'] },
      is_active: true,
      created_by: adminUsers[0]?.id
    },
    {
      name: '환불 요청 응답',
      content: '환불 요청이 접수되었습니다. 영업일 기준 3-5일 내에 처리됩니다.',
      conditions: { category: 'refund' },
      is_active: true,
      created_by: adminUsers[0]?.id
    },
    {
      name: '예약 취소 안내',
      content: '예약 취소가 완료되었습니다. 취소 수수료는 정책에 따라 부과됩니다.',
      conditions: { category: 'booking', tags: ['cancel'] },
      is_active: true,
      created_by: adminUsers[0]?.id
    },
    {
      name: '기술 문제 접수',
      content: '기술 문제가 접수되었습니다. 개발팀에서 확인 후 조치하겠습니다.',
      conditions: { category: 'technical' },
      is_active: true,
      created_by: adminUsers[0]?.id
    },
    {
      name: '일반 문의 응답',
      content: '문의 주셔서 감사합니다. 확인 후 빠르게 답변드리겠습니다.',
      conditions: { priority: ['low', 'medium'] },
      is_active: true,
      created_by: adminUsers[0]?.id
    }
  ];

  const { data, error } = await supabase
    .from('ticket_templates')
    .insert(templates)
    .select();

  if (error) {
    console.error('❌ Error seeding ticket templates:', error);
    throw error;
  }

  console.log(`✅ Seeded ${data?.length || 0} ticket templates`);
}

async function seedTicketEscalationRules(adminUsers: any[]) {
  console.log('⬆️ Seeding ticket escalation rules...');

  const rules = [
    {
      name: '긴급 티켓 에스컬레이션',
      conditions: { priority: 'urgent', status: 'open' },
      escalate_to: adminUsers[0]?.id, // Super admin
      is_active: true,
      priority: 1
    },
    {
      name: '24시간 미해결 티켓',
      conditions: { status: 'open', created_hours_ago: 24 },
      escalate_to: adminUsers[1]?.id, // Manager
      is_active: true,
      priority: 2
    },
    {
      name: '결제 문제 에스컬레이션',
      conditions: { category: 'payment', status: ['open', 'in_progress'] },
      escalate_to: adminUsers[4]?.id, // Finance
      is_active: true,
      priority: 3
    }
  ];

  const { data, error } = await supabase
    .from('ticket_escalation_rules')
    .insert(rules)
    .select();

  if (error) {
    console.error('❌ Error seeding ticket escalation rules:', error);
    throw error;
  }

  console.log(`✅ Seeded ${data?.length || 0} ticket escalation rules`);
}

async function seedProductCategories() {
  console.log('🗂️ Seeding product categories...');

  const categories = [
    { name: '네일 제품', slug: 'nail-products', description: '네일 관련 제품' },
    { name: '속눈썹 제품', slug: 'eyelash-products', description: '속눈썹 관련 제품' },
    { name: '왁싱 제품', slug: 'waxing-products', description: '왁싱 관련 제품' },
    { name: '뷰티 도구', slug: 'beauty-tools', description: '뷰티 도구' },
    { name: '케어 제품', slug: 'care-products', description: '케어 제품' }
  ];

  const { data, error } = await supabase
    .from('product_categories')
    .upsert(categories, { onConflict: 'slug' })
    .select();

  if (error) {
    console.error('❌ Error seeding product categories:', error);
    throw error;
  }

  console.log(`✅ Seeded ${data?.length || 0} product categories`);
  return data || [];
}

async function seedProducts(categories: any[]) {
  console.log('📦 Seeding products...');

  const products = [
    {
      category_id: categories[0]?.id,
      name: '젤 네일 폴리시 세트',
      description: '다양한 색상의 젤 네일 폴리시',
      sku: 'NAIL-001',
      price: 45000,
      compare_at_price: 55000,
      stock_quantity: 100,
      status: 'active'
    },
    {
      category_id: categories[1]?.id,
      name: '속눈썹 연장 키트',
      description: '전문가용 속눈썹 연장 키트',
      sku: 'LASH-001',
      price: 120000,
      compare_at_price: 150000,
      stock_quantity: 50,
      status: 'active'
    },
    {
      category_id: categories[2]?.id,
      name: '왁싱 스트립',
      description: '저자극 왁싱 스트립',
      sku: 'WAX-001',
      price: 25000,
      stock_quantity: 200,
      status: 'active'
    },
    {
      category_id: categories[3]?.id,
      name: '네일 아트 브러시 세트',
      description: '12종 네일 아트 브러시',
      sku: 'TOOL-001',
      price: 35000,
      stock_quantity: 80,
      status: 'active'
    },
    {
      category_id: categories[4]?.id,
      name: '핸드 크림',
      description: '보습 핸드 크림',
      sku: 'CARE-001',
      price: 18000,
      stock_quantity: 150,
      status: 'active'
    }
  ];

  const { data, error } = await supabase
    .from('products')
    .insert(products)
    .select();

  if (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  }

  console.log(`✅ Seeded ${data?.length || 0} products`);
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive admin data seeding...\n');

    // Get existing users
    const { data: users } = await supabase
      .from('users')
      .select('id, email, name')
      .limit(10);

    if (!users || users.length === 0) {
      throw new Error('No users found. Please seed users first.');
    }

    // Seed all data
    const adminUsers = await seedAdminUsers();
    const tickets = await seedTickets(adminUsers, users);
    await seedTicketResponses(tickets, adminUsers);
    await seedTicketTemplates(adminUsers);
    await seedTicketEscalationRules(adminUsers);
    const productCategories = await seedProductCategories();
    await seedProducts(productCategories);

    console.log('\n✅ All admin data seeded successfully!');
    console.log('\n📝 Admin Login Credentials:');
    console.log('Email: admin@ebeautything.com');
    console.log('Password: admin123');
    console.log('\nOther admin accounts:');
    console.log('- manager@ebeautything.com (password: admin123)');
    console.log('- support@ebeautything.com (password: admin123)');
    console.log('- moderator@ebeautything.com (password: admin123)');
    console.log('- finance@ebeautything.com (password: admin123)');

  } catch (error) {
    console.error('\n❌ Error seeding admin data:', error);
    process.exit(1);
  }
}

main();
