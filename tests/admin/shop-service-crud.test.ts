/**
 * Shop Service CRUD Test
 * Tests:
 * - POST /api/admin/shops/:shopId/services
 * - PUT /api/admin/shops/:shopId/services/:serviceId
 * - DELETE /api/admin/shops/:shopId/services/:serviceId
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

  // Get a shop
  const shopsRes = await fetch(`${BASE_URL}/api/admin/shops?page=1&limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const shopsData = await shopsRes.json();

  if (!shopsData.success || !shopsData.data.shops || shopsData.data.shops.length === 0) {
    console.log('❌ No shops found');
    process.exit(1);
  }

  const SHOP_ID = shopsData.data.shops[0].id;
  console.log(`✅ Testing with shop: ${SHOP_ID}`);

  // TEST 1: Create service
  console.log('\n=== TEST 1: CREATE SERVICE ===');
  const createRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}/services`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      name: `Test Service ${Date.now()}`,
      description: 'Created by API test',
      price: 50000,
      duration_minutes: 60,
      category: 'nail'
    })
  });

  const createData = await createRes.json();
  console.log('Status:', createRes.status);
  console.log('Response:', JSON.stringify(createData, null, 2));

  if ((createRes.status === 200 || createRes.status === 201) && createData.success) {
    console.log('✅ Service created successfully');
    const SERVICE_ID = createData.data.id || createData.data.service?.id;

    if (!SERVICE_ID) {
      console.log('❌ Service ID not found in response');
      process.exit(1);
    }

    // TEST 2: Update service
    console.log('\n=== TEST 2: UPDATE SERVICE ===');
    const updateRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}/services/${SERVICE_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        name: `Test Service ${Date.now()} (Updated)`,
        price: 60000
      })
    });

    const updateData = await updateRes.json();
    console.log('Status:', updateRes.status);
    console.log('Response:', JSON.stringify(updateData, null, 2));

    if (updateRes.status === 200 && updateData.success) {
      console.log('✅ Service updated successfully');

      // TEST 3: Delete service
      console.log('\n=== TEST 3: DELETE SERVICE ===');
      const deleteRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}/services/${SERVICE_ID}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });

      const deleteData = await deleteRes.json();
      console.log('Status:', deleteRes.status);
      console.log('Response:', JSON.stringify(deleteData, null, 2));

      if (deleteRes.status === 200 && deleteData.success) {
        console.log('✅ Service deleted successfully');
        console.log('\n✅ ALL TESTS PASSED');
        process.exit(0);
      } else {
        console.log('❌ DELETE TEST FAILED');
        process.exit(1);
      }
    } else {
      console.log('❌ UPDATE TEST FAILED');
      process.exit(1);
    }
  } else {
    console.log('❌ CREATE TEST FAILED');
    process.exit(1);
  }
}

runTest();
