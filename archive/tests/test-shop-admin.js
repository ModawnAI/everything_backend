const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  email: 'shopowner@test.com',
  password: 'Test1234!',
  deviceId: 'test-device-automated'
};

let authToken = null;
let refreshToken = null;
let shopId = null;
let shopOwnerId = null;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(type, message, data = null) {
  const timestamp = new Date().toISOString();
  const icons = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    test: `${colors.cyan}▶${colors.reset}`
  };

  console.log(`\n${icons[type] || icons.info} [${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function section(title) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log('='.repeat(80));
}

async function test(name, fn) {
  log('test', `Testing: ${name}`);
  try {
    const result = await fn();
    log('success', `PASSED: ${name}`);
    return { success: true, name, result };
  } catch (error) {
    log('error', `FAILED: ${name}`, {
      message: error.message,
      response: error.response?.data
    });
    return { success: false, name, error: error.message };
  }
}

// Test 1: Shop Owner Login
async function testShopOwnerLogin() {
  const response = await axios.post(`${BASE_URL}/api/shop-owner/auth/login`, TEST_CREDENTIALS);

  if (!response.data.success) {
    throw new Error('Login failed');
  }

  authToken = response.data.data.token;
  refreshToken = response.data.data.refreshToken;
  shopId = response.data.data.shopOwner.shop.id;
  shopOwnerId = response.data.data.shopOwner.id;

  return {
    authenticated: true,
    shopId,
    shopOwnerId,
    shopName: response.data.data.shopOwner.shop.name,
    expiresAt: response.data.data.expiresAt
  };
}

// Test 2: Dashboard Data
async function testDashboard() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/dashboard`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return response.data.data;
}

// Test 3: Get Reservations
async function testGetReservations() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/reservations`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return {
    totalReservations: response.data.data.reservations?.length || 0,
    reservations: response.data.data.reservations || []
  };
}

// Test 4: Get Pending Reservations
async function testGetPendingReservations() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/reservations/pending`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return {
    pendingCount: response.data.data.reservations?.length || 0,
    reservations: response.data.data.reservations || []
  };
}

// Test 5: Get Customers
async function testGetCustomers() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/customers`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return {
    totalCustomers: response.data.data.customers?.length || 0,
    customers: response.data.data.customers || []
  };
}

// Test 6: Get Customer Stats
async function testGetCustomerStats() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/customers/stats`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return response.data.data;
}

// Test 7: Get Shop Profile
async function testGetShopProfile() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/shops/${shopId}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return response.data.data;
}

// Test 8: Get Analytics
async function testGetAnalytics() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/analytics`, {
    headers: { Authorization: `Bearer ${authToken}` },
    params: { period: 'month' }
  });

  return response.data.data;
}

// Test 9: Get Payments
async function testGetPayments() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/payments`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return {
    totalPayments: response.data.data.payments?.length || 0,
    payments: response.data.data.payments || []
  };
}

// Test 10: Get Operating Hours
async function testGetOperatingHours() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/shops/${shopId}/operating-hours`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return response.data.data;
}

// Test 11: Token Refresh
async function testTokenRefresh() {
  const response = await axios.post(`${BASE_URL}/api/shop-owner/auth/refresh`, {}, {
    headers: { Authorization: `Bearer ${refreshToken}` }
  });

  const newToken = response.data.data.accessToken;

  return {
    refreshed: true,
    newTokenLength: newToken.length,
    expiresIn: response.data.data.expiresIn
  };
}

// Test 12: Get Profile
async function testGetProfile() {
  const response = await axios.get(`${BASE_URL}/api/shop-owner/auth/profile`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return response.data.data;
}

async function main() {
  section('SHOP ADMIN SYSTEM - COMPREHENSIVE TEST SUITE');

  console.log('\nTest Environment:');
  console.log(`  Backend URL: ${BASE_URL}`);
  console.log(`  Test Account: ${TEST_CREDENTIALS.email}`);
  console.log(`  Device ID: ${TEST_CREDENTIALS.deviceId}`);

  const results = [];

  // Authentication Tests
  section('1. AUTHENTICATION TESTS');
  results.push(await test('1.1 Shop Owner Login', testShopOwnerLogin));
  results.push(await test('1.2 Get Shop Owner Profile', testGetProfile));
  results.push(await test('1.3 Token Refresh', testTokenRefresh));

  // Dashboard Tests
  section('2. DASHBOARD TESTS');
  results.push(await test('2.1 Load Dashboard Data', testDashboard));

  // Reservation Tests
  section('3. RESERVATION MANAGEMENT TESTS');
  results.push(await test('3.1 Get All Reservations', testGetReservations));
  results.push(await test('3.2 Get Pending Reservations', testGetPendingReservations));

  // Customer Tests
  section('4. CUSTOMER MANAGEMENT TESTS');
  results.push(await test('4.1 Get Customer List', testGetCustomers));
  results.push(await test('4.2 Get Customer Statistics', testGetCustomerStats));

  // Shop Profile Tests
  section('5. SHOP PROFILE TESTS');
  results.push(await test('5.1 Get Shop Profile', testGetShopProfile));
  results.push(await test('5.2 Get Operating Hours', testGetOperatingHours));

  // Analytics Tests
  section('6. ANALYTICS TESTS');
  results.push(await test('6.1 Get Analytics Data', testGetAnalytics));

  // Payment Tests
  section('7. PAYMENT TESTS');
  results.push(await test('7.1 Get Payment History', testGetPayments));

  // Summary
  section('TEST SUMMARY');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`${colors.green}✓ Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${failed}${colors.reset}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);

  if (failed > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  section('TEST CREDENTIALS & INFO');
  console.log('\nShop Owner Login:');
  console.log(`  Email:    ${TEST_CREDENTIALS.email}`);
  console.log(`  Password: ${TEST_CREDENTIALS.password}`);
  console.log(`  Shop ID:  ${shopId}`);
  console.log(`  Owner ID: ${shopOwnerId}`);
  console.log('\nShop Admin URL:');
  console.log(`  http://localhost:3002/login`);
  console.log('\nMobile App URL:');
  console.log(`  http://localhost:3000`);

  console.log('\n' + '='.repeat(80) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n❌ Test suite failed with error:', error);
  process.exit(1);
});
