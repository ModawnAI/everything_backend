/**
 * Moderation Mutation Tests
 * Tests:
 * - PUT /api/admin/shop-reports/:reportId - Update shop report
 * - POST /api/admin/shop-reports/bulk-action - Bulk report action
 * - POST /api/admin/shops/:shopId/analyze-content - Analyze shop content
 * - PUT /api/admin/content/:contentId/moderate - Moderate content
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

  // TEST 1: Update shop report
  console.log('\n=== TEST 1: UPDATE SHOP REPORT ===');

  // Get a shop report to update
  const reportsRes = await fetch(`${BASE_URL}/api/admin/shop-reports?limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const reportsData = await reportsRes.json();

  if (!reportsData.success || !reportsData.data.reports || reportsData.data.reports.length === 0) {
    console.log('⚠️ No shop reports found - skipping update test');
  } else {
    const REPORT_ID = reportsData.data.reports[0].id;
    console.log(`✅ Testing with report: ${REPORT_ID}`);

    const updateRes = await fetch(`${BASE_URL}/api/admin/shop-reports/${REPORT_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        status: 'under_review',
        admin_notes: 'Investigating this report - automated test',
        action_type: 'flag',
        reason: 'Report is under investigation for potential policy violation'
      })
    });

    const updateData = await updateRes.json();
    console.log('Status:', updateRes.status);
    console.log('Response:', JSON.stringify(updateData, null, 2));

    if (updateRes.status === 200 && updateData.success) {
      console.log('✅ Shop report updated successfully');
    } else {
      console.log('❌ SHOP REPORT UPDATE TEST FAILED');
    }
  }

  // TEST 2: Bulk report action
  console.log('\n=== TEST 2: BULK REPORT ACTION ===');

  // Get multiple reports for bulk action
  const bulkReportsRes = await fetch(`${BASE_URL}/api/admin/shop-reports?limit=2`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const bulkReportsData = await bulkReportsRes.json();

  if (!bulkReportsData.success || !bulkReportsData.data.reports || bulkReportsData.data.reports.length === 0) {
    console.log('⚠️ No shop reports found - skipping bulk action test');
  } else {
    const reportIds = bulkReportsData.data.reports.slice(0, 1).map((r: any) => r.id);
    console.log(`✅ Testing bulk action with ${reportIds.length} report(s)`);

    const bulkRes = await fetch(`${BASE_URL}/api/admin/shop-reports/bulk-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        report_ids: reportIds,
        action_type: 'dismiss',
        reason: 'Automated test - bulk dismissal of reports after review'
      })
    });

    const bulkData = await bulkRes.json();
    console.log('Status:', bulkRes.status);
    console.log('Response:', JSON.stringify(bulkData, null, 2));

    if (bulkRes.status === 200 && bulkData.success) {
      console.log('✅ Bulk report action completed successfully');
    } else {
      console.log('❌ BULK REPORT ACTION TEST FAILED');
    }
  }

  // TEST 3: Analyze shop content
  console.log('\n=== TEST 3: ANALYZE SHOP CONTENT ===');

  // Get a shop to analyze
  const shopsRes = await fetch(`${BASE_URL}/api/admin/shops?page=1&limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const shopsData = await shopsRes.json();

  if (!shopsData.success || !shopsData.data.shops || shopsData.data.shops.length === 0) {
    console.log('⚠️ No shops found - skipping content analysis test');
  } else {
    const SHOP_ID = shopsData.data.shops[0].id;
    console.log(`✅ Testing with shop: ${SHOP_ID}`);

    const analyzeRes = await fetch(`${BASE_URL}/api/admin/shops/${SHOP_ID}/analyze-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    const analyzeData = await analyzeRes.json();
    console.log('Status:', analyzeRes.status);
    console.log('Response:', JSON.stringify(analyzeData, null, 2));

    if (analyzeRes.status === 200 && analyzeData.success) {
      console.log('✅ Shop content analysis completed successfully');
    } else {
      console.log('❌ CONTENT ANALYSIS TEST FAILED');
    }
  }

  // TEST 4: Moderate content
  console.log('\n=== TEST 4: MODERATE CONTENT ===');

  // Get reported content to moderate
  const contentRes = await fetch(`${BASE_URL}/api/admin/content/reported?limit=1`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const contentData = await contentRes.json();

  if (!contentData.success || !contentData.data.reports || contentData.data.reports.length === 0) {
    console.log('⚠️ No reported content found - skipping moderation test');
    console.log('\n✅ ALL AVAILABLE TESTS COMPLETED');
    process.exit(0);
  } else {
    const CONTENT_ID = contentData.data.reports[0].post_id;
    console.log(`✅ Testing with content: ${CONTENT_ID}`);

    const moderateRes = await fetch(`${BASE_URL}/api/admin/content/${CONTENT_ID}/moderate`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        action: 'hide',
        reason: 'Automated test - hiding content for policy review',
        notify_user: false
      })
    });

    const moderateData = await moderateRes.json();
    console.log('Status:', moderateRes.status);
    console.log('Response:', JSON.stringify(moderateData, null, 2));

    if (moderateRes.status === 200 && moderateData.success) {
      console.log('✅ Content moderation completed successfully');
      console.log('\n✅ ALL TESTS COMPLETED');
      process.exit(0);
    } else {
      console.log('❌ CONTENT MODERATION TEST FAILED');
      process.exit(1);
    }
  }
}

runTest();
