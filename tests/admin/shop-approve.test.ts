/**
 * Shop Approve Test
 * Tests: PUT /api/admin/shops/:shopId/approve
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

  // Get a pending shop or any shop
  const shopsRes = await fetch(`${BASE_URL}/api/admin/shops?page=1&limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const shopsData = await shopsRes.json();

  if (!shopsData.success || !shopsData.data.shops || shopsData.data.shops.length === 0) {
    console.log('❌ No shops found');
    process.exit(1);
  }

  const SHOP_ID = shopsData.data.shops[0].id;
  const ORIGINAL_STATUS = shopsData.data.shops[0].status;
  console.log(`✅ Testing shop: ${SHOP_ID} (current status: ${ORIGINAL_STATUS})`);

  // Test approve
  const approveRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}/approve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      approved: true,
      notes: 'Approved during API testing'
    })
  });

  const approveData = await approveRes.json();
  console.log('Status:', approveRes.status);
  console.log('Response:', JSON.stringify(approveData, null, 2));

  if (approveRes.status === 200 && approveData.success) {
    console.log('✅ Shop approval endpoint working');
    console.log('✅ TEST PASSED');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
