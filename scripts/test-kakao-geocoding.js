#!/usr/bin/env node
/**
 * Test Script for Kakao Maps Geocoding
 * 
 * Tests the geocoding function with sample Korean addresses
 * to verify the API integration works correctly
 */

const { geocodeAddressWithKakao } = require('./enhanced-shop-import.js');
require('dotenv').config();

// Test addresses with different formats
const testAddresses = [
  '서울특별시 동대문구 청량리동 235-4',
  '서울특별시 강남구 테헤란로 123',
  '서울특별시 마포구 홍익로 456',
  '서울특별시 송파구 올림픽로 789',
  '부산광역시 해운대구 센텀중앙로 55',
  '대구광역시 중구 동성로 123',
  'invalid address test',
  '서울역',
  '강남역'
];

/**
 * Test geocoding with sample addresses
 */
async function testGeocoding() {
  console.log('🧪 Testing Kakao Maps Geocoding API...\n');
  
  // Check API key
  const apiKey = process.env.KAKAO_MAPS_API_KEY;
  if (!apiKey) {
    console.error('❌ KAKAO_MAPS_API_KEY not found in environment variables');
    console.error('Please set your Kakao Maps API key in .env file');
    process.exit(1);
  }
  
  console.log('✅ API Key found');
  console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`);
  
  let successCount = 0;
  let failCount = 0;
  const results = [];
  
  for (let i = 0; i < testAddresses.length; i++) {
    const address = testAddresses[i];
    const progress = ((i + 1) / testAddresses.length * 100).toFixed(1);
    
    console.log(`🔄 Testing ${i + 1}/${testAddresses.length} (${progress}%): ${address}`);
    
    try {
      const startTime = Date.now();
      const result = await geocodeAddressWithKakao(address);
      const duration = Date.now() - startTime;
      
      if (result.success) {
        successCount++;
        console.log(`✅ SUCCESS (${duration}ms): ${result.latitude}, ${result.longitude}`);
        console.log(`   📍 Road Address: ${result.roadAddress || 'N/A'}`);
        console.log(`   🏠 Jibun Address: ${result.jibunAddress || 'N/A'}`);
        console.log(`   🏢 Building: ${result.buildingName || 'N/A'}`);
        console.log(`   📮 Postal Code: ${result.postalCode || 'N/A'}`);
        console.log(`   🎯 Address Type: ${result.addressType}`);
        console.log(`   📊 Accuracy: ${result.accuracy}`);
        
        if (result.regionInfo) {
          console.log(`   🗺️  Region: ${result.regionInfo.region1Depth} ${result.regionInfo.region2Depth} ${result.regionInfo.region3Depth}`);
        }
        
        results.push({
          address,
          success: true,
          latitude: result.latitude,
          longitude: result.longitude,
          duration,
          ...result
        });
      } else {
        failCount++;
        console.log(`❌ FAILED (${duration}ms): ${result.error}`);
        results.push({
          address,
          success: false,
          error: result.error,
          duration
        });
      }
      
      // Small delay between requests to respect rate limits
      if (i < testAddresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      failCount++;
      console.log(`❌ ERROR: ${error.message}`);
      results.push({
        address,
        success: false,
        error: error.message,
        duration: 0
      });
    }
    
    console.log(''); // Empty line for readability
  }
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`✅ Successful: ${successCount}/${testAddresses.length}`);
  console.log(`❌ Failed: ${failCount}/${testAddresses.length}`);
  console.log(`📈 Success Rate: ${((successCount / testAddresses.length) * 100).toFixed(1)}%`);
  
  // Show detailed results
  console.log('\n📋 Detailed Results:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.address}`);
    
    if (result.success) {
      console.log(`   📍 ${result.latitude}, ${result.longitude}`);
      console.log(`   🎯 ${result.addressType} (${result.accuracy})`);
      console.log(`   ⏱️  ${result.duration}ms`);
    } else {
      console.log(`   ❌ ${result.error}`);
    }
  });
  
  // Show sample response format
  const successfulResult = results.find(r => r.success);
  if (successfulResult) {
    console.log('\n📄 Sample Response Format:');
    console.log(JSON.stringify({
      success: successfulResult.success,
      latitude: successfulResult.latitude,
      longitude: successfulResult.longitude,
      roadAddress: successfulResult.roadAddress,
      jibunAddress: successfulResult.jibunAddress,
      buildingName: successfulResult.buildingName,
      addressType: successfulResult.addressType,
      accuracy: successfulResult.accuracy,
      regionInfo: successfulResult.regionInfo,
      postalCode: successfulResult.postalCode,
      coordinates: {
        x: successfulResult.x,
        y: successfulResult.y
      }
    }, null, 2));
  }
  
  return results;
}

/**
 * Test with your specific data format
 */
async function testWithYourData() {
  console.log('\n🧪 Testing with your specific data format...\n');
  
  // Simulate the response you provided
  const sampleResponse = {
    "documents": [
      {
        "address": {
          "address_name": "서울 동대문구 청량리동 235-4",
          "b_code": "1123010700",
          "h_code": "1123070500",
          "main_address_no": "235",
          "mountain_yn": "N",
          "region_1depth_name": "서울",
          "region_2depth_name": "동대문구",
          "region_3depth_h_name": "청량리동",
          "region_3depth_name": "청량리동",
          "sub_address_no": "4",
          "x": "127.047103819399",
          "y": "37.5821297708223"
        },
        "address_name": "서울 동대문구 청량리동 235-4",
        "address_type": "REGION_ADDR",
        "road_address": {
          "address_name": "서울 동대문구 왕산로 225",
          "building_name": "미주상가",
          "main_building_no": "225",
          "region_1depth_name": "서울",
          "region_2depth_name": "동대문구",
          "region_3depth_name": "청량리동",
          "road_name": "왕산로",
          "sub_building_no": "",
          "underground_yn": "N",
          "x": "127.047209103701",
          "y": "37.5821227010138",
          "zone_no": "02490"
        },
        "x": "127.047103819399",
        "y": "37.5821297708223"
      }
    ],
    "meta": {
      "is_end": true,
      "pageable_count": 1,
      "total_count": 1
    }
  };
  
  console.log('📄 Your sample response structure:');
  console.log(JSON.stringify(sampleResponse, null, 2));
  
  // Parse the response like our function would
  const location = sampleResponse.documents[0];
  const parsedResult = {
    success: true,
    latitude: parseFloat(location.y),
    longitude: parseFloat(location.x),
    roadAddress: location.road_address?.address_name,
    jibunAddress: location.address?.address_name,
    addressType: location.address_type,
    buildingName: location.road_address?.building_name,
    regionInfo: {
      region1Depth: location.road_address?.region_1depth_name || location.address?.region_1depth_name,
      region2Depth: location.road_address?.region_2depth_name || location.address?.region_2depth_name,
      region3Depth: location.road_address?.region_3depth_name || location.address?.region_3depth_name,
      region3DepthH: location.address?.region_3depth_h_name
    },
    postalCode: location.road_address?.zone_no,
    bCode: location.address?.b_code,
    hCode: location.address?.h_code,
    x: location.x,
    y: location.y,
    meta: sampleResponse.meta
  };
  
  console.log('\n✅ Parsed result:');
  console.log(JSON.stringify(parsedResult, null, 2));
  
  console.log('\n🎯 Key Information Extracted:');
  console.log(`📍 Coordinates: ${parsedResult.latitude}, ${parsedResult.longitude}`);
  console.log(`🏠 Jibun Address: ${parsedResult.jibunAddress}`);
  console.log(`🛣️  Road Address: ${parsedResult.roadAddress}`);
  console.log(`🏢 Building: ${parsedResult.buildingName}`);
  console.log(`📮 Postal Code: ${parsedResult.postalCode}`);
  console.log(`🎯 Address Type: ${parsedResult.addressType}`);
  console.log(`🗺️  Region: ${parsedResult.regionInfo.region1Depth} ${parsedResult.regionInfo.region2Depth} ${parsedResult.regionInfo.region3Depth}`);
}

/**
 * Main function
 */
async function main() {
  try {
    await testGeocoding();
    await testWithYourData();
    
    console.log('\n🎉 All tests completed!');
    console.log('\n📝 Next Steps:');
    console.log('1. Run the import script with your CSV data');
    console.log('2. Check the geocoded results in the output JSON');
    console.log('3. Import to Supabase if everything looks good');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { testGeocoding, testWithYourData };
