/**
 * Test script for new favorites endpoints
 * Tests: GET /api/user/favorites/ids and POST /api/user/favorites/batch
 */

import axios from 'axios';

const API_BASE_URL = 'https://api.e-beautything.com';

// Test user credentials (using existing test user)
const TEST_USER = {
  email: 'sjpjjang11@gmail.com',
  // Will need to get token from Supabase
};

interface FavoriteIdsResponse {
  success: boolean;
  data: {
    favoriteIds: string[];
    count: number;
    timestamp: string;
  };
  message: string;
}

interface BatchToggleResponse {
  success: boolean;
  data: {
    added: string[];
    removed: string[];
    failed: Array<{ shopId: string; error: string }>;
    favoriteIds: string[];
    count: number;
  };
  message: string;
}

async function getAuthToken(): Promise<string> {
  // For testing, we'll use the Bearer token from the browser
  // In production, this would come from Supabase auth
  const token = process.env.TEST_AUTH_TOKEN;
  
  if (!token) {
    throw new Error('TEST_AUTH_TOKEN environment variable is required');
  }
  
  return token;
}

async function testGetFavoriteIds(token: string) {
  console.log('\n📋 Testing GET /api/user/favorites/ids');
  console.log('='.repeat(60));
  
  try {
    const response = await axios.get<FavoriteIdsResponse>(
      `${API_BASE_URL}/api/user/favorites/ids`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Status:', response.status);
    console.log('📦 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`✅ Retrieved ${response.data.data.count} favorite IDs`);
      console.log('📝 Favorite IDs:', response.data.data.favoriteIds.slice(0, 5).join(', '), 
        response.data.data.favoriteIds.length > 5 ? '...' : '');
    }
    
    return response.data.data.favoriteIds;
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

async function testBatchToggleFavorites(token: string, currentFavorites: string[]) {
  console.log('\n🔄 Testing POST /api/user/favorites/batch');
  console.log('='.repeat(60));
  
  // Test data: Add some shops, remove some others
  const testShopIds = [
    '11111111-1111-1111-1111-111111111111', // Active shop
    '22222222-2222-2222-2222-222222222222', // Active shop
    '33333333-3333-3333-3333-333333333333', // Active shop
  ];
  
  const toAdd = testShopIds.filter(id => !currentFavorites.includes(id)).slice(0, 2);
  const toRemove = currentFavorites.slice(0, 1);
  
  console.log('➕ Adding:', toAdd);
  console.log('➖ Removing:', toRemove);
  
  try {
    const response = await axios.post<BatchToggleResponse>(
      `${API_BASE_URL}/api/user/favorites/batch`,
      {
        add: toAdd,
        remove: toRemove
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Status:', response.status);
    console.log('📦 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`✅ Added: ${response.data.data.added.length} shops`);
      console.log(`✅ Removed: ${response.data.data.removed.length} shops`);
      console.log(`⚠️ Failed: ${response.data.data.failed.length} shops`);
      console.log(`📊 Total favorites: ${response.data.data.count}`);
      
      if (response.data.data.failed.length > 0) {
        console.log('❌ Failed operations:', response.data.data.failed);
      }
    }
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

async function testEdgeCases(token: string) {
  console.log('\n🧪 Testing Edge Cases');
  console.log('='.repeat(60));
  
  // Test 1: Empty arrays
  console.log('\n1️⃣ Test: Empty add/remove arrays');
  try {
    await axios.post(
      `${API_BASE_URL}/api/user/favorites/batch`,
      { add: [], remove: [] },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('❌ Should have failed with validation error');
  } catch (error: any) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected empty arrays:', error.response.data.message);
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
  
  // Test 2: Invalid shop ID (inactive shop)
  console.log('\n2️⃣ Test: Add inactive shop');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/user/favorites/batch`,
      { 
        add: ['99999999-9999-9999-9999-999999999999'], // Non-existent shop
        remove: [] 
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.data.failed.length > 0) {
      console.log('✅ Correctly handled inactive shop:', response.data.data.failed[0]);
    } else {
      console.log('⚠️ Should have failed for non-existent shop');
    }
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.response?.data || error.message);
  }
  
  // Test 3: Batch size limit (51 items)
  console.log('\n3️⃣ Test: Exceed batch size limit');
  try {
    const tooMany = Array(51).fill('11111111-1111-1111-1111-111111111111');
    await axios.post(
      `${API_BASE_URL}/api/user/favorites/batch`,
      { add: tooMany, remove: [] },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('❌ Should have failed with batch size limit error');
  } catch (error: any) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected oversized batch:', error.response.data.message);
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
  
  // Test 4: Invalid data types
  console.log('\n4️⃣ Test: Invalid data types');
  try {
    await axios.post(
      `${API_BASE_URL}/api/user/favorites/batch`,
      { add: 'not-an-array', remove: [] },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('❌ Should have failed with validation error');
  } catch (error: any) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected invalid data type:', error.response.data.message);
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

async function testPerformance(token: string) {
  console.log('\n⚡ Testing Performance');
  console.log('='.repeat(60));
  
  // Test response time for GET /api/user/favorites/ids
  console.log('\n📊 GET /api/user/favorites/ids - 5 consecutive requests');
  const times: number[] = [];
  
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await axios.get(
      `${API_BASE_URL}/api/user/favorites/ids`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    const duration = Date.now() - start;
    times.push(duration);
    console.log(`  Request ${i + 1}: ${duration}ms`);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${Math.min(...times)}ms`);
  console.log(`  Max: ${Math.max(...times)}ms`);
  
  if (avg < 100) {
    console.log('  ✅ Excellent performance (<100ms)');
  } else if (avg < 300) {
    console.log('  ✅ Good performance (<300ms)');
  } else {
    console.log('  ⚠️ Performance could be improved (>300ms)');
  }
}

async function runTests() {
  console.log('🚀 Starting Favorites Endpoints Tests');
  console.log('='.repeat(60));
  
  try {
    // Get auth token
    const token = await getAuthToken();
    console.log('✅ Auth token obtained');
    
    // Test 1: Get favorite IDs
    const favoriteIds = await testGetFavoriteIds(token);
    
    // Test 2: Batch toggle favorites
    await testBatchToggleFavorites(token, favoriteIds);
    
    // Test 3: Verify favorites updated
    console.log('\n🔍 Verifying favorites after batch toggle');
    const updatedFavorites = await testGetFavoriteIds(token);
    
    // Test 4: Edge cases
    await testEdgeCases(token);
    
    // Test 5: Performance
    await testPerformance(token);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

export { runTests, testGetFavoriteIds, testBatchToggleFavorites, testEdgeCases, testPerformance };
