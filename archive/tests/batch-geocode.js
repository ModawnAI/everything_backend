#!/usr/bin/env node
/**
 * Batch Geocoding Script for Shop Data
 * 
 * Uses Naver Maps API to geocode shop addresses in batches
 * with rate limiting and error handling
 */

const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

// Rate limiting configuration
const RATE_LIMIT_DELAY = 300; // 300ms between requests (200 requests per minute max)
const BATCH_SIZE = 50; // Process 50 addresses at a time
const MAX_RETRIES = 3;

/**
 * Geocode address using Kakao Maps API
 */
async function geocodeAddress(address, retryCount = 0) {
  try {
    const kakaoApiKey = process.env.KAKAO_MAPS_API_KEY;
    
    if (!kakaoApiKey) {
      throw new Error('Kakao Maps API key not found');
    }
    
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      {
        headers: {
          'Authorization': `KakaoAK ${kakaoApiKey}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.documents && data.documents.length > 0) {
      const location = data.documents[0];
      return {
        success: true,
        latitude: parseFloat(location.y),
        longitude: parseFloat(location.x),
        roadAddress: location.road_address?.address_name,
        jibunAddress: location.address?.address_name,
        englishAddress: null, // Kakao doesn't provide English addresses
        addressType: location.address_type,
        x: location.x,
        y: location.y,
        // Additional Kakao-specific data
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
        meta: data.meta
      };
    }
    
    return {
      success: false,
      error: 'No coordinates found',
      latitude: null,
      longitude: null
    };
    
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying geocoding for: ${address} (attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retryCount + 1)));
      return geocodeAddress(address, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      latitude: null,
      longitude: null
    };
  }
}

/**
 * Process addresses in batches with rate limiting
 */
async function batchGeocodeAddresses(addresses) {
  const results = [];
  const total = addresses.length;
  let processed = 0;
  let successful = 0;
  let failed = 0;

  console.log(`🚀 Starting batch geocoding for ${total} addresses`);
  console.log(`⏱️  Rate limit: ${RATE_LIMIT_DELAY}ms delay between requests`);
  console.log(`📦 Batch size: ${BATCH_SIZE} addresses per batch\n`);

  // Process in batches
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(addresses.length / BATCH_SIZE);
    
    console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} addresses)`);
    
    for (const addressData of batch) {
      const { address, originalData } = addressData;
      
      try {
        const result = await geocodeAddress(address);
        
        results.push({
          ...originalData,
          geocoding: result,
          processed_at: new Date().toISOString()
        });
        
        if (result.success) {
          successful++;
          console.log(`✅ ${originalData.사업장명}: ${result.latitude}, ${result.longitude}`);
        } else {
          failed++;
          console.log(`❌ ${originalData.사업장명}: ${result.error}`);
        }
        
        processed++;
        
        // Progress indicator
        if (processed % 10 === 0) {
          const progress = ((processed / total) * 100).toFixed(1);
          console.log(`📊 Progress: ${progress}% (${processed}/${total})`);
        }
        
        // Rate limiting delay
        if (processed < total) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
        
      } catch (error) {
        failed++;
        console.log(`❌ ${originalData.사업장명}: Unexpected error - ${error.message}`);
        
        results.push({
          ...originalData,
          geocoding: {
            success: false,
            error: error.message,
            latitude: null,
            longitude: null
          },
          processed_at: new Date().toISOString()
        });
      }
    }
    
    // Longer delay between batches
    if (i + BATCH_SIZE < addresses.length) {
      console.log(`⏸️  Batch complete, waiting 2 seconds before next batch...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n📊 Geocoding Summary:');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((successful / total) * 100).toFixed(1)}%`);

  return results;
}

/**
 * Generate map visualization data
 */
function generateMapVisualizationData(geocodedData) {
  const mapData = {
    center: { lat: 37.5665, lng: 126.9780 }, // Seoul default
    zoom: 10,
    markers: [],
    bounds: {
      north: -90,
      south: 90,
      east: -180,
      west: 180
    }
  };

  const validLocations = geocodedData.filter(item => 
    item.geocoding.success && 
    item.geocoding.latitude && 
    item.geocoding.longitude
  );

  if (validLocations.length === 0) {
    return mapData;
  }

  // Create markers
  mapData.markers = validLocations.map((item, index) => ({
    id: `shop-${index}`,
    position: {
      lat: item.geocoding.latitude,
      lng: item.geocoding.longitude
    },
    title: item.사업장명,
    content: `
      <div style="padding: 10px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-weight: bold;">${item.사업장명}</h3>
        <p style="margin: 4px 0; font-size: 12px; color: #666;">
          📍 ${item.도로명주소 || item.지번주소}
        </p>
        <p style="margin: 4px 0; font-size: 12px; color: #666;">
          📞 ${item.전화번호}
        </p>
        <p style="margin: 4px 0; font-size: 12px; color: #666;">
          🏪 ${item.위생업태명}
        </p>
        <p style="margin: 4px 0; font-size: 12px; color: #666;">
          💺 ${item.좌석수}석
        </p>
      </div>
    `,
    category: item.위생업태명,
    businessType: item.업태구분명
  }));

  // Calculate bounds
  const latitudes = validLocations.map(item => item.geocoding.latitude);
  const longitudes = validLocations.map(item => item.geocoding.longitude);
  
  mapData.bounds = {
    north: Math.max(...latitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    west: Math.min(...longitudes)
  };

  // Calculate center
  mapData.center = {
    lat: (mapData.bounds.north + mapData.bounds.south) / 2,
    lng: (mapData.bounds.east + mapData.bounds.west) / 2
  };

  return mapData;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🗺️  Shop Data Geocoding Script

Usage: node scripts/batch-geocode.js <csv-file-path> [options]

Options:
  --output=file      Save geocoded data to JSON file (required)
  --map-data=file    Save map visualization data to separate file
  --batch-size=N     Process N records at a time (default: 50)
  --delay=N          Delay between requests in ms (default: 300)

Example:
  node scripts/batch-geocode.js shop-data.csv --output=geocoded-shops.json --map-data=map-data.json

Required Environment Variables:
  KAKAO_MAPS_API_KEY=your_kakao_api_key
`);
    process.exit(1);
  }

  const csvFilePath = args[0];
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const mapDataFile = args.find(arg => arg.startsWith('--map-data='))?.split('=')[1];
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || BATCH_SIZE;

  if (!outputFile) {
    console.error('❌ --output parameter is required');
    process.exit(1);
  }

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    process.exit(1);
  }

  console.log('🚀 Starting batch geocoding...');
  console.log(`📁 Input file: ${csvFilePath}`);
  console.log(`💾 Output file: ${outputFile}`);
  if (mapDataFile) {
    console.log(`🗺️  Map data file: ${mapDataFile}`);
  }

  const rawData = [];

  // Read CSV file
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        rawData.push(data);
      })
      .on('end', async () => {
        try {
          console.log(`\n📊 Found ${rawData.length} records in CSV`);
          
          // Prepare addresses for geocoding
          const addressesToGeocode = rawData.map(record => ({
            address: record.도로명주소 || record.지번주소,
            originalData: record
          }));

          // Perform batch geocoding
          const geocodedResults = await batchGeocodeAddresses(addressesToGeocode);

          // Save geocoded data
          fs.writeFileSync(outputFile, JSON.stringify(geocodedResults, null, 2));
          console.log(`\n💾 Geocoded data saved to: ${outputFile}`);

          // Generate and save map visualization data
          if (mapDataFile) {
            const mapData = generateMapVisualizationData(geocodedResults);
            fs.writeFileSync(mapDataFile, JSON.stringify(mapData, null, 2));
            console.log(`🗺️  Map visualization data saved to: ${mapDataFile}`);
            
            console.log(`\n📍 Map Statistics:`);
            console.log(`   Total markers: ${mapData.markers.length}`);
            console.log(`   Center: ${mapData.center.lat.toFixed(6)}, ${mapData.center.lng.toFixed(6)}`);
            console.log(`   Bounds: ${mapData.bounds.south.toFixed(6)} to ${mapData.bounds.north.toFixed(6)} (lat)`);
            console.log(`           ${mapData.bounds.west.toFixed(6)} to ${mapData.bounds.east.toFixed(6)} (lng)`);
          }

          // Generate statistics
          const successful = geocodedResults.filter(item => item.geocoding.success).length;
          const failed = geocodedResults.length - successful;
          
          console.log(`\n🎉 Batch geocoding complete!`);
          console.log(`📊 Final Statistics:`);
          console.log(`   ✅ Successfully geocoded: ${successful}`);
          console.log(`   ❌ Failed to geocode: ${failed}`);
          console.log(`   📈 Success rate: ${((successful / geocodedResults.length) * 100).toFixed(1)}%`);
          
          if (failed > 0) {
            console.log('\n❌ Failed addresses:');
            geocodedResults
              .filter(item => !item.geocoding.success)
              .forEach(item => {
                console.log(`   - ${item.사업장명}: ${item.geocoding.error}`);
              });
          }

          resolve();
        } catch (error) {
          console.error('❌ Batch geocoding failed:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV file:', error);
        reject(error);
      });
  });
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}
