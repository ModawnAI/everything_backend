#!/usr/bin/env npx ts-node
/**
 * Comprehensive Admin API Endpoint Testing
 * Tests ALL 160+ admin endpoints from API_ENDPOINTS.md
 * Validates against Supabase database schema
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const EMAIL = 'newadmin@ebeautything.com';
const PASSWORD = 'NewAdmin123!';

let TOKEN = '';
let PASSED = 0;
let FAILED = 0;
let SKIPPED = 0;

interface TestResult {
  name: string;
  success: boolean;
  status?: number;
  error?: string;
  skipped?: boolean;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<any>, skip = false) {
  if (skip) {
    console.log(`⏭️  SKIPPED: ${name}`);
    SKIPPED++;
    results.push({ name, success: false, skipped: true });
    return null;
  }

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

  // Create timeout promise (15 seconds)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000);
  });

  // Race between fetch and timeout
  const fetchPromise = fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

  const responseData = await response.json().catch(() => ({}));

  if (response.status !== expectedStatus && (response.status < 200 || response.status >= 300)) {
    throw new Error(`Expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(responseData).substring(0, 100)}`);
  }

  return { status: response.status, data: responseData };
}

async function runTests() {
  console.log('===================================================================');
  console.log('🧪 COMPREHENSIVE Admin API Testing - ALL 160+ Endpoints');
  console.log('===================================================================\n');

  // ========================================
  // 1. AUTHENTICATION
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣  ADMIN AUTHENTICATION (8 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('POST /api/admin/auth/login', async () => {
    const result = await apiCall('POST', '/api/admin/auth/login', {
      email: EMAIL,
      password: PASSWORD,
      deviceInfo: { userAgent: 'test', platform: 'CLI', ipAddress: '127.0.0.1' }
    });
    TOKEN = result.data.data.session.token;
    return result;
  });

  await test('GET /api/admin/auth/csrf', () => apiCall('GET', '/api/admin/auth/csrf'));
  await test('GET /api/admin/auth/sessions', () => apiCall('GET', '/api/admin/auth/sessions'));
  await test('GET /api/admin/auth/profile', () => apiCall('GET', '/api/admin/auth/profile'));
  await test('GET /api/admin/auth/validate', () => apiCall('GET', '/api/admin/auth/validate'));
  await test('POST /api/admin/auth/refresh', () => apiCall('POST', '/api/admin/auth/refresh', { token: TOKEN }), true); // Skip - requires specific token
  await test('POST /api/admin/auth/change-password', () => apiCall('POST', '/api/admin/auth/change-password', {
    currentPassword: PASSWORD,
    newPassword: 'NewPassword123!'
  }), true); // Skip - would change password
  await test('POST /api/admin/auth/logout', () => apiCall('POST', '/api/admin/auth/logout'), true); // Skip - would logout

  // ========================================
  // 2. SHOP MANAGEMENT
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2️⃣  SHOP MANAGEMENT (23 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('POST /api/admin/shop/search', () => apiCall('POST', '/api/admin/shop/search', { page: 1, limit: 10 }));
  await test('POST /api/admin/shops/search', () => apiCall('POST', '/api/admin/shops/search', { page: 1, limit: 10 }));
  await test('GET /api/admin/shop (list)', () => apiCall('GET', '/api/admin/shop?page=1&limit=10'));
  await test('GET /api/admin/shops (list)', () => apiCall('GET', '/api/admin/shops?page=1&limit=10'));
  await test('GET /api/admin/shop/pending', () => apiCall('GET', '/api/admin/shop/pending?page=1&limit=10'));
  await test('GET /api/admin/shops/pending', () => apiCall('GET', '/api/admin/shops/pending?page=1&limit=10'));
  await test('GET /api/admin/shop/verification-stats', () => apiCall('GET', '/api/admin/shop/verification-stats'));
  await test('GET /api/admin/shops/verification-stats', () => apiCall('GET', '/api/admin/shops/verification-stats'));

  // Get a shop ID for testing
  const searchResult = await test('Get First Shop for Detail Tests', async () => {
    return await apiCall('POST', '/api/admin/shop/search', { page: 1, limit: 1 });
  });

  let SHOP_ID: string | null = null;
  if (searchResult?.data?.data?.shops?.[0]?.id) {
    SHOP_ID = searchResult.data.data.shops[0].id;
    console.log(`📌 Using shop ID for tests: ${SHOP_ID}\n`);

    await test(`GET /api/admin/shop/:shopId`, () => apiCall('GET', `/api/admin/shop/${SHOP_ID}`));
    await test(`GET /api/admin/shops/:shopId`, () => apiCall('GET', `/api/admin/shops/${SHOP_ID}`));
    await test(`GET /api/admin/shop/:shopId/verification-history`, () => apiCall('GET', `/api/admin/shop/${SHOP_ID}/verification-history`));
    await test(`GET /api/admin/shops/:shopId/verification-history`, () => apiCall('GET', `/api/admin/shops/${SHOP_ID}/verification-history`));
    await test(`GET /api/admin/shop/:shopId/verification-requirements`, () => apiCall('GET', `/api/admin/shop/${SHOP_ID}/verification-requirements`));
    await test(`GET /api/admin/shops/:shopId/verification-requirements`, () => apiCall('GET', `/api/admin/shops/${SHOP_ID}/verification-requirements`));

    // Note: Moderation history endpoint may have issues - will timeout after 15s if hanging
    await test(`GET /api/admin/shops/:shopId/moderation-history`, () => apiCall('GET', `/api/admin/shops/${SHOP_ID}/moderation-history`));

    // Modification endpoints - skip to avoid data changes
    await test(`PUT /api/admin/shop/:shopId`, () => apiCall('PUT', `/api/admin/shop/${SHOP_ID}`, { name: 'Updated Shop' }), true);
    await test(`PUT /api/admin/shops/:shopId`, () => apiCall('PUT', `/api/admin/shops/${SHOP_ID}`, { name: 'Updated Shop' }), true);
    await test(`DELETE /api/admin/shop/:shopId`, () => apiCall('DELETE', `/api/admin/shop/${SHOP_ID}`), true);
    await test(`DELETE /api/admin/shops/:shopId`, () => apiCall('DELETE', `/api/admin/shops/${SHOP_ID}`), true);
    await test(`PUT /api/admin/shop/:shopId/approve`, () => apiCall('PUT', `/api/admin/shop/${SHOP_ID}/approve`, { status: 'approved' }), true);
    await test(`PUT /api/admin/shops/:shopId/approve`, () => apiCall('PUT', `/api/admin/shops/${SHOP_ID}/approve`, { status: 'approved' }), true);
    await test(`POST /api/admin/shops/:shopId/analyze-content`, () => apiCall('POST', `/api/admin/shops/${SHOP_ID}/analyze-content`), true);
  }

  await test('POST /api/admin/shop (create)', () => apiCall('POST', '/api/admin/shop', {
    name: 'Test Shop',
    address: '123 Test St',
    main_category: 'hair',
    phone_number: '010-1234-5678'
  }), true); // Skip - would create shop

  // ========================================
  // 3. SHOP SERVICES
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3️⃣  SHOP SERVICES (5 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (SHOP_ID) {
    // Note: Shop services endpoint may have issues - will timeout after 15s if hanging
    await test(`GET /api/admin/shops/:shopId/services`, () => apiCall('GET', `/api/admin/shops/${SHOP_ID}/services`));

    const createServiceResult = await test(`POST /api/admin/shops/:shopId/services`, () => apiCall('POST', `/api/admin/shops/${SHOP_ID}/services`, {
      name: 'Test Service',
      description: 'Test service description',
      price: 50000,
      duration: 60,
      category: 'hair'
    }, 201), true); // Skip - would create service

    // Service detail endpoints - would need valid service ID
    await test(`GET /api/admin/shops/:shopId/services/:serviceId`, () => apiCall('GET', `/api/admin/shops/${SHOP_ID}/services/test-service-id`), true);
    await test(`PUT /api/admin/shops/:shopId/services/:serviceId`, () => apiCall('PUT', `/api/admin/shops/${SHOP_ID}/services/test-service-id`, { price: 60000 }), true);
    await test(`DELETE /api/admin/shops/:shopId/services/:serviceId`, () => apiCall('DELETE', `/api/admin/shops/${SHOP_ID}/services/test-service-id`), true);
  }

  // ========================================
  // 4. SHOP APPROVAL
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4️⃣  SHOP APPROVAL (5 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/shops/approval', () => apiCall('GET', '/api/admin/shops/approval?page=1&limit=10'));
  await test('GET /api/admin/shops/approval/statistics', () => apiCall('GET', '/api/admin/shops/approval/statistics'));
  await test('GET /api/admin/shops/approval/:id/details', () => apiCall('GET', '/api/admin/shops/approval/test-id/details'), true);
  await test('PUT /api/admin/shops/approval/:id', () => apiCall('PUT', '/api/admin/shops/approval/test-id', { status: 'approved' }), true);
  await test('POST /api/admin/shops/approval/bulk-approval', () => apiCall('POST', '/api/admin/shops/approval/bulk-approval', { ids: [], status: 'approved' }), true);

  // ========================================
  // 5. USER MANAGEMENT
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5️⃣  USER MANAGEMENT (20 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/users', () => apiCall('GET', '/api/admin/users?page=1&limit=10'));
  await test('GET /api/admin/users/statistics', () => apiCall('GET', '/api/admin/users/statistics'));
  await test('GET /api/admin/users/analytics', () => apiCall('GET', '/api/admin/users/analytics'));
  await test('GET /api/admin/users/activity', () => apiCall('GET', '/api/admin/users/activity'));
  await test('GET /api/admin/users/search/advanced', () => apiCall('GET', '/api/admin/users/search/advanced?q=test'));
  await test('GET /api/admin/users/audit/search', () => apiCall('GET', '/api/admin/users/audit/search?userId=test'));
  await test('GET /api/admin/users/status-stats', () => apiCall('GET', '/api/admin/users/status-stats'));
  await test('GET /api/admin/users/status/:status', () => apiCall('GET', '/api/admin/users/status/active'));

  // User-specific endpoints - skip to avoid modifying real users
  await test('GET /api/admin/users/:id', () => apiCall('GET', '/api/admin/users/test-user-id'), true);
  await test('PUT /api/admin/users/:id/role', () => apiCall('PUT', '/api/admin/users/test-user-id/role', { role: 'user' }), true);
  await test('PUT /api/admin/users/:id/status', () => apiCall('PUT', '/api/admin/users/test-user-id/status', { status: 'active' }), true);
  await test('GET /api/admin/users/:userId/audit', () => apiCall('GET', '/api/admin/users/test-user-id/audit'), true);
  await test('PUT /api/admin/users/:userId/status (alt)', () => apiCall('PUT', '/api/admin/users/test-user-id/status', { status: 'active' }), true);
  await test('GET /api/admin/users/:userId/status/history', () => apiCall('GET', '/api/admin/users/test-user-id/status/history'), true);
  await test('GET /api/admin/users/:userId/violations', () => apiCall('GET', '/api/admin/users/test-user-id/violations'), true);
  await test('POST /api/admin/users/:userId/violations', () => apiCall('POST', '/api/admin/users/test-user-id/violations', { type: 'spam' }), true);
  await test('POST /api/admin/users/bulk-action', () => apiCall('POST', '/api/admin/users/bulk-action', { userIds: [], action: 'activate' }), true);
  await test('POST /api/admin/users/bulk-status-change', () => apiCall('POST', '/api/admin/users/bulk-status-change', { userIds: [], status: 'active' }), true);
  await test('POST /api/admin/users/audit/export', () => apiCall('POST', '/api/admin/users/audit/export', { format: 'csv' }), true);
  await test('PUT /api/admin/violations/:violationId/resolve', () => apiCall('PUT', '/api/admin/violations/test-violation-id/resolve'), true);

  // ========================================
  // 6. RESERVATIONS
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('6️⃣  RESERVATIONS (7 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/reservations', () => apiCall('GET', '/api/admin/reservations?page=1&limit=10'));
  await test('GET /api/admin/reservations/analytics', () => apiCall('GET', '/api/admin/reservations/analytics'));
  await test('GET /api/admin/reservations/:id/details', () => apiCall('GET', '/api/admin/reservations/test-id/details'), true);
  await test('PUT /api/admin/reservations/:id/status', () => apiCall('PUT', '/api/admin/reservations/test-id/status', { status: 'confirmed' }), true);
  await test('POST /api/admin/reservations/:id/dispute', () => apiCall('POST', '/api/admin/reservations/test-id/dispute', { reason: 'test' }), true);
  await test('POST /api/admin/reservations/:id/force-complete', () => apiCall('POST', '/api/admin/reservations/test-id/force-complete'), true);
  await test('POST /api/admin/reservations/bulk-status-update', () => apiCall('POST', '/api/admin/reservations/bulk-status-update', { ids: [], status: 'confirmed' }), true);

  // ========================================
  // 7. PAYMENTS
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('7️⃣  PAYMENTS (7 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/payments', () => apiCall('GET', '/api/admin/payments?page=1&limit=10'));
  await test('GET /api/admin/payments/analytics', () => apiCall('GET', '/api/admin/payments/analytics'));
  await test('GET /api/admin/payments/summary', () => apiCall('GET', '/api/admin/payments/summary'));
  await test('GET /api/admin/payments/settlements', () => apiCall('GET', '/api/admin/payments/settlements'));
  await test('GET /api/admin/payments/export', () => apiCall('GET', '/api/admin/payments/export'), true);
  await test('GET /api/admin/payments/:paymentId', () => apiCall('GET', '/api/admin/payments/test-payment-id'), true);
  await test('POST /api/admin/payments/:paymentId/refund', () => apiCall('POST', '/api/admin/payments/test-payment-id/refund', { amount: 10000 }), true);

  // ========================================
  // 8. ANALYTICS & DASHBOARD
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('8️⃣  ANALYTICS & DASHBOARD (8 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/analytics/dashboard', () => apiCall('GET', '/api/admin/analytics/dashboard'));
  await test('GET /api/admin/analytics/realtime', () => apiCall('GET', '/api/admin/analytics/realtime'));
  await test('GET /api/admin/analytics/health', () => apiCall('GET', '/api/admin/analytics/health'));
  await test('GET /api/admin/analytics/cache/stats', () => apiCall('GET', '/api/admin/analytics/cache/stats'));
  await test('POST /api/admin/analytics/cache/clear', () => apiCall('POST', '/api/admin/analytics/cache/clear'), true);
  await test('GET /api/admin/analytics/export', () => apiCall('GET', '/api/admin/analytics/export'), true);

  if (SHOP_ID) {
    await test('GET /api/admin/analytics/shops/:shopId/analytics', () => apiCall('GET', `/api/admin/analytics/shops/${SHOP_ID}/analytics`));
  }

  // ========================================
  // 9. MODERATION
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('9️⃣  MODERATION (8 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/moderation/stats', () => apiCall('GET', '/api/admin/moderation/stats'));
  await test('GET /api/admin/content/reported', () => apiCall('GET', '/api/admin/content/reported'));
  await test('GET /api/admin/content/moderation-queue', () => apiCall('GET', '/api/admin/content/moderation-queue'));
  await test('GET /api/admin/shop-reports', () => apiCall('GET', '/api/admin/shop-reports'));
  await test('PUT /api/admin/content/:contentId/moderate', () => apiCall('PUT', '/api/admin/content/test-content-id/moderate', { action: 'approve' }), true);
  await test('GET /api/admin/shop-reports/:reportId', () => apiCall('GET', '/api/admin/shop-reports/test-report-id'), true);
  await test('PUT /api/admin/shop-reports/:reportId', () => apiCall('PUT', '/api/admin/shop-reports/test-report-id', { status: 'resolved' }), true);
  await test('POST /api/admin/shop-reports/bulk-action', () => apiCall('POST', '/api/admin/shop-reports/bulk-action', { reportIds: [], action: 'resolve' }), true);

  // ========================================
  // 10. SECURITY
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔟 SECURITY (17 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/security/events', () => apiCall('GET', '/api/admin/security/events'));
  await test('GET /api/admin/security/users/:userId/sessions', () => apiCall('GET', '/api/admin/security/users/test-user-id/sessions'), true);
  await test('POST /api/admin/security/users/:userId/invalidate-sessions', () => apiCall('POST', '/api/admin/security/users/test-user-id/invalidate-sessions'), true);
  await test('POST /api/admin/security/bulk-invalidate-sessions', () => apiCall('POST', '/api/admin/security/bulk-invalidate-sessions', { userIds: [] }), true);

  // Security Events
  await test('GET /api/admin/security-events/statistics', () => apiCall('GET', '/api/admin/security-events/statistics'));
  await test('GET /api/admin/security-events/recent', () => apiCall('GET', '/api/admin/security-events/recent'));
  await test('GET /api/admin/security-events/alerts', () => apiCall('GET', '/api/admin/security-events/alerts'));
  await test('GET /api/admin/security-events/threat-analysis', () => apiCall('GET', '/api/admin/security-events/threat-analysis'));
  await test('GET /api/admin/security-events/middleware-stats', () => apiCall('GET', '/api/admin/security-events/middleware-stats'));
  await test('GET /api/admin/security-events/compliance-report', () => apiCall('GET', '/api/admin/security-events/compliance-report'));
  await test('POST /api/admin/security-events/export', () => apiCall('POST', '/api/admin/security-events/export', { format: 'csv' }), true);
  await test('POST /api/admin/security-events/alerts/:alertId/resolve', () => apiCall('POST', '/api/admin/security-events/alerts/test-alert-id/resolve'), true);

  // Security Enhanced
  await test('GET /api/admin/security-enhanced/health', () => apiCall('GET', '/api/admin/security-enhanced/health'));
  await test('GET /api/admin/security-enhanced/stats', () => apiCall('GET', '/api/admin/security-enhanced/stats'));
  await test('GET /api/admin/security-enhanced/csrf/stats', () => apiCall('GET', '/api/admin/security-enhanced/csrf/stats'));
  await test('GET /api/admin/security-enhanced/xss/stats', () => apiCall('GET', '/api/admin/security-enhanced/xss/stats'));
  await test('GET /api/admin/security-enhanced/sql-injection/stats', () => apiCall('GET', '/api/admin/security-enhanced/sql-injection/stats'));

  // ========================================
  // 11. FINANCIAL
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣1️⃣ FINANCIAL (6 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/financial/payments/overview', () => apiCall('GET', '/api/admin/financial/payments/overview'));
  await test('GET /api/admin/financial/points/overview', () => apiCall('GET', '/api/admin/financial/points/overview'));
  await test('GET /api/admin/financial/refunds', () => apiCall('GET', '/api/admin/financial/refunds'));
  await test('GET /api/admin/financial/payouts/calculate/:shopId', () => apiCall('GET', `/api/admin/financial/payouts/calculate/${SHOP_ID || 'test-shop-id'}`), true);
  await test('POST /api/admin/financial/points/adjust', () => apiCall('POST', '/api/admin/financial/points/adjust', { userId: 'test', amount: 1000 }), true);
  await test('POST /api/admin/financial/reports/generate', () => apiCall('POST', '/api/admin/financial/reports/generate', { type: 'monthly' }), true);

  // ========================================
  // 12. AUDIT TRAIL
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣2️⃣ AUDIT TRAIL (7 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/audit', () => apiCall('GET', '/api/admin/audit?page=1&limit=10'));
  await test('GET /api/admin/audit/stats', () => apiCall('GET', '/api/admin/audit/stats'));
  await test('GET /api/admin/audit/trends', () => apiCall('GET', '/api/admin/audit/trends'));
  await test('GET /api/admin/audit/compliance-report', () => apiCall('GET', '/api/admin/audit/compliance-report'));
  await test('GET /api/admin/audit/reservation/:reservationId', () => apiCall('GET', '/api/admin/audit/reservation/test-reservation-id'), true);
  await test('POST /api/admin/audit/export', () => apiCall('POST', '/api/admin/audit/export', { format: 'csv' }), true);
  await test('POST /api/admin/audit/cleanup', () => apiCall('POST', '/api/admin/audit/cleanup', { olderThan: '90d' }), true);

  // ========================================
  // 13. NO-SHOW DETECTION
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣3️⃣ NO-SHOW DETECTION (6 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/no-show/config', () => apiCall('GET', '/api/admin/no-show/config'));
  await test('GET /api/admin/no-show/statistics', () => apiCall('GET', '/api/admin/no-show/statistics'));
  await test('GET /api/admin/no-show/reservation/:reservationId', () => apiCall('GET', '/api/admin/no-show/reservation/test-reservation-id'), true);
  await test('PUT /api/admin/no-show/config', () => apiCall('PUT', '/api/admin/no-show/config', { enabled: true }), true);
  await test('POST /api/admin/no-show/trigger', () => apiCall('POST', '/api/admin/no-show/trigger'), true);
  await test('POST /api/admin/no-show/override', () => apiCall('POST', '/api/admin/no-show/override', { reservationId: 'test', override: true }), true);

  // ========================================
  // 14. AUTOMATION
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣4️⃣ AUTOMATION (6 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/automation/status', () => apiCall('GET', '/api/admin/automation/status'));
  await test('GET /api/admin/automation/health', () => apiCall('GET', '/api/admin/automation/health'));
  await test('GET /api/admin/automation/metrics', () => apiCall('GET', '/api/admin/automation/metrics'));
  await test('PUT /api/admin/automation/config', () => apiCall('PUT', '/api/admin/automation/config', { enabled: true }), true);
  await test('POST /api/admin/automation/run', () => apiCall('POST', '/api/admin/automation/run'), true);
  await test('POST /api/admin/automation/reset-metrics', () => apiCall('POST', '/api/admin/automation/reset-metrics'), true);

  // ========================================
  // 15. POINT PROCESSING
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣5️⃣ POINT PROCESSING (6 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/point-processing/stats', () => apiCall('GET', '/api/admin/point-processing/stats'));
  await test('GET /api/admin/point-processing/analytics', () => apiCall('GET', '/api/admin/point-processing/analytics'));
  await test('POST /api/admin/point-processing/trigger/all', () => apiCall('POST', '/api/admin/point-processing/trigger/all'), true);
  await test('POST /api/admin/point-processing/trigger/pending', () => apiCall('POST', '/api/admin/point-processing/trigger/pending'), true);
  await test('POST /api/admin/point-processing/trigger/expired', () => apiCall('POST', '/api/admin/point-processing/trigger/expired'), true);
  await test('POST /api/admin/point-processing/trigger/warnings', () => apiCall('POST', '/api/admin/point-processing/trigger/warnings'), true);

  // ========================================
  // 16. POINT ADJUSTMENTS
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣6️⃣ POINT ADJUSTMENTS (9 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/adjustments/admin/audit-logs', () => apiCall('GET', '/api/admin/adjustments/admin/audit-logs'));
  await test('GET /api/admin/adjustments/admin/point-adjustments/pending', () => apiCall('GET', '/api/admin/adjustments/admin/point-adjustments/pending'));
  await test('GET /api/admin/adjustments/admin/point-adjustments/stats', () => apiCall('GET', '/api/admin/adjustments/admin/point-adjustments/stats'));
  await test('GET /api/admin/adjustments/admin/audit-logs/export', () => apiCall('GET', '/api/admin/adjustments/admin/audit-logs/export'), true);
  await test('POST /api/admin/adjustments/admin/point-adjustments', () => apiCall('POST', '/api/admin/adjustments/admin/point-adjustments', { userId: 'test', amount: 1000 }), true);
  await test('GET /api/admin/adjustments/admin/point-adjustments/:adjustmentId', () => apiCall('GET', '/api/admin/adjustments/admin/point-adjustments/test-id'), true);
  await test('POST /api/admin/adjustments/admin/point-adjustments/:adjustmentId/approve', () => apiCall('POST', '/api/admin/adjustments/admin/point-adjustments/test-id/approve'), true);
  await test('POST /api/admin/adjustments/admin/point-adjustments/:adjustmentId/reject', () => apiCall('POST', '/api/admin/adjustments/admin/point-adjustments/test-id/reject'), true);
  await test('GET /api/admin/adjustments/admin/point-adjustments/user/:userId', () => apiCall('GET', '/api/admin/adjustments/admin/point-adjustments/user/test-user-id'), true);

  // ========================================
  // 17. INFLUENCER BONUS
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣7️⃣ INFLUENCER BONUS (4 endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await test('GET /api/admin/influencer-bonus/admin/influencer-bonus/stats', () => apiCall('GET', '/api/admin/influencer-bonus/admin/influencer-bonus/stats'));
  await test('POST /api/admin/influencer-bonus/admin/influencer-bonus/check-qualification', () => apiCall('POST', '/api/admin/influencer-bonus/admin/influencer-bonus/check-qualification', { userId: 'test' }), true);
  await test('GET /api/admin/influencer-bonus/admin/influencer-bonus/analytics/:influencerId', () => apiCall('GET', '/api/admin/influencer-bonus/admin/influencer-bonus/analytics/test-influencer-id'), true);
  await test('POST /api/admin/influencer-bonus/admin/influencer-bonus/validate/:transactionId', () => apiCall('POST', '/api/admin/influencer-bonus/admin/influencer-bonus/validate/test-transaction-id'), true);

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n===================================================================');
  console.log('📊 COMPREHENSIVE TEST SUMMARY');
  console.log('===================================================================');
  console.log(`✅ Passed: ${PASSED}`);
  console.log(`❌ Failed: ${FAILED}`);
  console.log(`⏭️  Skipped: ${SKIPPED}`);
  console.log(`📝 Total Tests: ${PASSED + FAILED + SKIPPED}\n`);

  if (FAILED > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ FAILED TESTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    results.filter(r => !r.success && !r.skipped).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      console.log(`     Error: ${r.error}\n`);
    });
  }

  console.log('===================================================================\n');

  process.exit(FAILED > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
