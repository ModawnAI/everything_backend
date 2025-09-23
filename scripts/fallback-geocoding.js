#!/usr/bin/env node
/**
 * Fallback Geocoding Script
 * 
 * Tests multiple geocoding services as fallbacks
 * for when Kakao Maps API is not available
 */

require('dotenv').config();

/**
 * Kakao Maps Geocoding
 */
async function geocodeWithKakao(address) {
  const apiKey = process.env.KAKAO_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error('KAKAO_MAPS_API_KEY not found');
  }
  
  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
    {
      headers: {
        'Authorization': `KakaoAK ${apiKey}`
      }
    }
  );
  
  const data = await response.json();
  
  if (response.ok && data.documents?.length > 0) {
    const doc = data.documents[0];
    return {
      success: true,
      latitude: parseFloat(doc.y),
      longitude: parseFloat(doc.x),
      address: doc.address_name,
      roadAddress: doc.road_address?.address_name,
      buildingName: doc.road_address?.building_name,
      service: 'Kakao Maps',
      accuracy: 'high'
    };
  }
  
  throw new Error(data.message || 'No results from Kakao');
}

/**
 * OpenStreetMap Nominatim Geocoding (Free)
 */
async function geocodeWithNominatim(address) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=kr`,
    {
      headers: {
        'User-Agent': 'ShopDataImporter/1.0'
      }
    }
  );
  
  const data = await response.json();
  
  if (data.length > 0) {
    return {
      success: true,
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      address: data[0].display_name,
      service: 'Nominatim (OSM)',
      accuracy: 'medium'
    };
  }
  
  throw new Error('No results from Nominatim');
}

/**
 * Google Maps Geocoding (Requires API key and billing)
 */
async function geocodeWithGoogle(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY not found');
  }
  
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=kr`
  );
  
  const data = await response.json();
  
  if (data.status === 'OK' && data.results?.length > 0) {
    const result = data.results[0];
    return {
      success: true,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      address: result.formatted_address,
      service: 'Google Maps',
      accuracy: 'high'
    };
  }
  
  throw new Error(data.error_message || 'No results from Google');
}

/**
 * Fallback geocoding with multiple services
 */
async function geocodeWithFallback(address) {
  const services = [
    { name: 'Kakao Maps', func: geocodeWithKakao },
    { name: 'Nominatim', func: geocodeWithNominatim },
    { name: 'Google Maps', func: geocodeWithGoogle }
  ];
  
  console.log(`🔍 Geocoding: ${address}`);
  
  for (const service of services) {
    try {
      console.log(`   Trying ${service.name}...`);
      const result = await service.func(address);
      
      console.log(`   ✅ Success with ${result.service}!`);
      return result;
      
    } catch (error) {
      console.log(`   ❌ ${service.name} failed: ${error.message}`);
      
      // Rate limiting between services
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return {
    success: false,
    error: 'All geocoding services failed',
    latitude: null,
    longitude: null
  };
}

/**
 * Test multiple addresses
 */
async function testFallbackGeocoding() {
  console.log('🧪 Testing Fallback Geocoding Services\n');
  
  const testAddresses = [
    '서울특별시 동대문구 청량리동 235-4번지',
    '서울특별시 강남구 테헤란로 123',
    '서울역',
    '부산광역시 해운대구 센텀중앙로 55'
  ];
  
  const results = [];
  
  for (const address of testAddresses) {
    const result = await geocodeWithFallback(address);
    results.push({ address, ...result });
    
    console.log(''); // Empty line between tests
    
    // Delay between addresses
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('📊 Summary:');
  console.log('=' .repeat(80));
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.address}`);
    
    if (result.success) {
      console.log(`   📍 ${result.latitude}, ${result.longitude}`);
      console.log(`   🛠️  Service: ${result.service} (${result.accuracy})`);
    } else {
      console.log(`   ❌ ${result.error}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n📈 Success Rate: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
  
  return results;
}

// Run the test
if (require.main === module) {
  testFallbackGeocoding().catch(console.error);
}

module.exports = { geocodeWithFallback, geocodeWithKakao, geocodeWithNominatim, geocodeWithGoogle };
