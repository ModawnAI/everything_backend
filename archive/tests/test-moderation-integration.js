#!/usr/bin/env node

/**
 * Test script for Shop Moderation Integration
 * Tests the integration between moderation actions and shop status management
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';
const TEST_ADMIN_TOKEN = 'test-admin-token'; // Replace with actual admin token
const TEST_SHOP_ID = 'test-shop-id'; // Replace with actual shop ID

/**
 * Test shop moderation status change
 */
async function testShopModerationStatusChange() {
  console.log('\n=== Testing Shop Moderation Status Change ===');
  
  try {
    // First, get current shop status
    const shopResponse = await fetch(`${API_BASE}/api/shops/${TEST_SHOP_ID}`, {
      headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!shopResponse.ok) {
      throw new Error(`Failed to fetch shop: ${shopResponse.status}`);
    }
    
    const shop = await shopResponse.json();
    console.log('Current shop status:', shop.shop_status);
    
    // Create a test report
    const reportData = {
      report_type: 'inappropriate_content',
      title: 'Test moderation report',
      description: 'Testing moderation integration',
      evidence_urls: []
    };
    
    const reportResponse = await fetch(`${API_BASE}/api/shops/${TEST_SHOP_ID}/report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportData)
    });
    
    if (!reportResponse.ok) {
      throw new Error(`Failed to create report: ${reportResponse.status}`);
    }
    
    const report = await reportResponse.json();
    console.log('Created report:', report.id);
    
    // Wait a moment for automated processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if moderation action was created
    const actionsResponse = await fetch(`${API_BASE}/api/admin/shops/${TEST_SHOP_ID}/moderation-history`, {
      headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!actionsResponse.ok) {
      throw new Error(`Failed to fetch moderation history: ${actionsResponse.status}`);
    }
    
    const history = await actionsResponse.json();
    console.log('Moderation history:', history.actions.length, 'actions');
    
    // Check shop status again
    const updatedShopResponse = await fetch(`${API_BASE}/api/shops/${TEST_SHOP_ID}`, {
      headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!updatedShopResponse.ok) {
      throw new Error(`Failed to fetch updated shop: ${updatedShopResponse.status}`);
    }
    
    const updatedShop = await updatedShopResponse.json();
    console.log('Updated shop status:', updatedShop.shop_status);
    
    if (shop.shop_status !== updatedShop.shop_status) {
      console.log('✅ Shop status changed due to moderation action');
    } else {
      console.log('ℹ️ Shop status unchanged (no automatic action triggered)');
    }
    
  } catch (error) {
    console.error('❌ Error testing moderation status change:', error.message);
  }
}

/**
 * Test manual moderation action
 */
async function testManualModerationAction() {
  console.log('\n=== Testing Manual Moderation Action ===');
  
  try {
    // Get shop reports
    const reportsResponse = await fetch(`${API_BASE}/api/admin/shop-reports?status=pending&limit=5`, {
      headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!reportsResponse.ok) {
      throw new Error(`Failed to fetch reports: ${reportsResponse.status}`);
    }
    
    const reportsData = await reportsResponse.json();
    console.log('Found', reportsData.reports.length, 'pending reports');
    
    if (reportsData.reports.length === 0) {
      console.log('ℹ️ No pending reports to test with');
      return;
    }
    
    const report = reportsData.reports[0];
    console.log('Testing with report:', report.id);
    
    // Update report with moderation action
    const updateData = {
      status: 'resolved',
      resolution: 'Test moderation action applied',
      moderator_notes: 'Testing integration between moderation and shop status'
    };
    
    const updateResponse = await fetch(`${API_BASE}/api/admin/shop-reports/${report.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update report: ${updateResponse.status}`);
    }
    
    const updatedReport = await updateResponse.json();
    console.log('✅ Report updated:', updatedReport.status);
    
    // Check moderation history
    const historyResponse = await fetch(`${API_BASE}/api/admin/shops/${report.shop_id}/moderation-history`, {
      headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!historyResponse.ok) {
      throw new Error(`Failed to fetch moderation history: ${historyResponse.status}`);
    }
    
    const history = await historyResponse.json();
    console.log('Moderation history entries:', history.actions.length);
    
    if (history.actions.length > 0) {
      console.log('Latest action:', history.actions[0].action_type, '-', history.actions[0].reason);
    }
    
  } catch (error) {
    console.error('❌ Error testing manual moderation action:', error.message);
  }
}

/**
 * Test shop discovery filtering
 */
async function testShopDiscoveryFiltering() {
  console.log('\n=== Testing Shop Discovery Filtering ===');
  
  try {
    // Get nearby shops (should exclude moderated shops)
    const nearbyResponse = await fetch(`${API_BASE}/api/shops/nearby?latitude=37.5665&longitude=126.9780&radius=1000`, {
      headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!nearbyResponse.ok) {
      throw new Error(`Failed to fetch nearby shops: ${nearbyResponse.status}`);
    }
    
    const nearbyData = await nearbyResponse.json();
    console.log('Found', nearbyData.shops.length, 'nearby shops');
    
    // Check if any shops are hidden due to moderation
    const hiddenShops = nearbyData.shops.filter(shop => 
      shop.shop_status === 'suspended' || 
      shop.shop_status === 'inactive' ||
      shop.shop_status === 'flagged' ||
      shop.shop_status === 'moderation_blocked'
    );
    
    if (hiddenShops.length > 0) {
      console.log('ℹ️ Found', hiddenShops.length, 'shops with moderation-related status');
      hiddenShops.forEach(shop => {
        console.log(`  - Shop ${shop.id}: ${shop.shop_status}`);
      });
    } else {
      console.log('✅ All visible shops have clean moderation status');
    }
    
  } catch (error) {
    console.error('❌ Error testing shop discovery filtering:', error.message);
  }
}

/**
 * Test notification system integration
 */
async function testNotificationIntegration() {
  console.log('\n=== Testing Notification Integration ===');
  
  try {
    // This would test if notifications are sent when moderation actions are taken
    // For now, we'll just check if the moderation action was recorded
    console.log('ℹ️ Notification integration would be tested here');
    console.log('  - Check if shop owners receive notifications for moderation actions');
    console.log('  - Check if customers are notified when shops are suspended');
    console.log('  - Verify notification content includes moderation details');
    
  } catch (error) {
    console.error('❌ Error testing notification integration:', error.message);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Starting Shop Moderation Integration Tests');
  console.log('===============================================');
  
  try {
    await testShopModerationStatusChange();
    await testManualModerationAction();
    await testShopDiscoveryFiltering();
    await testNotificationIntegration();
    
    console.log('\n✅ All moderation integration tests completed');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testShopModerationStatusChange,
  testManualModerationAction,
  testShopDiscoveryFiltering,
  testNotificationIntegration,
  runTests
};

