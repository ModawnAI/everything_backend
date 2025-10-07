/**
 * 전체 데이터 종합 시딩 스크립트
 * 관리자 API 명세에 따라 모든 데이터를 한국어로 생성
 */

import { getSupabaseClient } from '../src/config/database';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const supabase = getSupabaseClient();

// ============================================================================
// 1. 관리자 사용자 시딩
// ============================================================================
async function seedAdminUsers() {
  console.log('\n🔐 1. 관리자 사용자 시딩 중...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  const adminUsers = [
    {
      email: 'superadmin@ebeautything.com',
      password_hash: passwordHash,
      name: '슈퍼 관리자',
      role: 'super_admin',
      permissions: ['all'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'admin@ebeautything.com',
      password_hash: passwordHash,
      name: '시스템 관리자',
      role: 'admin',
      permissions: ['user_management', 'shop_management', 'payment_management', 'analytics'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'manager@ebeautything.com',
      password_hash: passwordHash,
      name: '매니저 김민수',
      role: 'manager',
      permissions: ['users', 'shops', 'bookings', 'financial'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'support@ebeautything.com',
      password_hash: passwordHash,
      name: '고객지원 이수진',
      role: 'support',
      permissions: ['tickets', 'users'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'moderator@ebeautything.com',
      password_hash: passwordHash,
      name: '모더레이터 박지훈',
      role: 'moderator',
      permissions: ['shops', 'moderation'],
      status: 'active',
      email_verified: true
    },
    {
      email: 'finance@ebeautything.com',
      password_hash: passwordHash,
      name: '재무담당 최유진',
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
    console.error('❌ 관리자 사용자 시딩 실패:', error);
    return [];
  }

  console.log(`✅ ${data?.length || 0}명의 관리자 사용자 생성`);
  return data || [];
}

// ============================================================================
// 2. 샵 시딩
// ============================================================================
async function seedShops(users: any[]) {
  console.log('\n🏪 2. 샵 시딩 중...');

  const shopOwners = users.filter(u => u.user_role === 'shop_owner');

  const shopData = [
    {
      name: '강남 프리미엄 네일샵',
      description: '강남역 도보 5분! 고급스러운 네일 아트와 케어를 제공하는 프리미엄 네일샵입니다.',
      main_category: 'nail',
      sub_categories: ['nail', 'waxing'],
      phone_number: '02-1234-5678',
      email: 'gangnam.nail@example.com',
      address: '서울특별시 강남구 강남대로 396',
      detailed_address: '강남역 5번 출구 앞 빌딩 3층',
      postal_code: '06236',
      latitude: 37.4979,
      longitude: 127.0276,
      shop_status: 'active',
      shop_type: 'partnered',
      verification_status: 'verified',
      commission_rate: 15.0,
      is_featured: true,
      business_license_number: '123-45-67890',
      kakao_channel_url: 'https://pf.kakao.com/gangnam-nail'
    },
    {
      name: '속눈썹 연장 전문 뷰티살롱',
      description: '자연스럽고 아름다운 속눈썹 연장을 위한 전문 뷰티살롱. 1:1 맞춤 시술',
      main_category: 'eyelash',
      sub_categories: ['eyelash', 'eyebrow_tattoo'],
      phone_number: '02-2345-6789',
      email: 'eyelash.beauty@example.com',
      address: '서울특별시 서초구 서초대로 77길 55',
      detailed_address: '2층 201호',
      postal_code: '06651',
      latitude: 37.4833,
      longitude: 127.0322,
      shop_status: 'active',
      shop_type: 'partnered',
      verification_status: 'verified',
      commission_rate: 12.5,
      is_featured: true,
      business_license_number: '234-56-78901'
    },
    {
      name: '왁싱 전문 스튜디오',
      description: '통증 없는 왁싱, 편안한 환경. 남녀 전문 케어',
      main_category: 'waxing',
      sub_categories: ['waxing'],
      phone_number: '02-3456-7890',
      email: 'waxing.studio@example.com',
      address: '서울특별시 마포구 양화로 160',
      detailed_address: '지하 1층',
      postal_code: '04044',
      latitude: 37.5563,
      longitude: 126.9205,
      shop_status: 'active',
      shop_type: 'partnered',
      verification_status: 'verified',
      commission_rate: 10.0,
      is_featured: false,
      business_license_number: '345-67-89012'
    },
    {
      name: '더 뷰티 네일 & 페디큐어',
      description: '네일과 페디큐어를 한번에! 깨끗하고 위생적인 환경',
      main_category: 'nail',
      sub_categories: ['nail'],
      phone_number: '02-4567-8901',
      email: 'beauty.nail@example.com',
      address: '서울특별시 송파구 올림픽로 269',
      detailed_address: '롯데월드몰 4층',
      postal_code: '05551',
      latitude: 37.5133,
      longitude: 127.1028,
      shop_status: 'active',
      shop_type: 'non_partnered',
      verification_status: 'verified',
      commission_rate: 0,
      is_featured: false,
      business_license_number: '456-78-90123'
    },
    {
      name: '눈썹 반영구 전문점',
      description: '자연스러운 눈썹 문신 전문. 10년 경력 아티스트',
      main_category: 'eyebrow_tattoo',
      sub_categories: ['eyebrow_tattoo', 'eyelash'],
      phone_number: '02-5678-9012',
      email: 'eyebrow.art@example.com',
      address: '서울특별시 용산구 이태원로 177',
      detailed_address: '3층',
      postal_code: '04346',
      latitude: 37.5347,
      longitude: 126.9947,
      shop_status: 'pending_approval',
      shop_type: 'partnered',
      verification_status: 'pending',
      commission_rate: 15.0,
      is_featured: false,
      business_license_number: '567-89-01234'
    },
    {
      name: '홍대 네일 아트샵',
      description: '트렌디한 네일 디자인과 아트워크. 학생 할인 제공',
      main_category: 'nail',
      sub_categories: ['nail'],
      phone_number: '02-6789-0123',
      email: 'hongdae.nail@example.com',
      address: '서울특별시 마포구 와우산로 94',
      detailed_address: '2층',
      postal_code: '04053',
      latitude: 37.5563,
      longitude: 126.9236,
      shop_status: 'inactive',
      shop_type: 'non_partnered',
      verification_status: 'verified',
      commission_rate: 0,
      is_featured: false,
      business_license_number: '678-90-12345'
    },
    {
      name: '신사동 럭셔리 뷰티라운지',
      description: '프리미엄 뷰티 토탈케어. VIP 전용 룸 운영',
      main_category: 'nail',
      sub_categories: ['nail', 'eyelash', 'waxing'],
      phone_number: '02-7890-1234',
      email: 'sinsa.beauty@example.com',
      address: '서울특별시 강남구 압구정로 152',
      detailed_address: '신사빌딩 5층',
      postal_code: '06021',
      latitude: 37.5240,
      longitude: 127.0206,
      shop_status: 'active',
      shop_type: 'partnered',
      verification_status: 'verified',
      commission_rate: 20.0,
      is_featured: true,
      business_license_number: '789-01-23456'
    },
    {
      name: '여의도 오피스 네일케어',
      description: '직장인을 위한 빠른 네일케어. 점심시간 특별 할인',
      main_category: 'nail',
      sub_categories: ['nail'],
      phone_number: '02-8901-2345',
      email: 'yeouido.nail@example.com',
      address: '서울특별시 영등포구 여의대로 108',
      detailed_address: 'IFC몰 지하 2층',
      postal_code: '07326',
      latitude: 37.5260,
      longitude: 126.9250,
      shop_status: 'active',
      shop_type: 'partnered',
      verification_status: 'verified',
      commission_rate: 12.0,
      is_featured: false,
      business_license_number: '890-12-34567'
    },
    {
      name: '압구정 왁싱 & 뷰티샵',
      description: '여성전용 왁싱샵. 청결하고 쾌적한 환경',
      main_category: 'waxing',
      sub_categories: ['waxing', 'nail'],
      phone_number: '02-9012-3456',
      email: 'apgujeong.wax@example.com',
      address: '서울특별시 강남구 논현로 842',
      detailed_address: '3층',
      postal_code: '06027',
      latitude: 37.5274,
      longitude: 127.0295,
      shop_status: 'suspended',
      shop_type: 'partnered',
      verification_status: 'verified',
      commission_rate: 15.0,
      is_featured: false,
      business_license_number: '901-23-45678'
    },
    {
      name: '잠실 속눈썹 연장샵',
      description: '자연스러운 볼륨 속눈썹. 숙련된 아티스트',
      main_category: 'eyelash',
      sub_categories: ['eyelash'],
      phone_number: '02-0123-4567',
      email: 'jamsil.lash@example.com',
      address: '서울특별시 송파구 올림픽로 240',
      detailed_address: '잠실역 지하 쇼핑몰 1층',
      postal_code: '05554',
      latitude: 37.5133,
      longitude: 127.1000,
      shop_status: 'pending_approval',
      shop_type: 'partnered',
      verification_status: 'pending',
      commission_rate: 15.0,
      is_featured: false,
      business_license_number: '012-34-56789'
    }
  ];

  const shopsToInsert = shopData.map((shop, index) => {
    const owner = shopOwners[index % shopOwners.length];
    return {
      id: randomUUID(),
      ...shop,
      owner_id: owner?.id,
      created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(), // Random date within 90 days
      updated_at: new Date().toISOString()
    };
  });

  const { data, error } = await supabase
    .from('shops')
    .upsert(shopsToInsert, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('❌ 샵 시딩 실패:', error);
    return [];
  }

  console.log(`✅ ${data?.length || 0}개 샵 생성`);
  return data || [];
}

// ============================================================================
// 3. 샵 서비스 시딩
// ============================================================================
async function seedShopServices(shops: any[]) {
  console.log('\n💅 3. 샵 서비스 시딩 중...');

  const serviceTemplates = {
    nail: [
      { name: '젤 매니큐어', description: '오래 지속되는 젤 폴리시 적용', duration: 60, price_range: [30000, 50000] },
      { name: '네일 아트', description: '다양한 디자인의 네일 아트', duration: 90, price_range: [40000, 80000] },
      { name: '젤 페디큐어', description: '발 전체 케어 및 젤 적용', duration: 90, price_range: [40000, 60000] },
      { name: '네일 케어', description: '손톱 정리 및 기본 케어', duration: 30, price_range: [20000, 30000] },
      { name: '프렌치 네일', description: '클래식 프렌치 디자인', duration: 70, price_range: [35000, 55000] },
      { name: '그라데이션 네일', description: '그라데이션 컬러 네일', duration: 80, price_range: [38000, 58000] }
    ],
    eyelash: [
      { name: '볼륨 속눈썹 연장', description: '자연스러운 볼륨감', duration: 120, price_range: [80000, 120000] },
      { name: '클래식 속눈썹 연장', description: '기본 1:1 연장', duration: 90, price_range: [60000, 90000] },
      { name: '속눈썹 리터치', description: '2-3주 후 보강', duration: 60, price_range: [40000, 60000] },
      { name: '속눈썹 펌', description: '자연 컬링 효과', duration: 60, price_range: [35000, 50000] }
    ],
    waxing: [
      { name: '전신 왁싱', description: '팔, 다리, 겨드랑이 포함', duration: 120, price_range: [80000, 120000] },
      { name: '다리 왁싱', description: '무릎 위아래 포함', duration: 60, price_range: [40000, 60000] },
      { name: '팔 왁싱', description: '팔 전체 왁싱', duration: 40, price_range: [30000, 45000] },
      { name: '브라질리안 왁싱', description: '비키니 라인 왁싱', duration: 40, price_range: [50000, 70000] }
    ],
    eyebrow_tattoo: [
      { name: '눈썹 반영구 화장', description: '자연스러운 눈썹 문신', duration: 150, price_range: [150000, 250000] },
      { name: '눈썹 리터치', description: '6개월 후 보강', duration: 90, price_range: [80000, 120000] },
      { name: '아이라인 반영구', description: '속눈썹 라인', duration: 120, price_range: [120000, 180000] }
    ]
  };

  const services = [];

  for (const shop of shops) {
    const categories = [shop.main_category, ...(shop.sub_categories || [])];

    for (const category of categories) {
      const templates = serviceTemplates[category as keyof typeof serviceTemplates] || [];

      for (const template of templates.slice(0, Math.floor(Math.random() * 3) + 3)) {
        const [minPrice, maxPrice] = template.price_range;
        const price = Math.floor(Math.random() * (maxPrice - minPrice) + minPrice);

        services.push({
          id: randomUUID(),
          shop_id: shop.id,
          name: template.name,
          description: template.description,
          category: category,
          price_min: Math.floor(price * 0.9),
          price_max: price,
          duration_minutes: template.duration,
          deposit_percentage: 20,  // Only use percentage, not both
          is_available: Math.random() > 0.1,
          booking_advance_days: 30,
          cancellation_hours: 24,
          display_order: Math.floor(Math.random() * 100),
          created_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
  }

  const { data, error } = await supabase
    .from('shop_services')
    .upsert(services, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('❌ 샵 서비스 시딩 실패:', error);
    return [];
  }

  console.log(`✅ ${data?.length || 0}개 서비스 생성`);
  return data || [];
}

// ============================================================================
// 4. 예약 시딩
// ============================================================================
async function seedReservations(users: any[], shops: any[], services: any[]) {
  console.log('\n📅 4. 예약 시딩 중...');

  const statuses = ['requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show'];
  const reservations = [];
  const reservationServices = [];

  const regularUsers = users.filter(u => u.user_role === 'user');

  for (let i = 0; i < 50; i++) {
    const user = regularUsers[Math.floor(Math.random() * regularUsers.length)];
    const shop = shops[Math.floor(Math.random() * shops.length)];
    const shopServices = services.filter(s => s.shop_id === shop.id);

    if (shopServices.length === 0) continue;

    const selectedService = shopServices[Math.floor(Math.random() * shopServices.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    // Random date within 60 days (past or future)
    const daysOffset = Math.floor(Math.random() * 60) - 30;
    const reservationDate = new Date();
    reservationDate.setDate(reservationDate.getDate() + daysOffset);

    const hours = Math.floor(Math.random() * 10) + 9; // 9 AM to 7 PM
    const reservationTime = `${hours.toString().padStart(2, '0')}:00:00`;

    const unitPrice = selectedService.price_max || 50000;
    const quantity = 1;
    const totalAmount = unitPrice * quantity;
    const depositAmount = Math.floor(totalAmount * 0.2);
    const pointsUsed = Math.random() > 0.7 ? Math.floor(Math.random() * 5000) : 0;
    const pointsEarned = status === 'completed' ? Math.floor(totalAmount * 0.01) : 0;

    const reservationId = randomUUID();

    reservations.push({
      id: reservationId,
      user_id: user.id,
      shop_id: shop.id,
      reservation_date: reservationDate.toISOString().split('T')[0],
      reservation_time: reservationTime,
      status: status,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      remaining_amount: totalAmount - depositAmount,
      points_used: pointsUsed,
      points_earned: pointsEarned,
      special_requests: Math.random() > 0.7 ? '조용한 자리 부탁드립니다' : null,
      version: 1,
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });

    // Create reservation service link
    reservationServices.push({
      id: randomUUID(),
      reservation_id: reservationId,
      service_id: selectedService.id,
      quantity: quantity,
      unit_price: unitPrice,
      total_price: totalAmount
    });
  }

  const { data, error } = await supabase
    .from('reservations')
    .upsert(reservations, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('❌ 예약 시딩 실패:', error);
    return [];
  }

  // Insert reservation services
  const { error: rsError } = await supabase
    .from('reservation_services')
    .insert(reservationServices);

  if (rsError) {
    console.error('⚠️ 예약 서비스 연결 실패:', rsError);
  }

  console.log(`✅ ${data?.length || 0}개 예약 생성`);
  return data || [];
}

// ============================================================================
// 5. 결제 시딩
// ============================================================================
async function seedPayments(reservations: any[]) {
  console.log('\n💳 5. 결제 시딩 중...');

  const paymentMethods = ['card', 'transfer', 'easy_pay'];
  const payments = [];

  for (const reservation of reservations) {
    if (['confirmed', 'completed'].includes(reservation.status)) {
      payments.push({
        id: randomUUID(),
        reservation_id: reservation.id,
        user_id: reservation.user_id,
        payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        payment_status: 'completed',
        amount: reservation.total_amount - reservation.points_used,
        is_deposit: false,
        refund_amount: 0,
        created_at: reservation.created_at,
        updated_at: new Date().toISOString()
      });
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .insert(payments)
    .select();

  if (error) {
    console.error('❌ 결제 시딩 실패:', error);
    return [];
  }

  console.log(`✅ ${data?.length || 0}개 결제 생성`);
  return data || [];
}

// ============================================================================
// 6. 포인트 거래 시딩
// ============================================================================
async function seedPointTransactions(users: any[], reservations: any[]) {
  console.log('\n💰 6. 포인트 거래 시딩 중...');

  const transactions = [];
  const regularUsers = users.filter(u => u.user_role === 'user');

  for (const user of regularUsers) {
    // 초기 가입 포인트
    transactions.push({
      id: randomUUID(),
      user_id: user.id,
      transaction_type: 'earned',
      amount: 1000,
      description: '회원가입 축하 포인트',
      status: 'completed',
      created_at: user.created_at
    });

    // 랜덤 적립/사용
    for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
      const type = Math.random() > 0.5 ? 'earned' : 'used';
      const points = type === 'earned'
        ? Math.floor(Math.random() * 5000) + 500
        : Math.floor(Math.random() * 3000) + 500;

      transactions.push({
        id: randomUUID(),
        user_id: user.id,
        transaction_type: type,
        amount: type === 'used' ? -points : points,
        description: type === 'earned' ? '예약 완료 적립' : '예약 시 사용',
        status: 'completed',
        created_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }

  const { data, error } = await supabase
    .from('point_transactions')
    .insert(transactions)
    .select();

  if (error) {
    console.error('❌ 포인트 거래 시딩 실패:', error);
    return [];
  }

  console.log(`✅ ${data?.length || 0}개 포인트 거래 생성`);
  return data || [];
}

// ============================================================================
// 7. 티켓 시딩
// ============================================================================
async function seedTickets(users: any[], adminUsers: any[]) {
  console.log('\n🎫 7. 고객 지원 티켓 시딩 중...');

  const categories = ['payment', 'booking', 'refund', 'complaint', 'technical', 'account'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const statuses = ['open', 'in_progress', 'pending', 'resolved', 'closed'];

  const subjects = [
    '결제가 정상적으로 처리되지 않았어요',
    '예약 취소 요청드립니다',
    '환불은 언제 처리되나요?',
    '샵 이용 중 불친절한 응대',
    '포인트 적립이 안 됐어요',
    '앱 실행이 안 돼요',
    '계정 로그인 문제',
    '예약 시간 변경하고 싶어요',
    '결제 영수증 발급 요청',
    '회원 탈퇴 문의',
    '쿠폰 사용 방법 문의',
    '예약 확인 메시지 못 받았어요'
  ];

  const tickets = [];
  const regularUsers = users.filter(u => u.user_role === 'user').slice(0, 15);

  for (let i = 0; i < 30; i++) {
    const user = regularUsers[i % regularUsers.length];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    tickets.push({
      id: randomUUID(),
      subject: subjects[i % subjects.length],
      description: `${subjects[i % subjects.length]}에 대한 상세 문의 내용입니다.`,
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      status: status,
      customer_id: user.id,
      customer_email: user.email,
      customer_name: user.name,
      assigned_to: status !== 'open' ? adminUsers[Math.floor(Math.random() * adminUsers.length)]?.id : null,
      tags: [priorities[Math.floor(Math.random() * priorities.length)]],
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  const { data, error } = await supabase
    .from('tickets')
    .upsert(tickets, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('❌ 티켓 시딩 실패:', error);
    return [];
  }

  console.log(`✅ ${data?.length || 0}개 티켓 생성`);
  return data || [];
}

// ============================================================================
// 메인 실행 함수
// ============================================================================
async function main() {
  try {
    console.log('🚀 전체 데이터 시딩 시작...\n');
    console.log('=' .repeat(60));

    // 기존 사용자 가져오기
    const { data: existingUsers } = await supabase
      .from('users')
      .select('*');

    if (!existingUsers || existingUsers.length === 0) {
      console.error('❌ 사용자가 없습니다. 먼저 사용자를 시딩하세요.');
      process.exit(1);
    }

    console.log(`📊 기존 사용자: ${existingUsers.length}명`);

    // 순차적으로 데이터 시딩
    const adminUsers = await seedAdminUsers();
    const shops = await seedShops(existingUsers);
    const services = await seedShopServices(shops);
    const reservations = await seedReservations(existingUsers, shops, services);
    const payments = await seedPayments(reservations);
    const pointTransactions = await seedPointTransactions(existingUsers, reservations);
    const tickets = await seedTickets(existingUsers, adminUsers);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 모든 데이터 시딩 완료!');
    console.log('=' + '='.repeat(60));
    console.log('\n📊 생성된 데이터 요약:');
    console.log(`   - 관리자: ${adminUsers.length}명`);
    console.log(`   - 사용자: ${existingUsers.length}명`);
    console.log(`   - 샵: ${shops.length}개`);
    console.log(`   - 서비스: ${services.length}개`);
    console.log(`   - 예약: ${reservations.length}개`);
    console.log(`   - 결제: ${payments.length}건`);
    console.log(`   - 포인트 거래: ${pointTransactions.length}건`);
    console.log(`   - 고객 지원 티켓: ${tickets.length}개`);
    console.log('\n💡 Admin 로그인 정보:');
    console.log('   Email: admin@ebeautything.com');
    console.log('   Password: admin123');

  } catch (error) {
    console.error('\n❌ 시딩 실패:', error);
    process.exit(1);
  }
}

main();
