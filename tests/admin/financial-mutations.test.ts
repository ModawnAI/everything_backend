/**
 * Financial Mutation Test
 * Tests:
 * - POST /api/admin/financial/points/adjust
 * - POST /api/admin/financial/reports/generate
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

  // Get a user for point adjustment testing
  const usersRes = await fetch(`${BASE_URL}/api/admin/users?page=1&limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const usersData = await usersRes.json();

  if (!usersData.success || !usersData.data.users || usersData.data.users.length === 0) {
    console.log('❌ No users found');
    process.exit(1);
  }

  const USER_ID = usersData.data.users[0].id;
  console.log(`✅ Testing with user: ${USER_ID}`);

  // TEST 1: Point adjustment
  console.log('\n=== TEST 1: POINT ADJUSTMENT ===');
  const pointsRes = await fetch(`${BASE_URL}/api/admin/financial/points/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      userId: USER_ID,
      amount: 100,
      adjustmentType: 'add',
      reason: 'Testing point adjustment API - promotional bonus',
      category: 'promotional',
      notes: 'Automated test for point adjustment functionality'
    })
  });

  const pointsData = await pointsRes.json();
  console.log('Status:', pointsRes.status);
  console.log('Response:', JSON.stringify(pointsData, null, 2));

  if (pointsRes.status === 200 && pointsData.success) {
    console.log('✅ Point adjustment completed successfully');
  } else {
    console.log('❌ POINT ADJUSTMENT TEST FAILED');
    console.log('Continuing to next test...');
  }

  // TEST 2: Generate financial report
  console.log('\n=== TEST 2: GENERATE FINANCIAL REPORT ===');
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const reportRes = await fetch(`${BASE_URL}/api/admin/financial/reports/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      reportType: 'summary',
      includeRefunds: true,
      includePoints: true,
      format: 'json'
    })
  });

  const reportData = await reportRes.json();
  console.log('Status:', reportRes.status);
  console.log('Response:', JSON.stringify(reportData, null, 2));

  if (reportRes.status === 200 && reportData.success) {
    console.log('✅ Financial report generated successfully');
    console.log('\n✅ ALL TESTS COMPLETED');
    process.exit(0);
  } else {
    console.log('❌ FINANCIAL REPORT TEST FAILED');
    process.exit(1);
  }
}

runTest();
