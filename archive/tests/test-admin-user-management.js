/**
 * Comprehensive Admin User Management API Test
 * Tests all 13 endpoints methodically
 */

const http = require('http');
const fs = require('fs');

const BACKEND_URL = 'http://localhost:3001';
let adminToken = null;
let adminId = null;
const results = [];

function apiRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data && method !== 'GET') {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function test1_AdminLogin() {
  console.log('\n📍 Test 1: Admin Login');
  const result = await apiRequest('POST', '/api/admin/auth/login', {
    email: 'admin@ebeautything.com',
    password: 'Admin123!@#'
  });

  if (result.data.success && result.data.data?.session?.token) {
    adminToken = result.data.data.session.token;
    adminId = result.data.data.admin.id;
    console.log('✅ Login successful');
    console.log('Token:', adminToken.substring(0, 50) + '...');
    console.log('Admin ID:', adminId);
    results.push({ test: 'Admin Login', status: 'PASS', token: adminToken });
    return true;
  } else {
    console.log('❌ Login failed:', result.data);
    results.push({ test: 'Admin Login', status: 'FAIL', error: result.data });
    return false;
  }
}

async function test2_GetUsers() {
  console.log('\n📍 Test 2: GET /api/admin/users');
  const result = await apiRequest('GET', '/api/admin/users?limit=10', null, {
    'Authorization': `Bearer ${adminToken}`
  });

  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2).substring(0, 500));

  if (result.data.success) {
    console.log('✅ Get users successful');
    console.log('Total users:', result.data.data?.totalCount);
    console.log('Users returned:', result.data.data?.users?.length);
    results.push({ test: 'GET /api/admin/users', status: 'PASS', totalCount: result.data.data?.totalCount });
  } else {
    console.log('❌ Get users failed');
    results.push({ test: 'GET /api/admin/users', status: 'FAIL', error: result.data});
  }
}

async function test3_GetStatistics() {
  console.log('\n📍 Test 3: GET /api/admin/users/statistics');
  const result = await apiRequest('GET', '/api/admin/users/statistics', null, {
    'Authorization': `Bearer ${adminToken}`
  });

  console.log('Status:', result.status);
  if (result.data.success) {
    console.log('✅ Get statistics successful');
    console.log('Stats:', JSON.stringify(result.data.data, null, 2).substring(0, 300));
    results.push({ test: 'GET /api/admin/users/statistics', status: 'PASS', data: result.data.data });
  } else {
    console.log('❌ Get statistics failed');
    results.push({ test: 'GET /api/admin/users/statistics', status: 'FAIL', error: result.data });
  }
}

async function test4_GetUserActivity() {
  console.log('\n📍 Test 4: GET /api/admin/users/activity');
  const result = await apiRequest('GET', '/api/admin/users/activity?limit=10', null, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (result.data.success) {
    console.log('✅ Get activity successful');
    results.push({ test: 'GET /api/admin/users/activity', status: 'PASS' });
  } else {
    console.log('❌ Get activity failed');
    results.push({ test: 'GET /api/admin/users/activity', status: 'FAIL', error: result.data });
  }
}

async function test5_GetUserDetails() {
  console.log('\n📍 Test 5: GET /api/admin/users/:id');
  const result = await apiRequest('GET', `/api/admin/users/${adminId}`, null, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (result.data.success) {
    console.log('✅ Get user details successful');
    console.log('User:', result.data.data.email);
    results.push({ test: 'GET /api/admin/users/:id', status: 'PASS' });
  } else {
    console.log('❌ Get user details failed');
    results.push({ test: 'GET /api/admin/users/:id', status: 'FAIL', error: result.data });
  }
}

async function test6_UpdateUserStatus() {
  console.log('\n📍 Test 6: PUT /api/admin/users/:id/status');
  // First get a test user
  const usersResult = await apiRequest('GET', '/api/admin/users?limit=1&role=user', null, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (usersResult.data.success && usersResult.data.data.users.length > 0) {
    const testUserId = usersResult.data.data.users[0].id;
    const result = await apiRequest('PUT', `/api/admin/users/${testUserId}/status`, {
      status: 'inactive',
      reason: 'Test status change',
      adminNotes: 'Automated test'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    if (result.data.success) {
      console.log('✅ Update user status successful');
      // Revert
      await apiRequest('PUT', `/api/admin/users/${testUserId}/status`, {
        status: 'active'
      }, { 'Authorization': `Bearer ${adminToken}` });
      results.push({ test: 'PUT /api/admin/users/:id/status', status: 'PASS' });
    } else {
      console.log('❌ Update user status failed');
      results.push({ test: 'PUT /api/admin/users/:id/status', status: 'FAIL', error: result.data });
    }
  } else {
    console.log('⚠️  No test user found, skipping');
    results.push({ test: 'PUT /api/admin/users/:id/status', status: 'SKIP' });
  }
}

async function test7_UpdateUserRole() {
  console.log('\n📍 Test 7: PUT /api/admin/users/:id/role');
  const usersResult = await apiRequest('GET', '/api/admin/users?limit=1&role=user', null, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (usersResult.data.success && usersResult.data.data.users.length > 0) {
    const testUserId = usersResult.data.data.users[0].id;
    const result = await apiRequest('PUT', `/api/admin/users/${testUserId}/role`, {
      role: 'shop_owner',
      reason: 'Test role change'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    if (result.data.success) {
      console.log('✅ Update user role successful');
      // Revert
      await apiRequest('PUT', `/api/admin/users/${testUserId}/role`, {
        role: 'user'
      }, { 'Authorization': `Bearer ${adminToken}` });
      results.push({ test: 'PUT /api/admin/users/:id/role', status: 'PASS' });
    } else {
      console.log('❌ Update user role failed');
      results.push({ test: 'PUT /api/admin/users/:id/role', status: 'FAIL', error: result.data });
    }
  } else {
    results.push({ test: 'PUT /api/admin/users/:id/role', status: 'SKIP' });
  }
}

async function test8_BulkAction() {
  console.log('\n📍 Test 8: POST /api/admin/users/bulk-action');
  const result = await apiRequest('POST', '/api/admin/users/bulk-action', {
    userIds: [],
    action: 'activate'
  }, {
    'Authorization': `Bearer ${adminToken}`
  });

  // Empty array should be validated
  if (!result.data.success && result.data.error.includes('User IDs')) {
    console.log('✅ Bulk action validation working');
    results.push({ test: 'POST /api/admin/users/bulk-action', status: 'PASS' });
  } else {
    results.push({ test: 'POST /api/admin/users/bulk-action', status: 'PARTIAL', note: 'Need real test' });
  }
}

async function test9_AuditSearch() {
  console.log('\n📍 Test 9: GET /api/admin/users/audit/search');
  const result = await apiRequest('GET', '/api/admin/users/audit/search?limit=10', null, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (result.data.success) {
    console.log('✅ Audit search successful');
    results.push({ test: 'GET /api/admin/users/audit/search', status: 'PASS' });
  } else {
    console.log('❌ Audit search failed');
    results.push({ test: 'GET /api/admin/users/audit/search', status: 'FAIL', error: result.data });
  }
}

async function test10_UserAudit() {
  console.log('\n📍 Test 10: GET /api/admin/users/:userId/audit');
  const result = await apiRequest('GET', `/api/admin/users/${adminId}/audit?limit=10`, null, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (result.data.success) {
    console.log('✅ User audit logs successful');
    results.push({ test: 'GET /api/admin/users/:userId/audit', status: 'PASS' });
  } else {
    console.log('❌ User audit logs failed');
    results.push({ test: 'GET /api/admin/users/:userId/audit', status: 'FAIL', error: result.data });
  }
}

async function test11_AuditExport() {
  console.log('\n📍 Test 11: POST /api/admin/users/audit/export');
  const result = await apiRequest('POST', '/api/admin/users/audit/export', {
    format: 'json',
    filters: {}
  }, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (result.data.success || result.status === 200) {
    console.log('✅ Audit export successful');
    results.push({ test: 'POST /api/admin/users/audit/export', status: 'PASS' });
  } else {
    console.log('❌ Audit export failed');
    results.push({ test: 'POST /api/admin/users/audit/export', status: 'FAIL', error: result.data });
  }
}

async function test12_Analytics() {
  console.log('\n📍 Test 12: GET /api/admin/users/analytics');
  const result = await apiRequest('GET', '/api/admin/users/analytics', null, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (result.data.success) {
    console.log('✅ Analytics successful');
    results.push({ test: 'GET /api/admin/users/analytics', status: 'PASS' });
  } else {
    console.log('❌ Analytics failed');
    results.push({ test: 'GET /api/admin/users/analytics', status: 'FAIL', error: result.data });
  }
}

async function test13_AdvancedSearch() {
  console.log('\n📍 Test 13: GET /api/admin/users/search/advanced');
  const result = await apiRequest('GET', '/api/admin/users/search/advanced?query=admin&limit=10', null, {
    'Authorization': `Bearer ${adminToken}`
  });

  if (result.data.success) {
    console.log('✅ Advanced search successful');
    results.push({ test: 'GET /api/admin/users/search/advanced', status: 'PASS' });
  } else {
    console.log('❌ Advanced search failed');
    results.push({ test: 'GET /api/admin/users/search/advanced', status: 'FAIL', error: result.data });
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Admin User Management API Tests');
  console.log('='.repeat(60));

  const loginSuccess = await test1_AdminLogin();
  if (!loginSuccess) {
    console.log('\n❌ Login failed, cannot continue tests');
    return;
  }

  await test2_GetUsers();
  await test3_GetStatistics();
  await test4_GetUserActivity();
  await test5_GetUserDetails();
  await test6_UpdateUserStatus();
  await test7_UpdateUserRole();
  await test8_BulkAction();
  await test9_AuditSearch();
  await test10_UserAudit();
  await test11_AuditExport();
  await test12_Analytics();
  await test13_AdvancedSearch();

  // Save results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  results.forEach((r, i) => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${i + 1}. ${r.test}: ${r.status}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);

  fs.writeFileSync('/tmp/admin-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Results saved to /tmp/admin-test-results.json');
}

runAllTests().catch(console.error);
