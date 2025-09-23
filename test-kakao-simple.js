#!/usr/bin/env node
/**
 * Simple Kakao Maps API Test
 * Tests the geocoding API with sample addresses
 */

require('dotenv').config();

/**
 * Simple geocoding function based on official Kakao Maps API
 */
async function testKakaoGeocoding(address) {
  const apiKey = process.env.KAKAO_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error('KAKAO_MAPS_API_KEY not found in environment');
  }
  
  const queryParams = new URLSearchParams({
    query: address,
    analyze_type: 'similar'
  });
  
  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?${queryParams}`,
    {
      headers: {
        'Authorization': `KakaoAK ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Test with sample addresses
 */
async function runTests() {
  console.log('🧪 Testing Kakao Maps API...\n');
  
  const testAddresses = [
    '서울특별시 동대문구 청량리동 235-4',
    '서울특별시 강남구 테헤란로 123',
    '전북 삼성동 100',
    '서울역'
  ];
  
  for (const address of testAddresses) {
    console.log(`🔍 Testing: ${address}`);
    
    try {
      const result = await testKakaoGeocoding(address);
      
      if (result.documents && result.documents.length > 0) {
        const doc = result.documents[0];
        console.log(`✅ SUCCESS:`);
        console.log(`   📍 Coordinates: ${doc.y}, ${doc.x}`);
        console.log(`   🏠 Address: ${doc.address_name}`);
        console.log(`   🛣️  Road Address: ${doc.road_address?.address_name || 'N/A'}`);
        console.log(`   🏢 Building: ${doc.road_address?.building_name || 'N/A'}`);
        console.log(`   📮 Postal: ${doc.road_address?.zone_no || 'N/A'}`);
        console.log(`   🎯 Type: ${doc.address_type}`);
        console.log(`   📊 Meta: ${result.meta.total_count} results`);
      } else {
        console.log(`❌ No results found`);
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
    
    console.log(''); // Empty line
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('🎉 Test completed!');
}

// Run the test
runTests().catch(console.error);
