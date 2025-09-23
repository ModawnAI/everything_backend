#!/usr/bin/env node
/**
 * Check Kakao Maps API Status
 */

async function checkKakaoStatus() {
  const apiKey = 'a25a98041ce003495ab0d5c8aa14072f';
  
  console.log('🔍 Checking Kakao Maps API status...\n');
  
  try {
    const response = await fetch(
      'https://dapi.kakao.com/v2/local/search/address.json?query=서울역',
      {
        headers: {
          'Authorization': `KakaoAK ${apiKey}`
        }
      }
    );
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS! Kakao Maps API is working');
      console.log(`📍 Found ${data.documents?.length || 0} results`);
      
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        console.log(`   Address: ${doc.address_name}`);
        console.log(`   Coordinates: ${doc.y}, ${doc.x}`);
        console.log(`   Type: ${doc.address_type}`);
      }
    } else {
      console.log('❌ API Error:');
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Error: ${data.message || 'Unknown error'}`);
      
      if (data.message && data.message.includes('disabled')) {
        console.log('\n💡 Solution:');
        console.log('   1. Go to https://developers.kakao.com/');
        console.log('   2. Select your app "ChitChat - 칫챗-TEST"');
        console.log('   3. Enable "카카오맵" (Kakao Map) service');
        console.log('   4. Wait a few minutes for activation');
      }
    }
    
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
}

checkKakaoStatus();
