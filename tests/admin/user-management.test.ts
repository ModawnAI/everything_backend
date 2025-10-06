/**
 * User Management Mutation Test
 * Tests:
 * - PUT /api/admin/users/:id/status
 * - PUT /api/admin/users/:id/role
 * - POST /api/admin/users/bulk-action
 * - POST /api/admin/audit/export
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function runTest() {
  // Login
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testadmin@ebeautything.com',
      password: 'TestAdmin123!',
      deviceInfo: { userAgent: 'test', platform: 'CLI', ipAddress: '127.0.0.1' }
    })
  });
  const loginData = await loginRes.json();
  console.log('Login response:', JSON.stringify(loginData, null, 2));

  if (!loginData.success || !loginData.data || !loginData.data.session) {
    console.log('❌ Login failed');
    process.exit(1);
  }

  const TOKEN = loginData.data.session.token;
  console.log('✅ Logged in');

  // Get a user to test with
  const usersRes = await fetch(`${BASE_URL}/api/admin/users?page=1&limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const usersData = await usersRes.json();

  if (!usersData.success || !usersData.data.users || usersData.data.users.length === 0) {
    console.log('❌ No users found');
    process.exit(1);
  }

  const USER_ID = usersData.data.users[0].id;
  const ORIGINAL_STATUS = usersData.data.users[0].userStatus;
  console.log(`✅ Testing with user: ${USER_ID} (current status: ${ORIGINAL_STATUS})`);

  // TEST 1: Update user status
  console.log('\n=== TEST 1: UPDATE USER STATUS ===');
  const newStatus = ORIGINAL_STATUS === 'active' ? 'inactive' : 'active';
  const statusRes = await fetch(`${BASE_URL}/api/admin/users/${USER_ID}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      userId: USER_ID,
      newStatus: newStatus,
      reason: 'Testing API - changing status for automated test purposes'
    })
  });

  const statusData = await statusRes.json();
  console.log('Status:', statusRes.status);
  console.log('Response:', JSON.stringify(statusData, null, 2));

  if (statusRes.status === 200 && statusData.success) {
    console.log('✅ User status updated successfully');
  } else {
    console.log('❌ UPDATE STATUS TEST FAILED');
    process.exit(1);
  }

  // TEST 2: Update user role
  console.log('\n=== TEST 2: UPDATE USER ROLE ===');
  const roleRes = await fetch(`${BASE_URL}/api/admin/users/${USER_ID}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      role: 'user',
      reason: 'Testing API',
      adminNotes: 'Automated test'
    })
  });

  const roleData = await roleRes.json();
  console.log('Status:', roleRes.status);
  console.log('Response:', JSON.stringify(roleData, null, 2));

  if (roleRes.status === 200 && roleData.success) {
    console.log('✅ User role updated successfully');
  } else {
    console.log('❌ UPDATE ROLE TEST FAILED');
    process.exit(1);
  }

  // TEST 3: Bulk action
  console.log('\n=== TEST 3: BULK ACTION ===');
  const bulkRes = await fetch(`${BASE_URL}/api/admin/users/bulk-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      userIds: [USER_ID],
      action: 'activate',
      reason: 'Testing bulk API',
      adminNotes: 'Automated test'
    })
  });

  const bulkData = await bulkRes.json();
  console.log('Status:', bulkRes.status);
  console.log('Response:', JSON.stringify(bulkData, null, 2));

  if (bulkRes.status === 200 && bulkData.success) {
    console.log('✅ Bulk action completed successfully');
  } else {
    console.log('❌ BULK ACTION TEST FAILED');
    process.exit(1);
  }

  // TEST 4: Export audit logs
  console.log('\n=== TEST 4: EXPORT AUDIT LOGS ===');
  const exportRes = await fetch(`${BASE_URL}/api/admin/users/audit/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      format: 'json',
      includeMetadata: true,
      userId: USER_ID,
      limit: 10
    })
  });

  const exportData = await exportRes.json();
  console.log('Status:', exportRes.status);
  console.log('Response:', JSON.stringify(exportData, null, 2));

  if (exportRes.status === 200 && exportData.success) {
    console.log('✅ Audit logs exported successfully');
    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('❌ EXPORT AUDIT LOGS TEST FAILED');
    process.exit(1);
  }
}

runTest();
