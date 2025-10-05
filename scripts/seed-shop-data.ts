/**
 * Seed Shop Data Script
 *
 * Adds initial shop data to Supabase database for development
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const shopData = {
  id: 'ffa1478d-ae03-4034-bf19-5ded5d3e8867',
  name: 'Everything Beauty',
  description: '모든 뷰티 서비스를 한곳에서 - 네일, 속눈썹, 왁싱, 헤어까지',
  address: '서울시 강남구 논현로 123',
  latitude: 37.5172,
  longitude: 127.0473,
  phone_number: '02-1111-2222',
  email: 'info@everythingbeauty.com',
  main_category: 'nail',
  sub_categories: ['nail', 'eyelash', 'waxing', 'hair'],
  shop_type: 'partnered',
  shop_status: 'active',
  is_featured: true,
  featured_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  total_bookings: 3450,
  commission_rate: 12.0,
  payment_methods: ['toss_payments', 'kakao_pay', 'naver_pay'],
  business_license_number: 'BL-2024-000',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

async function seedShopData() {
  try {
    console.log('🌱 Starting shop data seeding...');

    // Check if shop already exists
    const { data: existingShop, error: checkError } = await supabase
      .from('shops')
      .select('id')
      .eq('id', shopData.id)
      .single();

    if (existingShop) {
      console.log('✅ Shop already exists with ID:', shopData.id);
      return;
    }

    // Insert shop data
    const { data, error } = await supabase
      .from('shops')
      .insert([shopData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting shop:', error);
      return;
    }

    console.log('✅ Shop created successfully:', data);

    // Add shop services
    const services = [
      {
        shop_id: shopData.id,
        name: '젤네일',
        category: 'nail',
        price_min: 30000,
        price_max: 50000,
        duration: 90,
        is_available: true
      },
      {
        shop_id: shopData.id,
        name: '속눈썹 연장',
        category: 'eyelash',
        price_min: 80000,
        price_max: 120000,
        duration: 150,
        is_available: true
      },
      {
        shop_id: shopData.id,
        name: '전신 왁싱',
        category: 'waxing',
        price_min: 150000,
        price_max: 200000,
        duration: 180,
        is_available: true
      },
      {
        shop_id: shopData.id,
        name: '헤어컷 & 스타일링',
        category: 'hair',
        price_min: 35000,
        price_max: 65000,
        duration: 90,
        is_available: true
      }
    ];

    const { data: servicesData, error: servicesError } = await supabase
      .from('shop_services')
      .insert(services)
      .select();

    if (servicesError) {
      console.error('❌ Error inserting services:', servicesError);
      return;
    }

    console.log(`✅ ${servicesData.length} services added successfully`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    console.log('🏁 Seeding complete');
    process.exit(0);
  }
}

seedShopData();