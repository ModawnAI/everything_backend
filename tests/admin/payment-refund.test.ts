/**
 * Payment Refund Test
 * Tests: POST /api/admin/payments/:paymentId/refund
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

  if (!loginData.success || !loginData.data || !loginData.data.session) {
    console.log('❌ Login failed');
    process.exit(1);
  }

  const TOKEN = loginData.data.session.token;
  console.log('✅ Logged in');

  // Get a completed payment to refund
  const paymentsRes = await fetch(`${BASE_URL}/api/admin/payments?status=completed&limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const paymentsData = await paymentsRes.json();

  if (!paymentsData.success || !paymentsData.data.payments || paymentsData.data.payments.length === 0) {
    console.log('⚠️ No completed payments found');
    console.log('Creating test payment data...');
    console.log('❌ TEST SKIPPED - No completed payments available for refund');
    process.exit(0);
  }

  const PAYMENT_ID = paymentsData.data.payments[0].id;
  const PAYMENT_AMOUNT = paymentsData.data.payments[0].amount;
  console.log(`✅ Testing with payment: ${PAYMENT_ID}, amount: ${PAYMENT_AMOUNT}`);

  // TEST: Process payment refund
  console.log('\n=== TEST: PROCESS PAYMENT REFUND ===');
  const refundRes = await fetch(`${BASE_URL}/api/admin/payments/${PAYMENT_ID}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      refundAmount: PAYMENT_AMOUNT,
      reason: 'Customer requested refund - automated test',
      refundMethod: 'original',
      notes: 'Test refund processing for admin API testing',
      notifyCustomer: false
    })
  });

  const refundData = await refundRes.json();
  console.log('Status:', refundRes.status);
  console.log('Response:', JSON.stringify(refundData, null, 2));

  if (refundRes.status === 200 && refundData.success) {
    console.log('✅ Payment refund processed successfully');
    console.log('\n✅ TEST PASSED');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED');
    process.exit(1);
  }
}

runTest();
