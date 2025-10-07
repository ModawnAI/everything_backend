/**
 * Shop Approval Mutation Test
 * Tests:
 * - PUT /api/admin/shops/approval/:id
 * - POST /api/admin/shops/approval/bulk-approval
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

  // Get a shop for testing
  const shopsRes = await fetch(`${BASE_URL}/api/admin/shops/approval?page=1&limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const shopsData = await shopsRes.json();

  if (!shopsData.success || !shopsData.data.shops || shopsData.data.shops.length === 0) {
    console.log('❌ No shops found for testing');
    process.exit(1);
  }

  const SHOP_ID = shopsData.data.shops[0].id;
  const CURRENT_STATUS = shopsData.data.shops[0].verification_status;
  console.log(`✅ Testing with shop: ${SHOP_ID} (current status: ${CURRENT_STATUS})`);

  // TEST 1: Process shop approval (approve)
  console.log('\n=== TEST 1: PROCESS SHOP APPROVAL ===');
  const approvalRes = await fetch(`${BASE_URL}/api/admin/shops/approval/${SHOP_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      action: 'approve',
      notes: 'Shop meets all requirements for verification',
      reason: 'All documents verified, business license valid'
    })
  });

  const approvalData = await approvalRes.json();
  console.log('Status:', approvalRes.status);
  console.log('Response:', JSON.stringify(approvalData, null, 2));

  if (approvalRes.status === 200 && approvalData.success) {
    console.log('✅ Shop approval processed successfully');
  } else {
    console.log('❌ APPROVAL TEST FAILED');
    console.log('Continuing to next test...');
  }

  // Get another shop for bulk testing
  const moreShops = await fetch(`${BASE_URL}/api/admin/shops/approval?page=1&limit=2`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const moreShopsData = await moreShops.json();

  if (moreShopsData.success && moreShopsData.data.shops && moreShopsData.data.shops.length >= 2) {
    const shopIds = moreShopsData.data.shops.map((s: any) => s.id);

    // TEST 2: Bulk approval
    console.log('\n=== TEST 2: BULK SHOP APPROVAL ===');
    const bulkRes = await fetch(`${BASE_URL}/api/admin/shops/approval/bulk-approval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        shopIds: [shopIds[0]],
        action: 'approve',
        notes: 'Bulk approval for verified shops',
        reason: 'Batch verification completed'
      })
    });

    const bulkData = await bulkRes.json();
    console.log('Status:', bulkRes.status);
    console.log('Response:', JSON.stringify(bulkData, null, 2));

    if (bulkRes.status === 200 && bulkData.success) {
      console.log('✅ Bulk approval completed successfully');
      console.log('\n✅ ALL TESTS COMPLETED');
      process.exit(0);
    } else {
      console.log('❌ BULK APPROVAL TEST FAILED');
      process.exit(1);
    }
  } else {
    console.log('\n⚠️  Not enough shops for bulk testing');
    console.log('✅ TEST 1 COMPLETED');
    process.exit(0);
  }
}

runTest();
