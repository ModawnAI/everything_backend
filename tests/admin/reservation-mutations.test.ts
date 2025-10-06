/**
 * Reservation Mutation Test
 * Tests:
 * - PUT /api/admin/reservations/:id/status
 * - POST /api/admin/reservations/:id/force-complete
 * - POST /api/admin/reservations/bulk-status-update
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

  // TEST 1: Update reservation status
  console.log('\n=== TEST 1: UPDATE RESERVATION STATUS ===');
  const statusRes = await fetch(`${BASE_URL}/api/admin/reservations/${RESERVATION_ID}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      status: 'confirmed',
      adminNotes: 'Confirmed via API test'
    })
  });

  const statusData = await statusRes.json();
  console.log('Status:', statusRes.status);
  console.log('Response:', JSON.stringify(statusData, null, 2));

  if (statusRes.status === 200 && statusData.success) {
    console.log('✅ Reservation status updated successfully');
  } else {
    console.log('❌ UPDATE STATUS TEST FAILED');
    console.log('Continuing to next test...');
  }

  // TEST 2: Force complete reservation
  console.log('\n=== TEST 2: FORCE COMPLETE RESERVATION ===');
  const completeRes = await fetch(`${BASE_URL}/api/admin/reservations/${RESERVATION_ID}/force-complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      reason: 'Testing force complete API',
      adminNotes: 'Automated test'
    })
  });

  const completeData = await completeRes.json();
  console.log('Status:', completeRes.status);
  console.log('Response:', JSON.stringify(completeData, null, 2));

  if (completeRes.status === 200 && completeData.success) {
    console.log('✅ Reservation force completed successfully');
  } else {
    console.log('❌ FORCE COMPLETE TEST FAILED');
    console.log('Continuing to next test...');
  }

  // TEST 3: Bulk status update
  console.log('\n=== TEST 3: BULK STATUS UPDATE ===');
  const bulkRes = await fetch(`${BASE_URL}/api/admin/reservations/bulk-status-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      reservationIds: [RESERVATION_ID],
      status: 'confirmed',
      reason: 'Testing bulk update API'
    })
  });

  const bulkData = await bulkRes.json();
  console.log('Status:', bulkRes.status);
  console.log('Response:', JSON.stringify(bulkData, null, 2));

  if (bulkRes.status === 200 && bulkData.success) {
    console.log('✅ Bulk status update completed successfully');
    console.log('\n✅ ALL TESTS COMPLETED');
    process.exit(0);
  } else {
    console.log('❌ BULK STATUS UPDATE TEST FAILED');
    console.log('\n⚠️  SOME TESTS FAILED');
    process.exit(1);
  }
}

runTest();
