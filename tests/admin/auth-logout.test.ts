/**
 * Auth Logout Test
 * Tests: POST /api/admin/auth/logout
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
  console.log('Login response:', JSON.stringify(loginData, null, 2));

  if (!loginData.success || !loginData.data) {
    console.log('❌ LOGIN FAILED');
    process.exit(1);
  }

  const TOKEN = loginData.data.session.token;

  console.log(`Using token: ${TOKEN.substring(0, 20)}...`);

  // Test logout
  const res = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    }
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (res.status === 200 && data.success) {
    console.log('✅ TEST PASSED - Session logged out');

    // Verify token is now invalid
    const validateRes = await fetch(`${BASE_URL}/api/admin/auth/validate`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (validateRes.status === 401) {
      console.log('✅ TOKEN INVALIDATED - Cannot use after logout');
      process.exit(0);
    } else {
      console.log('❌ TOKEN STILL VALID - Logout did not invalidate session');
      process.exit(1);
    }
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
