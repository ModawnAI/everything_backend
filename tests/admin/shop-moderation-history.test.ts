/**
 * Shop Moderation History Test
 * Tests: GET /api/admin/shops/:shopId/moderation-history
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

  // Get a shop ID
  const shopsRes = await fetch(`${BASE_URL}/api/admin/shops`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const shopsData = await shopsRes.json();
  const shopId = shopsData.data.shops[0]?.id;

  if (!shopId) {
    console.log('❌ No shops available for testing');
    process.exit(1);
  }

  console.log(`Testing with shop ID: ${shopId}`);

  // Test moderation history
  const res = await fetch(`${BASE_URL}/api/admin/shops/${shopId}/moderation-history`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));

  if (res.status === 200 && data.success) {
    console.log('✅ TEST PASSED');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
