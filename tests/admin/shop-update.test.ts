/**
 * Shop Update Test
 * Tests: PUT /api/admin/shops/:shopId
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function runTest() {
  // Login first
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

  console.log('Login response:', JSON.stringify(loginData, null, 2));

  if (!loginData || !loginData.success || !loginData.data || !loginData.data.session) {
    console.log('❌ LOGIN FAILED - unexpected response structure');
    process.exit(1);
  }

  const TOKEN = loginData.data.session.token;

  console.log('✅ Logged in');

  // Get first shop ID
  const shopsRes = await fetch(`${BASE_URL}/api/admin/shops?page=1&limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const shopsData = await shopsRes.json();

  if (!shopsData.success || !shopsData.data.shops || shopsData.data.shops.length === 0) {
    console.log('❌ No shops found to test update');
    process.exit(1);
  }

  const SHOP_ID = shopsData.data.shops[0].id;
  const ORIGINAL_NAME = shopsData.data.shops[0].name;
  console.log(`✅ Found shop: ${SHOP_ID} - "${ORIGINAL_NAME}"`);

  // Test update
  const updateRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      name: `${ORIGINAL_NAME} (Test Updated)`,
      description: 'Updated by admin API test'
    })
  });

  const updateData = await updateRes.json();
  console.log('Status:', updateRes.status);
  console.log('Response:', JSON.stringify(updateData, null, 2));

  if (updateRes.status === 200 && updateData.success) {
    console.log('✅ Shop updated successfully');

    // Verify update
    const verifyRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const verifyData = await verifyRes.json();

    if (verifyData.data.shop.name.includes('Test Updated')) {
      console.log('✅ Update verified');

      // Revert changes
      const revertRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          name: ORIGINAL_NAME
        })
      });

      if (revertRes.status === 200) {
        console.log('✅ Changes reverted');
        console.log('✅ TEST PASSED');
        process.exit(0);
      }
    }
  }

  console.log('❌ TEST FAILED');
  process.exit(1);
}

runTest();
