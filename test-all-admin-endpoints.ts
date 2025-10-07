#!/usr/bin/env npx ts-node
/**
 * Comprehensive Admin Endpoint Testing
 * Tests all admin API endpoints from the frontend
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const EMAIL = 'newadmin@ebeautything.com';
const PASSWORD = 'NewAdmin123!';

let TOKEN = '';
let PASSED = 0;
let FAILED = 0;

interface TestResult {
  name: string;
  success: boolean;
  status?: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<any>) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    const result = await fn();
    console.log('✅ PASSED');
    PASSED++;
    results.push({ name, success: true, status: result?.status });
    return result;
  } catch (error: any) {
    console.log(`❌ FAILED - ${error.message}`);
    FAILED++;
    results.push({ name, success: false, error: error.message });
    return null;
  }
}

async function apiCall(method: string, endpoint: string, data?: any, expectedStatus = 200) {
  const headers: any = {
    'Content-Type': 'application/json',
  };

  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  const responseData = await response.json().catch(() => ({}));

  if (response.status !== expectedStatus && response.status < 200 || response.status >= 300) {
    throw new Error(`Expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(responseData).substring(0, 100)}`);
  }

  return { status: response.status, data: responseData };
}

async function runTests() {
  console.log('===================================================================');
  console.log('🧪 Starting Comprehensive Admin Endpoint Testing');
  console.log('===================================================================\n');

  // 1. AUTHENTICATION
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣  AUTHENTICATION ENDPOINTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('Admin Login', async () => {
    const result = await apiCall('POST', '/api/admin/auth/login', {
      email: EMAIL,
      password: PASSWORD,
      deviceInfo: { userAgent: 'test', platform: 'CLI', ipAddress: '127.0.0.1' }
    });
    TOKEN = result.data.data.session.token;
    return result;
  });

  await test('Get CSRF Token', () => apiCall('GET', '/api/admin/auth/csrf'));
  await test('Get Admin Sessions', () => apiCall('GET', '/api/admin/auth/sessions'));

  // 2. SHOP MANAGEMENT
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2️⃣  SHOP MANAGEMENT ENDPOINTS (CRUD)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('Search Shops', () => apiCall('POST', '/api/admin/shop/search', {
    page: 1,
    limit: 10,
    status: ['active']
  }));

  await test('Get All Shops', () => apiCall('GET', '/api/admin/shop?page=1&limit=10'));

  const searchResult = await test('Get First Shop for Testing', async () => {
    return await apiCall('POST', '/api/admin/shop/search', { page: 1, limit: 1 });
  });

  let SHOP_ID: string | null = null;
  if (searchResult?.data?.data?.shops?.[0]?.id) {
    SHOP_ID = searchResult.data.data.shops[0].id;
    console.log(`📌 Using shop ID for tests: ${SHOP_ID}\n`);

    await test('Get Shop by ID', () => apiCall('GET', `/api/admin/shop/${SHOP_ID}`));
    await test('Update Shop', () => apiCall('PUT', `/api/admin/shop/${SHOP_ID}`, {
      name: 'Updated Test Shop'
    }));
    await test('Update Shop Status', () => apiCall('PATCH', `/api/admin/shop/${SHOP_ID}/status`, {
      status: 'active',
      reason: 'Testing'
    }));
    await test('Get Shop Settings', () => apiCall('GET', `/api/admin/shop/${SHOP_ID}/settings`));
    await test('Shop Health Check', () => apiCall('POST', '/api/admin/shop/health-check', {
      shopId: SHOP_ID
    }));
  } else {
    console.log('⚠️  No shops found, skipping shop-specific tests\n');
  }

  await test('Create New Shop', () => apiCall('POST', '/api/admin/shop', {
    name: 'Test Shop',
    address: '123 Test St',
    main_category: 'hair',
    phone_number: '010-1234-5678',
    email: 'testshop@example.com'
  }, 201));

  await test('Get Shop Categories', () => apiCall('GET', '/api/admin/shop/categories'));
  await test('Get Shop Overview', () => apiCall('POST', '/api/admin/shop/overview', {}));
  await test('Get Shop Statistics', () => apiCall('POST', '/api/admin/shop/statistics', {}));

  // 3. SHOP SERVICES
  if (SHOP_ID) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣  SHOP SERVICE ENDPOINTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await test('Get Shop Services', () => apiCall('GET', `/api/admin/shops/${SHOP_ID}/services`));

    const createServiceResult = await test('Create Shop Service', () => apiCall('POST', `/api/admin/shops/${SHOP_ID}/services`, {
      name: 'Test Service',
      description: 'A test service',
      price: 50000,
      duration: 60,
      category: 'hair'
    }, 201));

    if (createServiceResult?.data?.data?.id) {
      const SERVICE_ID = createServiceResult.data.data.id;
      await test('Get Service by ID', () => apiCall('GET', `/api/admin/shops/${SHOP_ID}/services/${SERVICE_ID}`));
      await test('Update Service', () => apiCall('PUT', `/api/admin/shops/${SHOP_ID}/services/${SERVICE_ID}`, {
        price: 60000
      }));
      await test('Delete Service', () => apiCall('DELETE', `/api/admin/shops/${SHOP_ID}/services/${SERVICE_ID}`));
    }
  }

  // 4. PAYMENT ENDPOINTS
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4️⃣  PAYMENT ENDPOINTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('Get Payment Transactions', () => apiCall('GET', '/admin/payments/transactions?page=1&limit=10'));
  await test('Get Payment Analytics', () => apiCall('GET', '/admin/payments/analytics'));
  await test('Get Payment Configurations', () => apiCall('GET', '/admin/payments/configurations'));
  await test('Get Refunds List', () => apiCall('GET', '/admin/payments/refunds?page=1&limit=10'));
  await test('Get Settlements List', () => apiCall('GET', '/admin/payments/settlements?page=1&limit=10'));

  // 5. RESERVATION ENDPOINTS
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5️⃣  RESERVATION ENDPOINTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('Get Reservations List', () => apiCall('GET', '/admin/reservations?page=1&limit=10'));
  await test('Get Reservation Statistics', () => apiCall('GET', '/admin/reservations/statistics'));
  await test('Get Reservation Services', () => apiCall('GET', '/admin/reservations/services'));
  await test('Get Reservation Staff', () => apiCall('GET', '/admin/reservations/staff'));

  // 6. USER MANAGEMENT
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('6️⃣  USER MANAGEMENT ENDPOINTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('Get Users List', () => apiCall('GET', '/api/admin/users?page=1&limit=10'));

  // 7. ANALYTICS & DASHBOARD
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('7️⃣  ANALYTICS & DASHBOARD ENDPOINTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('Get Dashboard Analytics', () => apiCall('GET', '/api/admin/analytics/dashboard'));

  // 8. SHOP APPROVAL
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('8️⃣  SHOP APPROVAL ENDPOINTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('Get Pending Shop Approvals', () => apiCall('GET', '/api/admin/shops/approval/pending?page=1&limit=10'));

  // SUMMARY
  console.log('\n===================================================================');
  console.log('📊 TEST SUMMARY');
  console.log('===================================================================');
  console.log(`✅ Passed: ${PASSED}`);
  console.log(`❌ Failed: ${FAILED}`);
  console.log(`📝 Total Tests: ${PASSED + FAILED}\n`);

  if (FAILED > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
  }

  process.exit(FAILED > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
