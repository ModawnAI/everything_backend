/**
 * Shop Delete Test
 * Tests: DELETE /api/admin/shops/:shopId
 * Note: This is likely a soft delete, not a hard delete
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

  // Create a test shop first to delete
  const createRes = await fetch(`${BASE_URL}/api/admin/shops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      name: 'Test Shop for Deletion',
      description: 'This shop will be deleted',
      address: '123 Test St',
      phone: '010-1234-5678',
      category: 'beauty_salon'
    })
  });

  if (createRes.status !== 200 && createRes.status !== 201) {
    console.log('⚠️  Could not create test shop, testing with existing shop');

    // Get any shop
    const shopsRes = await fetch(`${BASE_URL}/api/admin/shops?page=1&limit=1`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const shopsData = await shopsRes.json();

    if (!shopsData.success || !shopsData.data.shops || shopsData.data.shops.length === 0) {
      console.log('❌ No shops found');
      process.exit(1);
    }

    var SHOP_ID = shopsData.data.shops[0].id;
  } else {
    const createData = await createRes.json();
    var SHOP_ID = createData.data.shop.id;
    console.log(`✅ Created test shop: ${SHOP_ID}`);
  }

  // Test delete
  const deleteRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });

  const deleteData = await deleteRes.json();
  console.log('Status:', deleteRes.status);
  console.log('Response:', JSON.stringify(deleteData, null, 2));

  if (deleteRes.status === 200 && deleteData.success) {
    console.log('✅ Shop deleted successfully');
    console.log('✅ TEST PASSED');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
