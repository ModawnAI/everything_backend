/**
 * Test Admin Shops Endpoint
 * Tests GET /api/admin/shops with authentication
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

async function testAdminShopsEndpoint() {
  console.log('🧪 Testing Admin Shops Endpoint\n');
  console.log('=' .repeat(80));

  try {
    // Step 1: Login to get admin token
    console.log('\n📝 Step 1: Admin Login...');
    const loginResponse = await axios.post(`${BACKEND_URL}/api/admin/auth/login`, {
      email: 'superadmin@ebeautything.com',
      password: 'SuperAdmin2025!'
    });

    const { token } = loginResponse.data;
    console.log('✅ Login successful');
    console.log('Token:', token.substring(0, 50) + '...');

    // Step 2: Get shops with token
    console.log('\n📝 Step 2: Getting shops list...');
    console.log('Request: GET /api/admin/shops?page=1&limit=10&sortBy=created_at&sortOrder=desc');

    const shopsResponse = await axios.get(`${BACKEND_URL}/api/admin/shops`, {
      params: {
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('\n✅ Shops retrieved successfully\n');
    console.log('Response structure:', JSON.stringify({
      success: shopsResponse.data.success,
      data: {
        shops: `Array(${shopsResponse.data.data?.shops?.length || 0})`,
        pagination: shopsResponse.data.data?.pagination
      },
      message: shopsResponse.data.message
    }, null, 2));

    if (shopsResponse.data.data?.shops?.length > 0) {
      console.log('\n📋 First Shop Sample:');
      const firstShop = shopsResponse.data.data.shops[0];
      console.log(JSON.stringify({
        id: firstShop.id,
        name: firstShop.name,
        main_category: firstShop.main_category,
        shop_status: firstShop.shop_status,
        verification_status: firstShop.verification_status,
        created_at: firstShop.created_at
      }, null, 2));
    } else {
      console.log('\n⚠️  No shops found in database');
    }

  } catch (error: any) {
    console.error('\n❌ Test Failed\n');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - endpoint might be hanging');
    } else {
      console.error('Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
}

testAdminShopsEndpoint();
