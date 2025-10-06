/**
 * Shop Create Test
 * Tests: POST /api/admin/shops
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function runTest() {
  // Login
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test.admin.1759690918@ebeautything.com',
      password: 'TestAdmin123!',
      deviceInfo: { userAgent: 'test', platform: 'CLI', ipAddress: '127.0.0.1' }
    })
  });
  const loginData = await loginRes.json();
  const TOKEN = loginData.data.session.token;

  console.log('✅ Logged in');

  // Test create shop with all required fields
  const createRes = await fetch(`${BASE_URL}/api/admin/shops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      // Basic info
      name: `Test Shop ${Date.now()}`,
      description: 'Created by API test',
      phone_number: '010-1234-5678',
      email: 'testshop@example.com',
      main_category: 'nail',
      sub_categories: ['eyelash'],

      // Address
      address: '서울시 강남구 테헤란로 123',
      detailed_address: '4층',
      postal_code: '06234',
      latitude: 37.5012,
      longitude: 127.0396,

      // Business license
      business_license_number: '123-45-67890',
      business_license_image_url: 'https://example.com/license.jpg',

      // Operating info
      payment_methods: ['card', 'kakao_pay']
    })
  });

  const createData = await createRes.json();
  console.log('Status:', createRes.status);
  console.log('Response:', JSON.stringify(createData, null, 2));

  if ((createRes.status === 200 || createRes.status === 201) && createData.success) {
    console.log('✅ Shop created successfully');
    const SHOP_ID = createData.data.id;

    // Clean up - delete the test shop
    const deleteRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (deleteRes.status === 200) {
      console.log('✅ Test shop cleaned up');
    }

    console.log('✅ TEST PASSED');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
