#!/usr/bin/env node
/**
 * Enhanced Shop Data Import Script with Naver Maps Integration
 * 
 * Features:
 * - Naver Maps geocoding for accurate Korean addresses
 * - Batch processing with rate limiting
 * - Map visualization data generation
 * - Supabase PostGIS integration
 * - Comprehensive error handling and logging
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const CONFIG = {
  RATE_LIMIT_DELAY: 200, // 200ms between requests (300 requests per minute)
  BATCH_SIZE: 25,
  MAX_RETRIES: 3,
  GEOCODING_TIMEOUT: 5000, // 5 seconds timeout per request
};

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Enhanced business type mapping with Korean variations
const BUSINESS_TYPE_MAPPING = {
  // Hair services
  '일반미용업': 'hair',
  '미용업': 'hair',
  '헤어': 'hair',
  '미용실': 'hair',
  '헤어샵': 'hair',
  
  // Nail services  
  '네일미용업': 'nail',
  '네일아트': 'nail',
  '네일': 'nail',
  '네일샵': 'nail',
  
  // Eyelash services
  '속눈썹연장업': 'eyelash',
  '속눈썹': 'eyelash',
  '래쉬': 'eyelash',
  '아이래쉬': 'eyelash',
  
  // Waxing services
  '왁싱업': 'waxing',
  '왁싱': 'waxing',
  '제모': 'waxing',
  
  // Eyebrow tattoo services
  '반영구화장업': 'eyebrow_tattoo',
  '눈썹문신업': 'eyebrow_tattoo',
  '반영구': 'eyebrow_tattoo',
  '문신': 'eyebrow_tattoo',
  '눈썹': 'eyebrow_tattoo',
  
  // Default fallbacks
  '기타': 'hair',
  '기타미용업': 'hair'
};

/**
 * Clean Korean address by removing floor and room information
 */
function cleanKoreanAddress(address) {
  if (!address) return address;
  
  let cleaned = address
    // Remove floor information (층, 지하, 지상, B1, 1F, etc.)
    .replace(/,?\s*\d+층[^,]*(?=,|$)/g, '')
    .replace(/,?\s*지하\d*층?[^,]*(?=,|$)/g, '')
    .replace(/,?\s*지상\d*층?[^,]*(?=,|$)/g, '')
    .replace(/,?\s*B\d+[^,]*(?=,|$)/g, '')
    .replace(/,?\s*\d+F[^,]*(?=,|$)/g, '')
    
    // Remove room/unit numbers (호, 동)
    .replace(/,?\s*\d+호[^,]*(?=,|$)/g, '')
    .replace(/,?\s*\d+동\s*\d+층[^,]*(?=,|$)/g, '')
    .replace(/,?\s*\d+동\s*\d+호[^,]*(?=,|$)/g, '')
    
    // Remove parenthetical details but keep main building names
    .replace(/,?\s*\([^)]*상가[^)]*\)/g, '') // Remove shopping complex details in parentheses
    .replace(/,?\s*\([^)]*동[^)]*\)/g, '') // Remove building section details
    
    // Remove specific patterns
    .replace(/,?\s*지하\s+\d+/g, '') // Remove "지하 58" type patterns
    .replace(/,?\s*[가-힣]*상가[^,]*(?=,|$)/g, '') // Remove shopping complex details
    
    // Clean up extra commas, spaces, and unmatched parentheses
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,|,\s*$/g, '')
    .replace(/\s*\)\s*$/g, '') // Remove trailing unmatched parentheses
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
    
  return cleaned;
}

/**
 * Enhanced geocoding with Nominatim (OpenStreetMap) - FREE and WORKING
 * Uses Nominatim API for Korean address geocoding with address cleaning
 */
async function geocodeAddressWithNominatim(address, options = {}, retryCount = 0) {
  try {
    // Clean the address first
    const cleanedAddress = cleanKoreanAddress(address);
    
    if (cleanedAddress !== address) {
      console.log(`   🧹 Cleaned address: "${address}" → "${cleanedAddress}"`);
    }
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Geocoding timeout')), CONFIG.GEOCODING_TIMEOUT);
    });
    
    // Create geocoding promise - Nominatim (OpenStreetMap) API
    const geocodingPromise = fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanedAddress)}&format=json&limit=1&countrycodes=kr`,
      {
        headers: {
          'User-Agent': 'ShopDataImporter/1.0'
        }
      }
    );
    
    // Race between geocoding and timeout
    const response = await Promise.race([geocodingPromise, timeoutPromise]);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle successful response
    if (data && data.length > 0) {
      const location = data[0];
      
      return {
        success: true,
        latitude: parseFloat(location.lat),
        longitude: parseFloat(location.lon),
        
        // Address information
        addressName: location.display_name,
        addressType: 'NOMINATIM',
        roadAddress: location.display_name,
        jibunAddress: location.display_name,
        
        // Building and location details
        buildingName: location.name || '',
        roadName: null,
        mainBuildingNo: null,
        subBuildingNo: null,
        undergroundYn: 'N',
        
        // Regional information (parsed from display_name)
        regionInfo: {
          region1Depth: null,
          region2Depth: null,
          region3Depth: null,
          region3DepthH: null
        },
        
        // Postal and administrative codes
        postalCode: null,
        bCode: null,
        hCode: null,
        
        // Address components
        mountainYn: 'N',
        mainAddressNo: null,
        subAddressNo: null,
        
        // Coordinate information
        x: location.lon, // longitude
        y: location.lat, // latitude
        
        // Quality and metadata
        accuracy: 'medium',
        totalCount: data.length,
        pageableCount: data.length,
        isEnd: true,
        meta: {
          service: 'Nominatim',
          place_id: location.place_id,
          osm_type: location.osm_type,
          osm_id: location.osm_id,
          class: location.class,
          type: location.type,
          importance: location.importance,
          cleaned_address: cleanedAddress,
          original_address: address
        },
        
        // Raw response for debugging
        rawResponse: options.includeRaw ? data : null
      };
    }
    
    // Handle case where no results found
    return {
      success: false,
      error: `No coordinates found for address: ${address} (cleaned: ${cleanedAddress})`,
      latitude: null,
      longitude: null,
      accuracy: 'none',
      meta: null
    };
    
  } catch (error) {
    // Retry logic with exponential backoff
    if (retryCount < CONFIG.MAX_RETRIES) {
      const delay = CONFIG.RATE_LIMIT_DELAY * Math.pow(2, retryCount);
      console.log(`🔄 Retrying geocoding for: ${address} (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return geocodeAddressWithNominatim(address, options, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      latitude: null,
      longitude: null,
      accuracy: 'failed',
      retryCount: retryCount
    };
  }
}

/**
 * Enhanced shop data conversion with better categorization
 */
async function convertShopDataEnhanced(koreanData, enableGeocoding = true) {
  const {
    사업장명: businessName,
    지번주소: lotAddress,
    전화번호: phoneNumber,
    업태구분명: businessType,
    위생업태명: hygieneBusiness,
    좌석수: seatCount,
    도로명주소: roadAddress,
    소재지우편번호: postalCode,
    인허가일자: licenseDate
  } = koreanData;

  // Determine the best address to use for geocoding
  const primaryAddress = roadAddress?.trim() || lotAddress?.trim();
  
  // Get coordinates if geocoding is enabled
  let geocodingResult = { latitude: null, longitude: null, accuracy: 'none' };
  if (enableGeocoding && primaryAddress) {
    geocodingResult = await geocodeAddressWithNominatim(primaryAddress);
  }
  
  // Enhanced category determination
  const businessTypeText = `${businessType} ${hygieneBusiness}`.toLowerCase();
  let mainCategory = 'hair'; // Default
  let subCategories = [];
  
  // Find the best matching category
  for (const [korean, category] of Object.entries(BUSINESS_TYPE_MAPPING)) {
    if (businessTypeText.includes(korean.toLowerCase())) {
      if (mainCategory === 'hair') { // If still default, set as main
        mainCategory = category;
      }
      if (!subCategories.includes(category)) {
        subCategories.push(category);
      }
    }
  }
  
  // Enhanced phone number formatting
  const formattedPhone = formatPhoneNumberEnhanced(phoneNumber);
  
  // Create comprehensive shop data
  const shopData = {
    name: businessName?.trim(),
    description: generateShopDescription(businessType, hygieneBusiness, seatCount),
    phone_number: formattedPhone,
    email: null,
    address: primaryAddress,
    detailed_address: roadAddress !== lotAddress ? lotAddress?.trim() : null,
    postal_code: postalCode?.replace(/[^\d]/g, '').slice(0, 10),
    latitude: geocodingResult.latitude,
    longitude: geocodingResult.longitude,
    
    // PostGIS location point (if coordinates available)
    location: geocodingResult.latitude && geocodingResult.longitude 
      ? `POINT(${geocodingResult.longitude} ${geocodingResult.latitude})`
      : null,
      
    shop_type: 'non_partnered',
    shop_status: 'pending_approval',
    verification_status: 'pending',
    business_license_number: null,
    business_license_image_url: null,
    main_category: mainCategory,
    sub_categories: subCategories.length > 0 ? subCategories : [mainCategory],
    
    // Enhanced operating hours based on business type
    operating_hours: generateOperatingHours(businessType),
    payment_methods: ['card', 'bank_transfer', 'kakao_pay'],
    kakao_channel_url: null,
    total_bookings: 0,
    partnership_started_at: licenseDate ? new Date(licenseDate).toISOString() : null,
    featured_until: null,
    is_featured: false,
    commission_rate: 10.00,
    
    // Note: import_metadata removed to match actual Supabase schema
  };

  return shopData;
}

/**
 * Enhanced phone number formatting for Korean numbers
 */
function formatPhoneNumberEnhanced(phone) {
  if (!phone) return null;
  
  // Remove all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle different Korean phone number formats
  if (cleaned.startsWith('+82')) {
    return cleaned; // Already formatted
  }
  
  if (cleaned.startsWith('02')) {
    // Seoul landline: 02-XXXX-XXXX
    if (cleaned.length === 9) {
      return `+82-2-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
    } else if (cleaned.length === 10) {
      return `+82-2-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
  } else if (cleaned.startsWith('0')) {
    // Mobile or other area codes
    if (cleaned.length === 10) {
      return `+82-${cleaned.slice(1, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 11) {
      return `+82-${cleaned.slice(1, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
  }
  
  // Fallback: add +82 prefix
  return `+82-${cleaned}`;
}

/**
 * Generate shop description based on business type and seat count
 */
function generateShopDescription(businessType, hygieneBusiness, seatCount) {
  const services = hygieneBusiness || businessType || 'Beauty services';
  const seats = parseInt(seatCount) || 0;
  
  let description = `${services} 전문샵`;
  
  if (seats > 0) {
    description += ` | ${seats}석 운영`;
  }
  
  // Add service-specific descriptions
  if (services.includes('네일')) {
    description += ' | 네일아트 및 네일케어 전문';
  } else if (services.includes('미용')) {
    description += ' | 헤어컷, 염색, 펌 전문';
  } else if (services.includes('속눈썹')) {
    description += ' | 속눈썹 연장 및 관리 전문';
  }
  
  return description;
}

/**
 * Generate operating hours based on business type
 */
function generateOperatingHours(businessType) {
  // Hair salons typically open later, close later
  if (businessType?.includes('미용')) {
    return {
      monday: { open: '10:00', close: '22:00', closed: false },
      tuesday: { open: '10:00', close: '22:00', closed: false },
      wednesday: { open: '10:00', close: '22:00', closed: false },
      thursday: { open: '10:00', close: '22:00', closed: false },
      friday: { open: '10:00', close: '22:00', closed: false },
      saturday: { open: '09:00', close: '21:00', closed: false },
      sunday: { open: '10:00', close: '20:00', closed: false }
    };
  }
  
  // Default hours for other businesses
  return {
    monday: { open: '09:00', close: '21:00', closed: false },
    tuesday: { open: '09:00', close: '21:00', closed: false },
    wednesday: { open: '09:00', close: '21:00', closed: false },
    thursday: { open: '09:00', close: '21:00', closed: false },
    friday: { open: '09:00', close: '21:00', closed: false },
    saturday: { open: '09:00', close: '20:00', closed: false },
    sunday: { open: '10:00', close: '18:00', closed: false }
  };
}

/**
 * Import shops to Supabase with enhanced error handling
 */
async function importShopsToSupabaseEnhanced(shops, options = {}) {
  const { dryRun = false, batchSize = 10 } = options;
  
  console.log(`\n🏪 Importing ${shops.length} shops to Supabase...`);
  
  if (dryRun) {
    console.log('🧪 DRY RUN MODE - No data will be inserted\n');
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const imported = [];

  // Process in batches
  for (let i = 0; i < shops.length; i += batchSize) {
    const batch = shops.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(shops.length / batchSize);
    
    console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} shops)`);

    if (!dryRun) {
      try {
        // Insert batch to Supabase
        const { data, error } = await supabase
          .from('shops')
          .insert(batch)
          .select('id, name, latitude, longitude, main_category');

        if (error) {
          console.log(`❌ Batch ${batchNumber} failed:`, error.message);
          errorCount += batch.length;
          errors.push({ batch: batchNumber, error: error.message, shops: batch.map(s => s.name) });
        } else {
          successCount += data.length;
          imported.push(...data);
          console.log(`✅ Batch ${batchNumber} imported successfully (${data.length} shops)`);
        }
      } catch (error) {
        console.log(`❌ Unexpected error in batch ${batchNumber}:`, error.message);
        errorCount += batch.length;
        errors.push({ batch: batchNumber, error: error.message, shops: batch.map(s => s.name) });
      }
    } else {
      // Dry run - just validate
      batch.forEach(shop => {
        const validationErrors = validateShopDataEnhanced(shop);
        if (validationErrors.length === 0) {
          successCount++;
          console.log(`✅ Would import: ${shop.name}`);
        } else {
          errorCount++;
          console.log(`❌ Validation failed for ${shop.name}:`, validationErrors);
        }
      });
    }

    // Small delay between batches
    if (i + batchSize < shops.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Generate summary
  console.log('\n📊 Import Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📈 Success Rate: ${((successCount / shops.length) * 100).toFixed(1)}%`);

  if (errors.length > 0 && !dryRun) {
    console.log('\n❌ Batch Errors:');
    errors.forEach(({ batch, error, shops }) => {
      console.log(`   Batch ${batch}: ${error}`);
      console.log(`   Affected shops: ${shops.slice(0, 3).join(', ')}${shops.length > 3 ? '...' : ''}`);
    });
  }

  return { 
    successCount, 
    errorCount, 
    errors, 
    imported: dryRun ? [] : imported 
  };
}

/**
 * Enhanced validation with geocoding checks
 */
function validateShopDataEnhanced(shopData) {
  const errors = [];

  // Required fields
  if (!shopData.name?.trim()) {
    errors.push('Shop name is required');
  }

  if (!shopData.address?.trim()) {
    errors.push('Address is required');
  }

  if (!shopData.main_category) {
    errors.push('Main category is required');
  }

  // Validate enum values
  const validCategories = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];
  if (!validCategories.includes(shopData.main_category)) {
    errors.push(`Invalid main category: ${shopData.main_category}`);
  }

  // Check geocoding quality
  if (shopData.latitude && shopData.longitude) {
    // Check if coordinates are within South Korea bounds
    const koreaLatBounds = [33.0, 38.6]; // Approximate latitude bounds for South Korea
    const koreaLngBounds = [124.5, 131.9]; // Approximate longitude bounds for South Korea
    
    if (shopData.latitude < koreaLatBounds[0] || shopData.latitude > koreaLatBounds[1]) {
      errors.push('Latitude outside South Korea bounds');
    }
    
    if (shopData.longitude < koreaLngBounds[0] || shopData.longitude > koreaLngBounds[1]) {
      errors.push('Longitude outside South Korea bounds');
    }
  }

  return errors;
}

/**
 * Generate comprehensive map data for visualization
 */
function generateMapVisualizationData(geocodedShops) {
  const validShops = geocodedShops.filter(shop => 
    shop.latitude && 
    shop.longitude
  );

  if (validShops.length === 0) {
    return {
      center: { lat: 37.5665, lng: 126.9780 },
      zoom: 10,
      markers: [],
      bounds: null,
      statistics: {
        total: geocodedShops.length,
        geocoded: 0,
        categories: {}
      }
    };
  }

  // Calculate bounds
  const latitudes = validShops.map(shop => shop.latitude);
  const longitudes = validShops.map(shop => shop.longitude);
  
  const bounds = {
    north: Math.max(...latitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    west: Math.min(...longitudes)
  };

  // Calculate center
  const center = {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2
  };

  // Generate category statistics
  const categoryStats = {};
  validShops.forEach(shop => {
    const category = shop.main_category;
    categoryStats[category] = (categoryStats[category] || 0) + 1;
  });

  // Create markers with enhanced info
  const markers = validShops.map((shop, index) => ({
    id: `shop-${index}`,
    position: {
      lat: shop.latitude,
      lng: shop.longitude
    },
    title: shop.name,
    category: shop.main_category,
    accuracy: 'medium', // Default since we removed import_metadata
    infoWindow: {
      content: `
        <div style="padding: 15px; min-width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #333;">
            ${shop.name}
          </h3>
          <div style="margin: 8px 0; font-size: 13px; color: #666; line-height: 1.5;">
            <div style="margin: 4px 0; display: flex; align-items: center;">
              📍 ${shop.address}
            </div>
            ${shop.phone_number ? `
              <div style="margin: 4px 0; display: flex; align-items: center;">
                📞 <a href="tel:${shop.phone_number}" style="color: #007bff; text-decoration: none; margin-left: 4px;">${shop.phone_number}</a>
              </div>
            ` : ''}
            <div style="margin: 4px 0; display: flex; align-items: center;">
              🏪 ${shop.main_category} ${shop.sub_categories?.length > 1 ? `(+${shop.sub_categories.length - 1} more)` : ''}
            </div>
            <div style="margin: 4px 0; font-size: 11px; color: #999;">
              📍 Geocoded with Nominatim
            </div>
          </div>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button 
              onclick="window.open('/admin/shops/${shop.id || 'new'}', '_blank')"
              style="
                background: #007bff; 
                color: white; 
                border: none; 
                padding: 8px 12px; 
                border-radius: 4px; 
                font-size: 12px; 
                cursor: pointer;
                flex: 1;
              "
            >
              Manage Shop
            </button>
            ${shop.phone_number ? `
              <button 
                onclick="window.open('tel:${shop.phone_number}')"
                style="
                  background: #28a745; 
                  color: white; 
                  border: none; 
                  padding: 8px 12px; 
                  border-radius: 4px; 
                  font-size: 12px; 
                  cursor: pointer;
                "
              >
                📞
              </button>
            ` : ''}
          </div>
        </div>
      `
    }
  }));

  return {
    center,
    zoom: calculateOptimalZoom(bounds),
    bounds,
    markers,
    statistics: {
      total: geocodedShops.length,
      geocoded: validShops.length,
      categories: categoryStats,
      geocodingSuccessRate: ((validShops.length / geocodedShops.length) * 100).toFixed(1)
    }
  };
}

/**
 * Calculate optimal zoom level based on bounds
 */
function calculateOptimalZoom(bounds) {
  const latDiff = bounds.north - bounds.south;
  const lngDiff = bounds.east - bounds.west;
  const maxDiff = Math.max(latDiff, lngDiff);
  
  if (maxDiff > 5) return 8;
  if (maxDiff > 2) return 10;
  if (maxDiff > 1) return 11;
  if (maxDiff > 0.5) return 12;
  if (maxDiff > 0.1) return 13;
  return 14;
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🏪 Enhanced Shop Data Import Script with Nominatim Geocoding

Usage: node scripts/enhanced-shop-import.js <csv-file-path> [options]

Options:
  --geocode              Enable geocoding with Nominatim (OpenStreetMap) API
  --output=file          Save converted data to JSON file
  --map-data=file        Save map visualization data
  --import               Import directly to Supabase (requires --output)
  --dry-run              Preview import without inserting data
  --batch-size=N         Process N records at a time (default: 25)

Examples:
  # Geocode and save to file
  node scripts/enhanced-shop-import.js shop-data.csv --geocode --output=shops.json --map-data=map.json
  
  # Import to Supabase after geocoding
  node scripts/enhanced-shop-import.js shop-data.csv --geocode --output=shops.json --import
  
  # Dry run to test
  node scripts/enhanced-shop-import.js shop-data.csv --geocode --dry-run

Required Environment Variables:
  SUPABASE_URL=your_supabase_url
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  # No API key required for Nominatim (free service)

CSV Format Expected:
  사업장명,지번주소,전화번호,업태구분명,위생업태명,좌석수,도로명주소,소재지우편번호,인허가일자
`);
    process.exit(1);
  }

  const csvFilePath = args[0];
  const options = {
    enableGeocoding: args.includes('--geocode'),
    outputFile: args.find(arg => arg.startsWith('--output='))?.split('=')[1],
    mapDataFile: args.find(arg => arg.startsWith('--map-data='))?.split('=')[1],
    shouldImport: args.includes('--import'),
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || CONFIG.BATCH_SIZE
  };

  // Validation
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    process.exit(1);
  }

  if (options.shouldImport && !options.outputFile) {
    console.error('❌ --output is required when using --import');
    process.exit(1);
  }

  if (options.enableGeocoding) {
    console.log('✅ Using Nominatim (OpenStreetMap) for geocoding - no API key required');
  }

  console.log('🚀 Starting enhanced shop data processing...');
  console.log(`📁 Input file: ${csvFilePath}`);
  console.log(`⚙️  Options:`, options);

  const rawData = [];

  // Read and process CSV
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath, { encoding: 'utf8' })
      .pipe(csv())
      .on('data', (data) => {
        rawData.push(data);
      })
      .on('end', async () => {
        try {
          console.log(`\n📊 Found ${rawData.length} records in CSV`);
          
          if (options.enableGeocoding) {
            console.log('🗺️  Geocoding enabled - this may take a while...');
            console.log(`⏱️  Estimated time: ${Math.ceil((rawData.length * CONFIG.RATE_LIMIT_DELAY) / 1000 / 60)} minutes`);
          }

          const convertedShops = [];
          
          // Convert each record
          for (let i = 0; i < rawData.length; i++) {
            const record = rawData[i];
            const progress = ((i + 1) / rawData.length * 100).toFixed(1);
            
            console.log(`🔄 Processing ${i + 1}/${rawData.length} (${progress}%): ${record.사업장명}`);

            try {
              const convertedShop = await convertShopDataEnhanced(record, options.enableGeocoding);
              convertedShops.push(convertedShop);
              
              if (options.enableGeocoding && i < rawData.length - 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY));
              }
            } catch (error) {
              console.log(`❌ Failed to convert ${record.사업장명}:`, error.message);
            }
          }

          console.log(`\n✅ Successfully converted ${convertedShops.length} shops`);

          // Save converted data
          if (options.outputFile) {
            fs.writeFileSync(options.outputFile, JSON.stringify(convertedShops, null, 2));
            console.log(`💾 Converted data saved to: ${options.outputFile}`);
          }

          // Generate map visualization data
          if (options.mapDataFile) {
            const mapData = generateMapVisualizationData(convertedShops);
            fs.writeFileSync(options.mapDataFile, JSON.stringify(mapData, null, 2));
            console.log(`🗺️  Map visualization data saved to: ${options.mapDataFile}`);
            
            console.log(`\n📍 Map Statistics:`);
            console.log(`   📊 Total shops: ${mapData.statistics.total}`);
            console.log(`   📍 Geocoded: ${mapData.statistics.geocoded}`);
            console.log(`   📈 Success rate: ${mapData.statistics.geocodingSuccessRate}%`);
            console.log(`   🗺️  Optimal zoom: ${mapData.zoom}`);
            
            Object.entries(mapData.statistics.categories).forEach(([category, count]) => {
              console.log(`   ${getCategoryIcon(category)} ${category}: ${count}`);
            });
          }

          // Import to Supabase if requested
          if (options.shouldImport) {
            const importResult = await importShopsToSupabaseEnhanced(convertedShops, {
              dryRun: options.dryRun,
              batchSize: options.batchSize
            });
            
            if (importResult.errorCount === 0) {
              console.log('\n🎉 All shops imported successfully!');
            } else {
              console.log(`\n⚠️  Import completed with ${importResult.errorCount} errors`);
            }
          }

          resolve();
        } catch (error) {
          console.error('❌ Processing failed:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV file:', error);
        reject(error);
      });
  });
}

function getCategoryIcon(category) {
  const icons = {
    nail: '💅',
    hair: '💇',
    eyelash: '👁️',
    waxing: '✨',
    eyebrow_tattoo: '🎨',
    facial: '🧴',
    massage: '💆'
  };
  return icons[category] || '🏪';
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  convertShopDataEnhanced,
  geocodeAddressWithNominatim,
  generateMapVisualizationData,
  importShopsToSupabaseEnhanced
};
