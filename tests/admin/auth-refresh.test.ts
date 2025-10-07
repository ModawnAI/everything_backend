/**
 * Auth Refresh Test
 * Tests: POST /api/admin/auth/refresh
 */

const BASE_URL = 'http://localhost:3001';

async function runTest() {
  // Login first
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'newadmin@ebeautything.com',
      password: 'NewAdmin123!',
      deviceInfo: { userAgent: 'test', platform: 'CLI', ipAddress: '127.0.0.1' }
    })
  });
  const loginData = await loginRes.json();
  const TOKEN = loginData.data.session.token;
  const REFRESH_TOKEN = loginData.data.session.refreshToken;

  console.log(`Using token: ${TOKEN.substring(0, 20)}...`);
  console.log(`Using refresh token: ${REFRESH_TOKEN.substring(0, 20)}...`);

  // Test refresh
  const res = await fetch(`${BASE_URL}/api/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: REFRESH_TOKEN })
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (res.status === 200 && data.success) {
    console.log('✅ TEST PASSED');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
