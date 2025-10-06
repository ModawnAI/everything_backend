/**
 * Reservation Dispute Test
 * Tests: POST /api/admin/reservations/:id/dispute
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const RESERVATION_ID = '9d38669c-d542-44b3-b283-8ea77930a769'; // Created via Supabase

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

  if (!loginData.success || !loginData.data || !loginData.data.session) {
    console.log('❌ Login failed');
    process.exit(1);
  }

  const TOKEN = loginData.data.session.token;
  console.log('✅ Logged in');

  // TEST: Create reservation dispute
  console.log('\n=== TEST: CREATE RESERVATION DISPUTE ===');
  const disputeRes = await fetch(`${BASE_URL}/api/admin/reservations/${RESERVATION_ID}/dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      disputeType: 'customer_complaint',
      description: 'Customer reported service quality issues - automated test',
      requestedAction: 'investigation',
      priority: 'medium',
      evidence: []
    })
  });

  const disputeData = await disputeRes.json();
  console.log('Status:', disputeRes.status);
  console.log('Response:', JSON.stringify(disputeData, null, 2));

  if (disputeRes.status === 200 && disputeData.success) {
    console.log('✅ Reservation dispute created successfully');
    console.log('\n✅ TEST PASSED');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
