/**
 * Comprehensive Test Suite
 * Tests ALL admin and user endpoints systematically
 */

import 'dotenv/config';
import { BACKEND_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config/agent.config';
import { BACKEND_ENDPOINTS, TEST_CREDENTIALS } from '../config/api.config';
import { apiRequest } from '../tools/api-client';
import { logger } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  error?: string;
  responseTime?: number;
}

export async function runComprehensiveTests() {
  logger.info('🚀 Starting Comprehensive Test Suite');

  const results: TestResult[] = [];
  let adminToken = '';
  let testUserId = '';
  let testShopId = '';

  try {
    // ====================================
    // ADMIN AUTHENTICATION TESTS
    // ====================================
    logger.info('📋 Testing Admin Authentication Endpoints');

    // Add initial delay to avoid Supabase Auth rate limiting
    logger.info('⏱️ Waiting 2s to avoid rate limiting...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Admin Login
    logger.info('Testing admin login with credentials', {
      email: TEST_CREDENTIALS.admin.email,
      password: TEST_CREDENTIALS.admin.password.substring(0, 5) + '...'
    });

    const loginStart = Date.now();
    const loginResponse = await apiRequest({
      method: 'POST',
      endpoint: BACKEND_ENDPOINTS.admin.auth.login,
      body: {
        email: TEST_CREDENTIALS.admin.email,
        password: TEST_CREDENTIALS.admin.password
      }
    });

    if (loginResponse.success) {
      adminToken = loginResponse.data?.data?.session?.token || '';
      results.push({
        endpoint: BACKEND_ENDPOINTS.admin.auth.login,
        method: 'POST',
        status: 'PASS',
        statusCode: loginResponse.status,
        responseTime: Date.now() - loginStart
      });
      logger.info('✅ Admin Login - PASS');
    } else {
      results.push({
        endpoint: BACKEND_ENDPOINTS.admin.auth.login,
        method: 'POST',
        status: 'FAIL',
        statusCode: loginResponse.status,
        error: JSON.stringify(loginResponse.error)
      });
      logger.error('❌ Admin Login - FAIL', loginResponse.error);
      throw new Error('Admin login failed - cannot continue');
    }

    // 2. Validate Session
    const validateStart = Date.now();
    const validateResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.admin.auth.validate,
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.admin.auth.validate,
      method: 'GET',
      status: validateResponse.success ? 'PASS' : 'FAIL',
      statusCode: validateResponse.status,
      responseTime: Date.now() - validateStart,
      error: validateResponse.success ? undefined : JSON.stringify(validateResponse.error)
    });
    logger.info(validateResponse.success ? '✅ Session Validation - PASS' : '❌ Session Validation - FAIL');

    // 3. Get Admin Profile
    const profileStart = Date.now();
    const profileResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.admin.auth.profile,
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.admin.auth.profile,
      method: 'GET',
      status: profileResponse.success ? 'PASS' : 'FAIL',
      statusCode: profileResponse.status,
      responseTime: Date.now() - profileStart,
      error: profileResponse.success ? undefined : JSON.stringify(profileResponse.error)
    });
    logger.info(profileResponse.success ? '✅ Admin Profile - PASS' : '❌ Admin Profile - FAIL');

    // ====================================
    // SHOP ENDPOINTS TESTS
    // ====================================
    logger.info('📋 Testing Shop Endpoints');

    // 4. List All Shops
    const shopsListStart = Date.now();
    const shopsListResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.shops.list,
      params: {
        page: '1',
        perPage: '10'
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.shops.list,
      method: 'GET',
      status: shopsListResponse.success ? 'PASS' : 'FAIL',
      statusCode: shopsListResponse.status,
      responseTime: Date.now() - shopsListStart,
      error: shopsListResponse.success ? undefined : JSON.stringify(shopsListResponse.error)
    });
    logger.info(shopsListResponse.success ? '✅ Shops List - PASS' : '❌ Shops List - FAIL');

    // 5. Shop Search with Korean
    const shopSearchStart = Date.now();
    const shopSearchResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.shops.search,
      params: {
        q: 'nail',
        latitude: '37.5665',
        longitude: '126.9780',
        radius: '10'
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.shops.search,
      method: 'GET',
      status: shopSearchResponse.success ? 'PASS' : 'FAIL',
      statusCode: shopSearchResponse.status,
      responseTime: Date.now() - shopSearchStart,
      error: shopSearchResponse.success ? undefined : JSON.stringify(shopSearchResponse.error)
    });
    logger.info(shopSearchResponse.success ? '✅ Shop Search - PASS' : '❌ Shop Search - FAIL');

    // 6. Get Shop Details
    const { data: firstShop } = await supabase
      .from('shops')
      .select('id')
      .eq('verification_status', 'verified')
      .limit(1)
      .single();

    if (firstShop) {
      testShopId = firstShop.id;
      const shopDetailsStart = Date.now();
      const shopDetailsResponse = await apiRequest({
        method: 'GET',
        endpoint: BACKEND_ENDPOINTS.shops.get(testShopId)
      });

      results.push({
        endpoint: `GET /api/shops/:id`,
        method: 'GET',
        status: shopDetailsResponse.success ? 'PASS' : 'FAIL',
        statusCode: shopDetailsResponse.status,
        responseTime: Date.now() - shopDetailsStart,
        error: shopDetailsResponse.success ? undefined : JSON.stringify(shopDetailsResponse.error)
      });
      logger.info(shopDetailsResponse.success ? '✅ Shop Details - PASS' : '❌ Shop Details - FAIL');
    } else {
      results.push({
        endpoint: `GET /api/shops/:id`,
        method: 'GET',
        status: 'SKIP',
        error: 'No verified shops in database'
      });
      logger.warn('⚠️ Shop Details - SKIP (no test data)');
    }

    // ====================================
    // ADMIN SHOP MANAGEMENT TESTS
    // ====================================
    logger.info('📋 Testing Admin Shop Management');

    // 7. Admin Shop List
    const adminShopsStart = Date.now();
    const adminShopsResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.admin.shops.list,
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      params: {
        page: '1',
        perPage: '10'
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.admin.shops.list,
      method: 'GET',
      status: adminShopsResponse.success ? 'PASS' : 'FAIL',
      statusCode: adminShopsResponse.status,
      responseTime: Date.now() - adminShopsStart,
      error: adminShopsResponse.success ? undefined : JSON.stringify(adminShopsResponse.error)
    });
    logger.info(adminShopsResponse.success ? '✅ Admin Shops List - PASS' : '❌ Admin Shops List - FAIL');

    // 8. Admin Shop Search
    const adminShopSearchStart = Date.now();
    const adminShopSearchResponse = await apiRequest({
      method: 'POST',
      endpoint: BACKEND_ENDPOINTS.admin.shops.search,
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        page: '1',
        limit: '10',
        search: 'test'
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.admin.shops.search,
      method: 'POST',
      status: adminShopSearchResponse.success ? 'PASS' : 'FAIL',
      statusCode: adminShopSearchResponse.status,
      responseTime: Date.now() - adminShopSearchStart,
      error: adminShopSearchResponse.success ? undefined : JSON.stringify(adminShopSearchResponse.error)
    });
    logger.info(adminShopSearchResponse.success ? '✅ Admin Shop Search - PASS' : '❌ Admin Shop Search - FAIL');

    // ====================================
    // ADMIN USER MANAGEMENT TESTS
    // ====================================
    logger.info('📋 Testing Admin User Management');

    // 9. Admin User List
    const adminUsersStart = Date.now();
    const adminUsersResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.admin.users.list,
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.admin.users.list,
      method: 'GET',
      status: adminUsersResponse.success ? 'PASS' : 'FAIL',
      statusCode: adminUsersResponse.status,
      responseTime: Date.now() - adminUsersStart,
      error: adminUsersResponse.success ? undefined : JSON.stringify(adminUsersResponse.error)
    });
    logger.info(adminUsersResponse.success ? '✅ Admin Users List - PASS' : '❌ Admin Users List - FAIL');

    // ====================================
    // ADMIN RESERVATIONS TESTS
    // ====================================
    logger.info('📋 Testing Admin Reservation Management');

    // 10. Admin Reservations List
    const adminReservationsStart = Date.now();
    const adminReservationsResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.admin.reservations.list,
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.admin.reservations.list,
      method: 'GET',
      status: adminReservationsResponse.success ? 'PASS' : 'FAIL',
      statusCode: adminReservationsResponse.status,
      responseTime: Date.now() - adminReservationsStart,
      error: adminReservationsResponse.success ? undefined : JSON.stringify(adminReservationsResponse.error)
    });
    logger.info(adminReservationsResponse.success ? '✅ Admin Reservations List - PASS' : '❌ Admin Reservations List - FAIL');

    // ====================================
    // ADMIN PAYMENTS TESTS
    // ====================================
    logger.info('📋 Testing Admin Payment Management');

    // 11. Admin Payments List
    const adminPaymentsStart = Date.now();
    const adminPaymentsResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.admin.payments.list,
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.admin.payments.list,
      method: 'GET',
      status: adminPaymentsResponse.success ? 'PASS' : 'FAIL',
      statusCode: adminPaymentsResponse.status,
      responseTime: Date.now() - adminPaymentsStart,
      error: adminPaymentsResponse.success ? undefined : JSON.stringify(adminPaymentsResponse.error)
    });
    logger.info(adminPaymentsResponse.success ? '✅ Admin Payments List - PASS' : '❌ Admin Payments List - FAIL');

    // ====================================
    // HEALTH & MONITORING TESTS
    // ====================================
    logger.info('📋 Testing Health & Monitoring');

    // 12. Health Check
    const healthStart = Date.now();
    const healthResponse = await apiRequest({
      method: 'GET',
      endpoint: BACKEND_ENDPOINTS.health
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.health,
      method: 'GET',
      status: healthResponse.success ? 'PASS' : 'FAIL',
      statusCode: healthResponse.status,
      responseTime: Date.now() - healthStart,
      error: healthResponse.success ? undefined : JSON.stringify(healthResponse.error)
    });
    logger.info(healthResponse.success ? '✅ Health Check - PASS' : '❌ Health Check - FAIL');

    // ====================================
    // LOGOUT TEST
    // ====================================
    logger.info('📋 Testing Admin Logout');

    // 13. Admin Logout
    const logoutStart = Date.now();
    const logoutResponse = await apiRequest({
      method: 'POST',
      endpoint: BACKEND_ENDPOINTS.admin.auth.logout,
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    results.push({
      endpoint: BACKEND_ENDPOINTS.admin.auth.logout,
      method: 'POST',
      status: logoutResponse.success ? 'PASS' : 'FAIL',
      statusCode: logoutResponse.status,
      responseTime: Date.now() - logoutStart,
      error: logoutResponse.success ? undefined : JSON.stringify(logoutResponse.error)
    });
    logger.info(logoutResponse.success ? '✅ Admin Logout - PASS' : '❌ Admin Logout - FAIL');

    // ====================================
    // RESULTS SUMMARY
    // ====================================
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.filter(r => r.status === 'FAIL').length;
    const skippedTests = results.filter(r => r.status === 'SKIP').length;
    const successRate = ((passedTests / (totalTests - skippedTests)) * 100).toFixed(2);
    const avgResponseTime = results
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) /
      results.filter(r => r.responseTime).length;

    const summary = {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      successRate: `${successRate}%`,
      averageResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      results: results.map(r => ({
        endpoint: r.endpoint,
        method: r.method,
        status: r.status,
        statusCode: r.statusCode,
        responseTime: r.responseTime ? `${r.responseTime}ms` : undefined,
        error: r.error
      }))
    };

    logger.info('📊 Comprehensive Test Summary:', summary);

    return {
      success: failedTests === 0,
      summary
    };

  } catch (error: any) {
    logger.error('❌ Comprehensive test failed with error', { error: error.message });
    return {
      success: false,
      summary: {
        error: error.message,
        results
      }
    };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests()
    .then(result => {
      logger.info('✅ Comprehensive test completed', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('❌ Comprehensive test failed', error);
      process.exit(1);
    });
}
