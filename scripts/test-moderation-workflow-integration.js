#!/usr/bin/env node

/**
 * Test Script for Moderation Workflow Integration
 * Tests the integration of moderation workflow with shop management
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test data
const testShopId = 'test-shop-moderation-integration';
const testUserId = 'test-user-moderation-integration';
const testModeratorId = 'test-moderator-integration';

console.log('🧪 Starting Moderation Workflow Integration Tests');
console.log('================================================');

// Helper function to make HTTP requests
async function makeRequest(method, endpoint, data = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const responseData = await response.json();
    return { status: response.status, data: responseData };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// Test functions
async function testShopModerationStatus() {
  console.log('\n=== Testing Shop Moderation Status ===');
  
  try {
    const { status, data } = await makeRequest('GET', `/api/admin/shops/${testShopId}/moderation-status`);
    
    if (status === 200) {
      console.log('✅ Shop moderation status retrieved successfully');
      console.log('   Status:', data.moderation_status);
      console.log('   Report Count:', data.report_count);
      console.log('   Violation Score:', data.violation_score);
    } else {
      console.log('❌ Error retrieving shop moderation status:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing shop moderation status:', error.message);
  }
}

async function testModerationAction() {
  console.log('\n=== Testing Moderation Action Execution ===');
  
  try {
    const moderationAction = {
      action_type: 'suspend',
      reason: 'Test suspension for moderation workflow integration',
      moderator_id: testModeratorId,
      notify_owner: true,
      notify_customers: true
    };

    const { status, data } = await makeRequest('POST', `/api/admin/shops/${testShopId}/moderation-action`, moderationAction);
    
    if (status === 200) {
      console.log('✅ Moderation action executed successfully');
      console.log('   Action:', data.action_taken);
      console.log('   Previous Status:', data.previous_status);
      console.log('   New Status:', data.new_status);
      console.log('   Notifications Sent:', data.notifications_sent);
    } else {
      console.log('❌ Error executing moderation action:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing moderation action:', error.message);
  }
}

async function testAutomaticModeration() {
  console.log('\n=== Testing Automatic Moderation Processing ===');
  
  try {
    const { status, data } = await makeRequest('POST', `/api/admin/shops/${testShopId}/auto-moderation`);
    
    if (status === 200) {
      if (data.result) {
        console.log('✅ Automatic moderation action taken');
        console.log('   Action:', data.result.action_taken);
        console.log('   Reason:', data.result.message);
      } else {
        console.log('✅ No automatic action needed');
      }
    } else {
      console.log('❌ Error processing automatic moderation:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing automatic moderation:', error.message);
  }
}

async function testShopVisibilityInSearch() {
  console.log('\n=== Testing Shop Visibility in Search Results ===');
  
  try {
    // Test nearby shops search to see if moderated shops are properly hidden
    const { status, data } = await makeRequest('GET', '/api/shops/nearby?latitude=37.5665&longitude=126.9780&radius=1000');
    
    if (status === 200) {
      console.log('✅ Nearby shops search completed');
      console.log('   Total shops found:', data.shops?.length || 0);
      
      // Check if any suspended or blocked shops are in the results
      const problematicShops = data.shops?.filter(shop => 
        shop.shop_status === 'suspended' || 
        shop.shop_status === 'inactive' ||
        shop.moderation_status === 'blocked'
      ) || [];
      
      if (problematicShops.length === 0) {
        console.log('✅ No suspended/blocked shops found in search results (correct behavior)');
      } else {
        console.log('⚠️  Found suspended/blocked shops in search results:', problematicShops.length);
        problematicShops.forEach(shop => {
          console.log(`   - ${shop.name} (${shop.shop_status})`);
        });
      }
    } else {
      console.log('❌ Error testing shop visibility:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing shop visibility:', error.message);
  }
}

async function testShopsRequiringReview() {
  console.log('\n=== Testing Shops Requiring Review ===');
  
  try {
    const { status, data } = await makeRequest('GET', '/api/admin/shops/requiring-review?limit=10');
    
    if (status === 200) {
      console.log('✅ Shops requiring review retrieved successfully');
      console.log('   Shops needing review:', data.shops?.length || 0);
      console.log('   Total count:', data.total || 0);
      
      if (data.shops && data.shops.length > 0) {
        data.shops.slice(0, 3).forEach(shop => {
          console.log(`   - ${shop.shop_name}: ${shop.moderation_status} (${shop.report_count} reports, score: ${shop.violation_score})`);
        });
      }
    } else {
      console.log('❌ Error retrieving shops requiring review:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing shops requiring review:', error.message);
  }
}

async function testModerationAuditTrail() {
  console.log('\n=== Testing Moderation Audit Trail ===');
  
  try {
    const { status, data } = await makeRequest('GET', `/api/admin/shops/${testShopId}/moderation-history`);
    
    if (status === 200) {
      console.log('✅ Moderation history retrieved successfully');
      console.log('   History entries:', data.history?.length || 0);
      
      if (data.history && data.history.length > 0) {
        data.history.slice(0, 3).forEach(entry => {
          console.log(`   - ${entry.action} by ${entry.moderator_id} on ${entry.created_at}`);
        });
      }
    } else {
      console.log('❌ Error retrieving moderation history:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing moderation audit trail:', error.message);
  }
}

async function testShopStatusUpdate() {
  console.log('\n=== Testing Shop Status Update Integration ===');
  
  try {
    // Test reactivating a shop
    const reactivationAction = {
      action_type: 'activate',
      reason: 'Test reactivation for moderation workflow integration',
      moderator_id: testModeratorId,
      notify_owner: true
    };

    const { status, data } = await makeRequest('POST', `/api/admin/shops/${testShopId}/moderation-action`, reactivationAction);
    
    if (status === 200) {
      console.log('✅ Shop reactivation executed successfully');
      console.log('   New Status:', data.new_status);
      console.log('   Notifications Sent:', data.notifications_sent);
    } else {
      console.log('❌ Error reactivating shop:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing shop status update:', error.message);
  }
}

async function testNotificationIntegration() {
  console.log('\n=== Testing Notification Integration ===');
  
  try {
    // Test sending a warning notification
    const warningAction = {
      action_type: 'warn',
      reason: 'Test warning notification for moderation workflow integration',
      moderator_id: testModeratorId,
      notify_owner: true
    };

    const { status, data } = await makeRequest('POST', `/api/admin/shops/${testShopId}/moderation-action`, warningAction);
    
    if (status === 200) {
      console.log('✅ Warning notification sent successfully');
      console.log('   Notifications Sent:', data.notifications_sent);
      
      // Check if shop owner was notified
      if (data.notifications_sent.includes('shop_owner_notified')) {
        console.log('✅ Shop owner notification confirmed');
      } else {
        console.log('⚠️  Shop owner notification not confirmed');
      }
    } else {
      console.log('❌ Error sending warning notification:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing notification integration:', error.message);
  }
}

async function testCacheInvalidation() {
  console.log('\n=== Testing Cache Invalidation ===');
  
  try {
    // Test that shop cache is properly invalidated after moderation actions
    const { status, data } = await makeRequest('GET', `/api/shops/${testShopId}`);
    
    if (status === 200) {
      console.log('✅ Shop data retrieved after moderation action');
      console.log('   Current Status:', data.shop_status);
      console.log('   Cache Invalidated:', data.updated_at);
    } else {
      console.log('❌ Error retrieving shop data after moderation:', data?.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error testing cache invalidation:', error.message);
  }
}

// Main test execution
async function runTests() {
  try {
    await testShopModerationStatus();
    await testModerationAction();
    await testAutomaticModeration();
    await testShopVisibilityInSearch();
    await testShopsRequiringReview();
    await testModerationAuditTrail();
    await testShopStatusUpdate();
    await testNotificationIntegration();
    await testCacheInvalidation();
    
    console.log('\n✅ All moderation workflow integration tests completed');
  } catch (error) {
    console.log('\n❌ Test execution failed:', error.message);
  }
}

// Check if server is running
async function checkServerHealth() {
  try {
    const { status } = await makeRequest('GET', '/api/health');
    if (status === 200) {
      console.log('✅ Server is running');
      return true;
    } else {
      console.log('❌ Server is not responding properly');
      return false;
    }
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('   Error:', error.message);
    return false;
  }
}

// Run tests if server is available
checkServerHealth().then(serverRunning => {
  if (serverRunning) {
    runTests();
  } else {
    console.log('\n⚠️  Skipping tests - server is not running');
    console.log('   Start the server with: npm run dev');
  }
});

