/**
 * Seed Multiple Shops for Admin Dashboard Testing
 *
 * Creates realistic mock shop data with various statuses and categories
 */

import { createClient } from '@supabase/supabase-js';
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

const mockShops = [
  {
    name: '강남 네일 살롱',
    description: '프리미엄 네일아트와 젤네일 전문점입니다. 최신 트렌드를 반영한 디자인과 오랜 경험의 아티스트가 함께합니다.',
    address: '서울특별시 강남구 논현로 123',
    detailed_address: '2층',
    postal_code: '06234',
    latitude: 37.5172,
    longitude: 127.0473,
    phone_number: '02-555-1234',
    email: 'contact@gangnam-nail.com',
    main_category: 'nail',
    sub_categories: ['nail'],
    shop_type: 'partnered',
    shop_status: 'active',
    verification_status: 'verified',
    is_featured: true,
    featured_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    total_bookings: 245,
    commission_rate: 15.00,
    payment_methods: ['card', 'toss_payments', 'kakao_pay'],
    business_license_number: '123-45-67890',
    operating_hours: {
      monday: { open: '10:00', close: '20:00' },
      tuesday: { open: '10:00', close: '20:00' },
      wednesday: { open: '10:00', close: '20:00' },
      thursday: { open: '10:00', close: '20:00' },
      friday: { open: '10:00', close: '21:00' },
      saturday: { open: '10:00', close: '21:00' },
      sunday: { open: '11:00', close: '19:00' }
    }
  },
  {
    name: '홍대 헤어 스튜디오',
    description: '트렌디한 커트와 염색, 펌 전문점. 젊은 감각의 디자이너가 고객님의 스타일을 완성합니다.',
    address: '서울특별시 마포구 와우산로 29길 12',
    detailed_address: '1층',
    postal_code: '04048',
    latitude: 37.5563,
    longitude: 126.9232,
    phone_number: '02-333-5678',
    email: 'info@hongdae-hair.com',
    main_category: 'hair',
    sub_categories: ['hair'],
    shop_type: 'partnered',
    shop_status: 'active',
    verification_status: 'verified',
    is_featured: false,
    total_bookings: 178,
    commission_rate: 12.50,
    payment_methods: ['card', 'toss_payments', 'kakao_pay'],
    business_license_number: '234-56-78901',
    operating_hours: {
      monday: { open: '11:00', close: '21:00' },
      tuesday: { open: '11:00', close: '21:00' },
      wednesday: { open: '11:00', close: '21:00' },
      thursday: { open: '11:00', close: '21:00' },
      friday: { open: '11:00', close: '22:00' },
      saturday: { open: '10:00', close: '22:00' },
      sunday: { open: '10:00', close: '20:00' }
    }
  },
  {
    name: '명동 속눈썹 클리닉',
    description: '자연스러운 속눈썹 연장과 리프팅 전문. 눈 건강을 최우선으로 생각하는 프리미엄 샵입니다.',
    address: '서울특별시 중구 명동길 45',
    detailed_address: '3층 301호',
    postal_code: '04536',
    latitude: 37.5635,
    longitude: 126.9824,
    phone_number: '02-777-9012',
    email: 'booking@myeongdong-lash.com',
    main_category: 'eyelash',
    sub_categories: ['eyelash', 'eyebrow_tattoo'],
    shop_type: 'partnered',
    shop_status: 'active',
    verification_status: 'verified',
    is_featured: true,
    featured_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    total_bookings: 312,
    commission_rate: 18.00,
    payment_methods: ['card', 'toss_payments', 'kakao_pay', 'bank_transfer'],
    business_license_number: '345-67-89012',
    operating_hours: {
      monday: { open: '10:30', close: '19:30' },
      tuesday: { open: '10:30', close: '19:30' },
      wednesday: { open: '10:30', close: '19:30' },
      thursday: { open: '10:30', close: '19:30' },
      friday: { open: '10:30', close: '20:00' },
      saturday: { open: '10:00', close: '20:00' },
      sunday: { open: '11:00', close: '18:00' }
    }
  },
  {
    name: '이태원 스킨케어 센터',
    description: '피부 관리 전문 센터. 개인 피부 타입에 맞춘 맞춤형 케어 프로그램을 제공합니다.',
    address: '서울특별시 용산구 이태원로 234',
    detailed_address: '지하 1층',
    postal_code: '04348',
    latitude: 37.5344,
    longitude: 126.9943,
    phone_number: '02-444-3456',
    email: 'care@itaewon-skin.com',
    main_category: 'waxing',
    sub_categories: ['waxing'],
    shop_type: 'non_partnered',
    shop_status: 'pending_approval',
    verification_status: 'pending',
    is_featured: false,
    total_bookings: 0,
    commission_rate: 10.00,
    payment_methods: ['card', 'toss_payments', 'kakao_pay'],
    business_license_number: '456-78-90123',
    operating_hours: {
      monday: { open: '10:00', close: '20:00' },
      tuesday: { open: '10:00', close: '20:00' },
      wednesday: { open: '10:00', close: '20:00' },
      thursday: { open: '10:00', close: '20:00' },
      friday: { open: '10:00', close: '21:00' },
      saturday: { open: '09:00', close: '21:00' },
      sunday: { open: '09:00', close: '18:00' }
    }
  },
  {
    name: '신촌 마사지 테라피',
    description: '전문 마사지사들이 제공하는 힐링 마사지. 피로회복과 스트레스 해소에 최적화된 프로그램.',
    address: '서울특별시 서대문구 신촌로 89',
    detailed_address: '2층 201호',
    postal_code: '03789',
    latitude: 37.5559,
    longitude: 126.9362,
    phone_number: '02-888-7654',
    email: 'relax@sinchon-massage.com',
    main_category: 'nail',
    sub_categories: ['nail'],
    shop_type: 'partnered',
    shop_status: 'active',
    verification_status: 'verified',
    is_featured: false,
    total_bookings: 156,
    commission_rate: 14.00,
    payment_methods: ['card', 'bank_transfer'],
    business_license_number: '567-89-01234',
    operating_hours: {
      monday: { open: '09:00', close: '22:00' },
      tuesday: { open: '09:00', close: '22:00' },
      wednesday: { open: '09:00', close: '22:00' },
      thursday: { open: '09:00', close: '22:00' },
      friday: { open: '09:00', close: '23:00' },
      saturday: { open: '09:00', close: '23:00' },
      sunday: { open: '10:00', close: '21:00' }
    }
  },
  {
    name: '서초 타투 스튜디오',
    description: '감성 타투와 커버업 전문. 안전하고 위생적인 환경에서 원하시는 디자인을 완성합니다.',
    address: '서울특별시 서초구 서초대로 301',
    detailed_address: '4층',
    postal_code: '06590',
    latitude: 37.4930,
    longitude: 127.0262,
    phone_number: '02-222-3344',
    email: 'art@seocho-tattoo.com',
    main_category: 'waxing',
    sub_categories: ['waxing'],
    shop_type: 'non_partnered',
    shop_status: 'inactive',
    verification_status: 'rejected',
    is_featured: false,
    total_bookings: 45,
    commission_rate: 20.00,
    payment_methods: ['card', 'bank_transfer'],
    business_license_number: '678-90-12345',
    operating_hours: {
      monday: { open: '13:00', close: '21:00' },
      tuesday: { open: '13:00', close: '21:00' },
      wednesday: { open: '13:00', close: '21:00' },
      thursday: { open: '13:00', close: '21:00' },
      friday: { open: '13:00', close: '22:00' },
      saturday: { open: '12:00', close: '22:00' },
      sunday: { open: '12:00', close: '20:00' }
    }
  },
  {
    name: '압구정 종합 뷰티샵',
    description: '네일, 왁싱, 속눈썹 등 다양한 뷰티 서비스를 한 곳에서. VIP 고객을 위한 프리미엄 라운지 운영.',
    address: '서울특별시 강남구 압구정로 456',
    detailed_address: '5층 전관',
    postal_code: '06009',
    latitude: 37.5274,
    longitude: 127.0286,
    phone_number: '02-999-8765',
    email: 'vip@apgujeong-beauty.com',
    main_category: 'nail',
    sub_categories: ['nail', 'eyelash', 'eyebrow_tattoo', 'waxing'],
    shop_type: 'partnered',
    shop_status: 'active',
    verification_status: 'verified',
    is_featured: true,
    featured_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    total_bookings: 489,
    commission_rate: 16.50,
    payment_methods: ['card', 'toss_payments', 'kakao_pay', 'bank_transfer'],
    business_license_number: '789-01-23456',
    operating_hours: {
      monday: { open: '10:00', close: '22:00' },
      tuesday: { open: '10:00', close: '22:00' },
      wednesday: { open: '10:00', close: '22:00' },
      thursday: { open: '10:00', close: '22:00' },
      friday: { open: '10:00', close: '23:00' },
      saturday: { open: '09:00', close: '23:00' },
      sunday: { open: '09:00', close: '21:00' }
    }
  },
  {
    name: '잠실 눈썹 디자인',
    description: '자연스러운 눈썹 문신과 정리 전문. 얼굴형에 어울리는 눈썹 디자인을 제안합니다.',
    address: '서울특별시 송파구 올림픽로 567',
    detailed_address: '2층 205호',
    postal_code: '05505',
    latitude: 37.5134,
    longitude: 127.1025,
    phone_number: '02-111-2233',
    email: 'brow@jamsil-eyebrow.com',
    main_category: 'eyebrow_tattoo',
    sub_categories: ['eyebrow_tattoo', 'eyelash'],
    shop_type: 'partnered',
    shop_status: 'active',
    verification_status: 'verified',
    is_featured: false,
    total_bookings: 203,
    commission_rate: 13.00,
    payment_methods: ['card', 'toss_payments', 'kakao_pay'],
    business_license_number: '890-12-34567',
    operating_hours: {
      monday: { open: '11:00', close: '20:00' },
      tuesday: { open: '11:00', close: '20:00' },
      wednesday: { open: '11:00', close: '20:00' },
      thursday: { open: '11:00', close: '20:00' },
      friday: { open: '11:00', close: '21:00' },
      saturday: { open: '10:00', close: '21:00' },
      sunday: { open: '10:00', close: '19:00' }
    }
  },
  {
    name: '성수 메이크업 스튜디오',
    description: '웨딩 메이크업과 특수 분장 전문. 개인 레슨과 원데이 클래스도 진행합니다.',
    address: '서울특별시 성동구 성수일로 234',
    detailed_address: '3층',
    postal_code: '04780',
    latitude: 37.5445,
    longitude: 127.0557,
    phone_number: '02-666-5544',
    email: 'makeup@seongsu-studio.com',
    main_category: 'hair',
    sub_categories: ['hair'],
    shop_type: 'non_partnered',
    shop_status: 'suspended',
    verification_status: 'verified',
    is_featured: false,
    total_bookings: 87,
    commission_rate: 11.00,
    payment_methods: ['card'],
    business_license_number: '901-23-45678',
    operating_hours: {
      monday: { open: '10:00', close: '19:00' },
      tuesday: { open: '10:00', close: '19:00' },
      wednesday: { open: '10:00', close: '19:00' },
      thursday: { open: '10:00', close: '19:00' },
      friday: { open: '10:00', close: '20:00' },
      saturday: { open: '09:00', close: '20:00' },
      sunday: { open: '09:00', close: '18:00' }
    }
  },
  {
    name: '건대 피어싱샵',
    description: '안전한 피어싱과 쥬얼리 판매. 1회용 기구 사용으로 위생을 최우선으로 합니다.',
    address: '서울특별시 광진구 능동로 345',
    detailed_address: '1층',
    postal_code: '05029',
    latitude: 37.5405,
    longitude: 127.0694,
    phone_number: '02-333-4455',
    email: 'pierce@gundae-piercing.com',
    main_category: 'nail',
    sub_categories: ['nail'],
    shop_type: 'non_partnered',
    shop_status: 'pending_approval',
    verification_status: 'pending',
    is_featured: false,
    total_bookings: 0,
    commission_rate: 10.00,
    payment_methods: ['card', 'bank_transfer'],
    business_license_number: '012-34-56789',
    operating_hours: {
      monday: { open: '12:00', close: '21:00' },
      tuesday: { open: '12:00', close: '21:00' },
      wednesday: { open: '12:00', close: '21:00' },
      thursday: { open: '12:00', close: '21:00' },
      friday: { open: '12:00', close: '22:00' },
      saturday: { open: '11:00', close: '22:00' },
      sunday: { open: '11:00', close: '20:00' }
    }
  }
];

async function seedMultipleShops() {
  try {
    console.log('🌱 Starting multiple shops seeding...\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const shop of mockShops) {
      try {
        // Check if shop already exists by name
        const { data: existingShop } = await supabase
          .from('shops')
          .select('id, name')
          .eq('name', shop.name)
          .maybeSingle();

        if (existingShop) {
          console.log(`⏭️  Skipped: "${shop.name}" (already exists)`);
          skipCount++;
          continue;
        }

        // Insert shop
        const { data: insertedShop, error } = await supabase
          .from('shops')
          .insert([shop])
          .select()
          .single();

        if (error) {
          console.error(`❌ Error creating "${shop.name}":`, error.message);
          errorCount++;
          continue;
        }

        console.log(`✅ Created: "${shop.name}" (${shop.shop_status} / ${shop.verification_status})`);
        successCount++;

        // Add some basic services for active shops
        if (shop.shop_status === 'active' && insertedShop) {
          const services = [
            {
              shop_id: insertedShop.id,
              name: `${shop.main_category === 'nail' ? '젤네일' : shop.main_category === 'hair' ? '헤어컷' : shop.main_category === 'eyelash' ? '속눈썹 연장' : shop.main_category === 'waxing' ? '왁싱' : shop.main_category === 'eyebrow_tattoo' ? '눈썹 문신' : '기본 서비스'}`,
              category: shop.main_category,
              price_min: 30000,
              price_max: 80000,
              duration: 90,
              is_available: true,
              description: '인기있는 기본 서비스입니다.'
            }
          ];

          await supabase
            .from('shop_services')
            .insert(services);
        }

      } catch (err) {
        console.error(`❌ Unexpected error for "${shop.name}":`, err);
        errorCount++;
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   ✅ Created: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total: ${mockShops.length}\n`);

    console.log('🏁 Seeding complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    process.exit(0);
  }
}

seedMultipleShops();
