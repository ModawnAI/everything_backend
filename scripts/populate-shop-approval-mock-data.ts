import { getSupabaseClient } from '../src/config/database';
import { logger } from '../src/utils/logger';

/**
 * Script to populate shop approval mock data
 *
 * Creates:
 * - 20 shops with various approval statuses
 * - Mock verification history records
 * - Realistic Korean business data
 */

interface MockShopData {
  name: string;
  description: string;
  phone_number: string;
  email: string;
  address: string;
  detailed_address: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  shop_type: 'partnered' | 'non_partnered';
  shop_status: 'active' | 'inactive' | 'pending_approval' | 'suspended';
  verification_status: 'pending' | 'verified' | 'rejected';
  business_license_number?: string;
  business_license_image_url?: string;
  main_category: 'nail' | 'eyelash' | 'waxing' | 'eyebrow_tattoo' | 'hair';
  sub_categories?: string[];
  operating_hours?: Record<string, any>;
  payment_methods?: string[];
  kakao_channel_url?: string;
  total_bookings: number;
  partnership_started_at?: string;
  featured_until?: string;
  is_featured: boolean;
  commission_rate: number;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

interface MockVerificationHistory {
  shop_id: string;
  previous_verification_status: string;
  new_verification_status: string;
  previous_shop_status: string;
  new_shop_status: string;
  action: 'approve' | 'reject';
  reason?: string;
  admin_notes?: string;
  verification_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

const supabase = getSupabaseClient();

// Mock shop names by category
const shopNames = {
  nail: [
    '네일팩토리 강남점',
    '럭셔리네일 신사점',
    '프리미엄 네일살롱',
    '아트네일스튜디오',
    '엘레강스 네일'
  ],
  eyelash: [
    '래쉬업 압구정',
    '뷰티래쉬 청담',
    '아이러브래쉬',
    '스타일래쉬 강남',
    '드림아이래쉬'
  ],
  waxing: [
    '왁싱클럽 서울',
    '프리미엄왁싱',
    '실키스무스왁싱',
    '퓨어왁싱룸',
    '왁싱마스터'
  ],
  eyebrow_tattoo: [
    '눈썹문신전문가',
    '아트브로우',
    '퍼펙트브로우',
    '뷰티브로우살롱',
    '프리미엄반영구'
  ],
  hair: [
    '헤어드레서 청담',
    '스타일헤어살롱',
    '프리미엄헤어',
    '모던헤어스튜디오',
    '럭셔리헤어'
  ]
};

// Seoul addresses
const seoulAddresses = [
  { address: '서울특별시 강남구 테헤란로 123', postalCode: '06234', lat: 37.5012, lon: 127.0396 },
  { address: '서울특별시 서초구 서초대로 456', postalCode: '06789', lat: 37.4839, lon: 127.0324 },
  { address: '서울특별시 송파구 올림픽로 789', postalCode: '05876', lat: 37.5145, lon: 127.1059 },
  { address: '서울특별시 강동구 천호대로 234', postalCode: '05321', lat: 37.5304, lon: 127.1238 },
  { address: '서울특별시 중구 을지로 567', postalCode: '04522', lat: 37.5660, lon: 126.9910 },
  { address: '서울특별시 종로구 종로 891', postalCode: '03142', lat: 37.5709, lon: 126.9827 },
  { address: '서울특별시 용산구 이태원로 345', postalCode: '04345', lat: 37.5347, lon: 126.9943 },
  { address: '서울특별시 마포구 홍익로 678', postalCode: '04039', lat: 37.5511, lon: 126.9226 },
  { address: '서울특별시 영등포구 여의대로 910', postalCode: '07327', lat: 37.5219, lon: 126.9245 },
  { address: '서울특별시 동작구 흑석로 123', postalCode: '06974', lat: 37.5060, lon: 126.9619 },
  { address: '서울특별시 관악구 관악로 456', postalCode: '08786', lat: 37.4783, lon: 126.9516 },
  { address: '서울특별시 강서구 공항대로 789', postalCode: '07505', lat: 37.5509, lon: 126.8495 },
  { address: '서울특별시 구로구 디지털로 234', postalCode: '08379', lat: 37.4854, lon: 126.8976 },
  { address: '서울특별시 금천구 가산디지털1로 567', postalCode: '08507', lat: 37.4812, lon: 126.8823 },
  { address: '서울특별시 성북구 성북로 891', postalCode: '02876', lat: 37.5894, lon: 127.0167 },
  { address: '서울특별시 동대문구 청계천로 345', postalCode: '02565', lat: 37.5744, lon: 127.0399 },
  { address: '서울특별시 노원구 노원로 678', postalCode: '01695', lat: 37.6542, lon: 127.0568 },
  { address: '서울특별시 도봉구 도봉로 910', postalCode: '01440', lat: 37.6688, lon: 127.0471 },
  { address: '서울특별시 은평구 은평로 123', postalCode: '03449', lat: 37.6176, lon: 126.9227 },
  { address: '서울특별시 서대문구 연세로 456', postalCode: '03722', lat: 37.5595, lon: 126.9425 }
];

// Generate mock business license number (Korean format: XXX-XX-XXXXX)
function generateBusinessLicenseNumber(): string {
  const part1 = Math.floor(Math.random() * 900 + 100);
  const part2 = Math.floor(Math.random() * 90 + 10);
  const part3 = Math.floor(Math.random() * 90000 + 10000);
  return `${part1}-${part2}-${part3}`;
}

// Generate mock business license image URL
function generateBusinessLicenseImageUrl(shopId: string): string {
  return `https://storage.example.com/business-licenses/${shopId}/license-${Date.now()}.jpg`;
}

// Generate mock shop email
function generateShopEmail(shopName: string): string {
  const cleanName = shopName.replace(/[^a-zA-Z0-9가-힣]/g, '').toLowerCase();
  return `${cleanName}@example.com`;
}

// Generate mock operating hours
function generateOperatingHours(): Record<string, any> {
  return {
    monday: { open: '09:00', close: '21:00', is_closed: false },
    tuesday: { open: '09:00', close: '21:00', is_closed: false },
    wednesday: { open: '09:00', close: '21:00', is_closed: false },
    thursday: { open: '09:00', close: '21:00', is_closed: false },
    friday: { open: '09:00', close: '22:00', is_closed: false },
    saturday: { open: '10:00', close: '22:00', is_closed: false },
    sunday: { open: '10:00', close: '20:00', is_closed: false }
  };
}

// Generate mock phone number
function generatePhoneNumber(): string {
  const prefixes = ['02', '010', '070'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const middle = Math.floor(Math.random() * 9000 + 1000);
  const last = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${middle}-${last}`;
}

// Get date X days ago
function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

async function getAdminUserId(): Promise<string | null> {
  try {
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    return admins && admins.length > 0 ? admins[0].id : null;
  } catch (error) {
    logger.error('Failed to get admin user ID', { error });
    return null;
  }
}

async function populateShopApprovalMockData() {
  try {
    logger.info('Starting shop approval mock data population...');

    const adminId = await getAdminUserId();
    if (!adminId) {
      logger.warn('No admin user found - verification history will not have reviewed_by field');
    }

    const categories: Array<'nail' | 'eyelash' | 'waxing' | 'eyebrow_tattoo' | 'hair'> =
      ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];

    const mockShops: MockShopData[] = [];

    // Generate 20 shops with different approval statuses
    let addressIndex = 0;

    // 1. Pending shops (8 shops) - Various submission dates
    for (let i = 0; i < 8; i++) {
      const category = categories[i % categories.length];
      const names = shopNames[category];
      const shopName = names[i % names.length];
      const addr = seoulAddresses[addressIndex++ % seoulAddresses.length];
      const daysOld = [1, 3, 5, 8, 12, 15, 20, 25][i]; // Some urgent (>7 days)

      mockShops.push({
        name: shopName,
        description: `${shopName}은(는) 최고의 ${category} 서비스를 제공합니다.`,
        phone_number: generatePhoneNumber(),
        email: generateShopEmail(shopName),
        address: addr.address,
        detailed_address: `${Math.floor(Math.random() * 10 + 1)}층 ${Math.floor(Math.random() * 20 + 1)}호`,
        postal_code: addr.postalCode,
        latitude: addr.lat,
        longitude: addr.lon,
        shop_type: Math.random() > 0.3 ? 'non_partnered' : 'partnered',
        shop_status: 'pending_approval',
        verification_status: 'pending',
        business_license_number: i % 2 === 0 ? generateBusinessLicenseNumber() : undefined, // Some missing license
        business_license_image_url: i % 2 === 0 ? generateBusinessLicenseImageUrl(`pending-${i}`) : undefined,
        main_category: category,
        sub_categories: [],
        operating_hours: generateOperatingHours(),
        payment_methods: ['card', 'bank_transfer', 'kakao_pay'],
        kakao_channel_url: `https://pf.kakao.com/${shopName.replace(/\s/g, '')}`,
        total_bookings: 0,
        is_featured: false,
        commission_rate: 15,
        created_at: getDaysAgo(daysOld),
        updated_at: getDaysAgo(daysOld)
      });
    }

    // 2. Verified & Active shops (6 shops) - Recently approved
    for (let i = 0; i < 6; i++) {
      const category = categories[i % categories.length];
      const names = shopNames[category];
      const shopName = names[(i + 1) % names.length];
      const addr = seoulAddresses[addressIndex++ % seoulAddresses.length];
      const daysOld = [30, 45, 60, 75, 90, 120][i];

      mockShops.push({
        name: shopName,
        description: `인증된 프리미엄 ${category} 전문점입니다.`,
        phone_number: generatePhoneNumber(),
        email: generateShopEmail(shopName),
        address: addr.address,
        detailed_address: `${Math.floor(Math.random() * 10 + 1)}층 ${Math.floor(Math.random() * 20 + 1)}호`,
        postal_code: addr.postalCode,
        latitude: addr.lat,
        longitude: addr.lon,
        shop_type: Math.random() > 0.5 ? 'non_partnered' : 'partnered',
        shop_status: 'active',
        verification_status: 'verified',
        business_license_number: generateBusinessLicenseNumber(),
        business_license_image_url: generateBusinessLicenseImageUrl(`verified-${i}`),
        main_category: category,
        sub_categories: [],
        operating_hours: generateOperatingHours(),
        payment_methods: ['card', 'bank_transfer', 'kakao_pay', 'toss_payments', 'naver_pay'],
        kakao_channel_url: `https://pf.kakao.com/${shopName.replace(/\s/g, '')}`,
        total_bookings: Math.floor(Math.random() * 100 + 20),
        partnership_started_at: getDaysAgo(daysOld - 5),
        featured_until: i % 2 === 0 ? getDaysAgo(-30) : undefined, // Some featured
        is_featured: i % 2 === 0,
        commission_rate: 12,
        created_at: getDaysAgo(daysOld),
        updated_at: getDaysAgo(5)
      });
    }

    // 3. Rejected shops (4 shops) - Various rejection reasons
    for (let i = 0; i < 4; i++) {
      const category = categories[i % categories.length];
      const names = shopNames[category];
      const shopName = names[(i + 2) % names.length];
      const addr = seoulAddresses[addressIndex++ % seoulAddresses.length];
      const daysOld = [10, 15, 20, 25][i];

      mockShops.push({
        name: shopName,
        description: `${category} 전문 서비스 제공`,
        phone_number: generatePhoneNumber(),
        email: generateShopEmail(shopName),
        address: addr.address,
        detailed_address: `${Math.floor(Math.random() * 10 + 1)}층`,
        postal_code: addr.postalCode,
        latitude: addr.lat,
        longitude: addr.lon,
        shop_type: 'non_partnered',
        shop_status: 'inactive',
        verification_status: 'rejected',
        business_license_number: i % 2 === 0 ? generateBusinessLicenseNumber() : undefined,
        business_license_image_url: i % 2 === 0 ? generateBusinessLicenseImageUrl(`rejected-${i}`) : undefined,
        main_category: category,
        sub_categories: [],
        operating_hours: generateOperatingHours(),
        payment_methods: ['card'],
        total_bookings: 0,
        is_featured: false,
        commission_rate: 15,
        created_at: getDaysAgo(daysOld),
        updated_at: getDaysAgo(daysOld - 2)
      });
    }

    // 4. Verified but Inactive shops (2 shops) - Temporarily closed
    for (let i = 0; i < 2; i++) {
      const category = categories[i % categories.length];
      const names = shopNames[category];
      const shopName = names[(i + 3) % names.length];
      const addr = seoulAddresses[addressIndex++ % seoulAddresses.length];

      mockShops.push({
        name: shopName,
        description: `휴업 중 - ${category} 전문`,
        phone_number: generatePhoneNumber(),
        email: generateShopEmail(shopName),
        address: addr.address,
        detailed_address: `${Math.floor(Math.random() * 10 + 1)}층 ${Math.floor(Math.random() * 20 + 1)}호`,
        postal_code: addr.postalCode,
        latitude: addr.lat,
        longitude: addr.lon,
        shop_type: 'non_partnered',
        shop_status: 'inactive',
        verification_status: 'verified',
        business_license_number: generateBusinessLicenseNumber(),
        business_license_image_url: generateBusinessLicenseImageUrl(`inactive-${i}`),
        main_category: category,
        sub_categories: [],
        operating_hours: generateOperatingHours(),
        payment_methods: ['card', 'bank_transfer'],
        total_bookings: Math.floor(Math.random() * 50 + 10),
        partnership_started_at: getDaysAgo(180),
        is_featured: false,
        commission_rate: 15,
        created_at: getDaysAgo(200),
        updated_at: getDaysAgo(30)
      });
    }

    logger.info('Inserting shops into database...', { count: mockShops.length });

    // Insert shops
    const { data: insertedShops, error: insertError } = await supabase
      .from('shops')
      .insert(mockShops)
      .select('id, name, verification_status, shop_status, created_at');

    if (insertError) {
      throw new Error(`Failed to insert shops: ${insertError.message}`);
    }

    if (!insertedShops || insertedShops.length === 0) {
      throw new Error('No shops were inserted');
    }

    logger.info('Shops inserted successfully', { count: insertedShops.length });

    // Create verification history for approved and rejected shops
    const verificationHistory: MockVerificationHistory[] = [];

    for (const shop of insertedShops) {
      // Approved shops - create approval history
      if (shop.verification_status === 'verified') {
        const approvalReasons = [
          '모든 서류가 정상적으로 제출되었습니다.',
          '사업자 등록증 및 시설 확인 완료',
          '요구사항을 모두 충족하여 승인합니다.',
          '정상적인 사업장으로 확인되었습니다.',
          '필요한 모든 인증이 완료되었습니다.',
          '심사 기준을 모두 통과했습니다.'
        ];

        verificationHistory.push({
          shop_id: shop.id,
          previous_verification_status: 'pending',
          new_verification_status: 'verified',
          previous_shop_status: 'pending_approval',
          new_shop_status: 'active',
          action: 'approve',
          reason: approvalReasons[Math.floor(Math.random() * approvalReasons.length)],
          admin_notes: `사업자등록증 확인 완료, 시설 사진 검토 완료`,
          verification_notes: `${shop.name}의 입점 신청이 승인되었습니다. 파트너십을 환영합니다!`,
          reviewed_by: adminId || undefined,
          reviewed_at: getDaysAgo(Math.floor(Math.random() * 5 + 1)),
          created_at: shop.created_at
        });
      }

      // Rejected shops - create rejection history
      if (shop.verification_status === 'rejected') {
        const rejectionReasons = [
          '사업자 등록증이 확인되지 않았습니다.',
          '제출된 서류가 불완전합니다.',
          '연락처 정보가 확인되지 않았습니다.',
          '사업장 주소를 확인할 수 없습니다.'
        ];

        verificationHistory.push({
          shop_id: shop.id,
          previous_verification_status: 'pending',
          new_verification_status: 'rejected',
          previous_shop_status: 'pending_approval',
          new_shop_status: 'inactive',
          action: 'reject',
          reason: rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)],
          admin_notes: `서류 불완전, 추가 제출 요청 필요`,
          verification_notes: `입점 신청이 반려되었습니다. 사유를 확인하시고 서류를 보완하여 재신청해 주세요.`,
          reviewed_by: adminId || undefined,
          reviewed_at: getDaysAgo(Math.floor(Math.random() * 3 + 1)),
          created_at: shop.created_at
        });
      }
    }

    if (verificationHistory.length > 0) {
      logger.info('Inserting verification history...', { count: verificationHistory.length });

      const { error: historyError } = await supabase
        .from('shop_verification_history')
        .insert(verificationHistory);

      if (historyError) {
        logger.error('Failed to insert verification history', { error: historyError.message });
      } else {
        logger.info('Verification history inserted successfully');
      }
    }

    // Summary
    const summary = {
      totalShops: insertedShops.length,
      pending: insertedShops.filter(s => s.verification_status === 'pending').length,
      verified: insertedShops.filter(s => s.verification_status === 'verified').length,
      rejected: insertedShops.filter(s => s.verification_status === 'rejected').length,
      active: insertedShops.filter(s => s.shop_status === 'active').length,
      inactive: insertedShops.filter(s => s.shop_status === 'inactive').length,
      pendingApproval: insertedShops.filter(s => s.shop_status === 'pending_approval').length,
      historyRecords: verificationHistory.length
    };

    logger.info('Shop approval mock data population completed!', summary);

    console.log('\n✅ Shop Approval Mock Data Created Successfully!\n');
    console.log('Summary:');
    console.log(`  Total Shops: ${summary.totalShops}`);
    console.log(`  Pending Verification: ${summary.pending}`);
    console.log(`  Verified: ${summary.verified}`);
    console.log(`  Rejected: ${summary.rejected}`);
    console.log(`  Active: ${summary.active}`);
    console.log(`  Inactive: ${summary.inactive}`);
    console.log(`  Pending Approval: ${summary.pendingApproval}`);
    console.log(`  History Records: ${summary.historyRecords}\n`);

    return summary;
  } catch (error) {
    logger.error('Failed to populate shop approval mock data', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

// Run the script
if (require.main === module) {
  populateShopApprovalMockData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    });
}

export { populateShopApprovalMockData };
