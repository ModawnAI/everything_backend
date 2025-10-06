/**
 * Admin Financial Payments Test
 * Tests: GET /api/admin/financial/payments/overview
 */

const BASE_URL = 'http://localhost:3001';

async function runTest() {
  // Login
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'newadmin@ebeautything.com', password: 'NewAdmin123!' })
  });
  const loginData = await loginRes.json();
  const TOKEN = loginData.data.session.token;

  // Test financial payments overview
  const res = await fetch(`${BASE_URL}/api/admin/financial/payments/overview`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));

  if (res.status === 200 && data.success) {
    console.log('✅ TEST PASSED');
    process.exit(0);
  } else if (res.status === 403) {
    console.log('❌ TEST FAILED - Still getting 403 (middleware not applied)');
    process.exit(1);
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
