/**
 * Shop Services Endpoint Test
 * Tests: GET /api/admin/shops/:shopId/services
 *
 * This test verifies that the shop services endpoint correctly:
 * 1. Accepts shopId as a URL parameter
 * 2. Authenticates admin users
 * 3. Returns services for the specified shop
 * 4. Handles invalid shop IDs appropriately
 */

const BASE_URL = 'http://localhost:3001';
const SHOP_ID = 'a5c2e8f1-9b3d-4e6a-8c7d-2f1e3b4c5d6e'; // From test data
let TOKEN = '';

async function login() {
  console.log('🔐 Logging in as admin...');
  const response = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'newadmin@ebeautything.com',
      password: 'NewAdmin123!'
    })
  });

  const data = await response.json();
  if (!data.success || !data.data?.session?.token) {
    throw new Error('Login failed: ' + JSON.stringify(data));
  }

  TOKEN = data.data.session.token;
  console.log('✅ Login successful\n');
}

async function testShopServices() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Testing Shop Services Endpoint');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 1: Valid shop ID should return 200
  console.log('Test 1: GET /api/admin/shops/:shopId/services (valid shop)');
  const response1 = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}/services`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  const data1 = await response1.json();
  console.log(`Status: ${response1.status}`);
  console.log(`Response:`, JSON.stringify(data1, null, 2).substring(0, 500));

  if (response1.status === 200) {
    console.log('✅ Test 1 PASSED: Valid shop ID returns 200\n');
  } else {
    console.log('❌ Test 1 FAILED: Expected 200, got ' + response1.status);
    console.log('Error:', data1);
    throw new Error('Test 1 failed');
  }

  // Test 2: Invalid shop ID should return 404
  console.log('Test 2: GET /api/admin/shops/:shopId/services (invalid shop)');
  const invalidShopId = '00000000-0000-0000-0000-000000000000';
  const response2 = await fetch(`${BASE_URL}/api/admin/shops/${invalidShopId}/services`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  const data2 = await response2.json();
  console.log(`Status: ${response2.status}`);
  console.log(`Response:`, JSON.stringify(data2, null, 2));

  if (response2.status === 404 && data2.error?.code === 'SHOP_NOT_FOUND') {
    console.log('✅ Test 2 PASSED: Invalid shop ID returns 404 with correct error code\n');
  } else {
    console.log('❌ Test 2 FAILED: Expected 404 with SHOP_NOT_FOUND, got ' + response2.status);
    console.log('Error:', data2);
    throw new Error('Test 2 failed');
  }

  // Test 3: No auth token should return 401
  console.log('Test 3: GET /api/admin/shops/:shopId/services (no auth)');
  const response3 = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}/services`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data3 = await response3.json();
  console.log(`Status: ${response3.status}`);
  console.log(`Response:`, JSON.stringify(data3, null, 2));

  if (response3.status === 401 || response3.status === 403) {
    console.log('✅ Test 3 PASSED: No auth returns 401/403\n');
  } else {
    console.log('❌ Test 3 FAILED: Expected 401/403, got ' + response3.status);
    console.log('Error:', data3);
    throw new Error('Test 3 failed');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All Shop Services Tests PASSED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function main() {
  try {
    await login();
    await testShopServices();
    console.log('🎉 Shop services endpoint is working correctly!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
