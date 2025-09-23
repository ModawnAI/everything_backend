#!/usr/bin/env node
/**
 * Shop Data Import Script
 * 
 * Converts Korean shop data CSV to Supabase-compatible format
 * 
 * Usage: node scripts/import-shop-data.js <csv-file-path> [options]
 * 
 * CSV Format Expected:
 * 사업장명,지번주소,전화번호,업태구분명,위생업태명,좌석수,도로명주소,소재지우편번호,인허가일자
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Korean business type to service category mapping
const BUSINESS_TYPE_MAPPING = {
  '일반미용업': 'hair',
  '네일미용업': 'nail',
  '속눈썹연장업': 'eyelash',
  '왁싱업': 'waxing',
  '반영구화장업': 'eyebrow_tattoo',
  '눈썹문신업': 'eyebrow_tattoo',
  '피부미용업': 'facial',
  '마사지업': 'massage',
  '에스테틱': 'facial',
  '네일아트': 'nail',
  '헤어': 'hair',
  '미용': 'hair',
  '네일': 'nail',
  '속눈썹': 'eyelash',
  '왁싱': 'waxing',
  '문신': 'eyebrow_tattoo',
  '반영구': 'eyebrow_tattoo'
};

// Default operating hours (9 AM to 9 PM, Monday to Saturday)
const DEFAULT_OPERATING_HOURS = {
  monday: { open: '09:00', close: '21:00', closed: false },
  tuesday: { open: '09:00', close: '21:00', closed: false },
  wednesday: { open: '09:00', close: '21:00', closed: false },
  thursday: { open: '09:00', close: '21:00', closed: false },
  friday: { open: '09:00', close: '21:00', closed: false },
  saturday: { open: '09:00', close: '21:00', closed: false },
  sunday: { open: '10:00', close: '18:00', closed: false }
};

// Default payment methods
const DEFAULT_PAYMENT_METHODS = ['card', 'cash', 'bank_transfer'];

/**
 * Clean and format phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/[^\d]/g, '');
  
  // Format as Korean phone number
  if (cleaned.length === 10) {
    return `+82-${cleaned.slice(1, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 11) {
    return `+82-${cleaned.slice(1, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.startsWith('02')) {
    // Seoul landline
    return `+82-2-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return `+82-${cleaned}`;
}

/**
 * Determine service category from business types
 */
function determineServiceCategory(businessType, hygieneBusiness) {
  const combined = `${businessType} ${hygieneBusiness}`.toLowerCase();
  
  // Check for exact matches first
  for (const [korean, category] of Object.entries(BUSINESS_TYPE_MAPPING)) {
    if (combined.includes(korean.toLowerCase())) {
      return category;
    }
  }
  
  // Default to hair if no match found
  return 'hair';
}

/**
 * Determine sub-categories from business description
 */
function determineSubCategories(businessType, hygieneBusiness) {
  const combined = `${businessType} ${hygieneBusiness}`.toLowerCase();
  const categories = [];
  
  // Check for multiple services
  for (const [korean, category] of Object.entries(BUSINESS_TYPE_MAPPING)) {
    if (combined.includes(korean.toLowerCase())) {
      categories.push(category);
    }
  }
  
  // Remove duplicates and return
  return [...new Set(categories)];
}

/**
 * Get coordinates from address using Naver Maps Geocoding API
 */
async function getCoordinatesFromAddress(address) {
  try {
    // Using Naver Maps Geocoding API for Korean addresses
    const naverClientId = process.env.NAVER_MAPS_CLIENT_ID;
    const naverClientSecret = process.env.NAVER_MAPS_CLIENT_SECRET;
    
    if (!naverClientId || !naverClientSecret) {
      console.warn('⚠️  NAVER_MAPS_CLIENT_ID or NAVER_MAPS_CLIENT_SECRET not found, skipping geocoding');
      return { latitude: null, longitude: null };
    }
    
    // Naver Maps Geocoding API endpoint
    const response = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': naverClientId,
          'X-NCP-APIGW-API-KEY': naverClientSecret
        }
      }
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.addresses && data.addresses.length > 0) {
      const location = data.addresses[0];
      return {
        latitude: parseFloat(location.y),
        longitude: parseFloat(location.x),
        roadAddress: location.roadAddress,
        jibunAddress: location.jibunAddress,
        englishAddress: location.englishAddress
      };
    }
    
    console.warn(`⚠️  No coordinates found for address: ${address}`);
    return { latitude: null, longitude: null };
  } catch (error) {
    console.warn(`⚠️  Geocoding failed for address: ${address}`, error.message);
    return { latitude: null, longitude: null };
  }
}

/**
 * Convert Korean shop data to Supabase format
 */
async function convertShopData(koreanData) {
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

  // Get coordinates for the address
  const primaryAddress = roadAddress || lotAddress;
  const coordinates = await getCoordinatesFromAddress(primaryAddress);
  
  // Determine service categories
  const mainCategory = determineServiceCategory(businessType, hygieneBusiness);
  const subCategories = determineSubCategories(businessType, hygieneBusiness);

  // Create shop data object
  const shopData = {
    name: businessName?.trim(),
    description: `${businessType} - ${hygieneBusiness}`.trim(),
    phone_number: formatPhoneNumber(phoneNumber),
    email: null, // Not available in source data
    address: primaryAddress?.trim(),
    detailed_address: lotAddress !== roadAddress ? lotAddress?.trim() : null,
    postal_code: postalCode?.replace(/[^\d]/g, '').slice(0, 10),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    location: coordinates.latitude && coordinates.longitude 
      ? `POINT(${coordinates.longitude} ${coordinates.latitude})`
      : null,
    shop_type: 'non_partnered', // Default for imported data
    shop_status: 'pending_approval', // Needs manual review
    verification_status: 'pending',
    business_license_number: null, // Not available in source data
    business_license_image_url: null,
    main_category: mainCategory,
    sub_categories: subCategories,
    operating_hours: DEFAULT_OPERATING_HOURS,
    payment_methods: DEFAULT_PAYMENT_METHODS,
    kakao_channel_url: null,
    total_bookings: 0,
    partnership_started_at: licenseDate ? new Date(licenseDate).toISOString() : null,
    featured_until: null,
    is_featured: false,
    commission_rate: 10.00,
    
    // Metadata for tracking import
    import_metadata: {
      source: 'korean_government_data',
      original_business_type: businessType,
      original_hygiene_business: hygieneBusiness,
      seat_count: parseInt(seatCount) || null,
      license_date: licenseDate,
      imported_at: new Date().toISOString()
    }
  };

  return shopData;
}

/**
 * Validate shop data before insertion
 */
function validateShopData(shopData) {
  const errors = [];

  if (!shopData.name || shopData.name.trim().length === 0) {
    errors.push('Shop name is required');
  }

  if (!shopData.address || shopData.address.trim().length === 0) {
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

  const validStatuses = ['active', 'inactive', 'pending_approval', 'suspended', 'deleted'];
  if (!validStatuses.includes(shopData.shop_status)) {
    errors.push(`Invalid shop status: ${shopData.shop_status}`);
  }

  return errors;
}

/**
 * Import shops to Supabase
 */
async function importShopsToSupabase(shops, options = {}) {
  const { dryRun = false, batchSize = 10 } = options;
  
  console.log(`📊 Importing ${shops.length} shops to Supabase...`);
  console.log(`🔧 Batch size: ${batchSize}`);
  console.log(`🧪 Dry run: ${dryRun ? 'Yes' : 'No'}`);
  
  if (dryRun) {
    console.log('\n🧪 DRY RUN MODE - No data will be inserted\n');
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Process in batches
  for (let i = 0; i < shops.length; i += batchSize) {
    const batch = shops.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(shops.length / batchSize)}`);

    for (const shop of batch) {
      try {
        // Validate data
        const validationErrors = validateShopData(shop);
        if (validationErrors.length > 0) {
          console.log(`❌ Validation failed for ${shop.name}:`, validationErrors);
          errorCount++;
          errors.push({ shop: shop.name, errors: validationErrors });
          continue;
        }

        if (!dryRun) {
          // Insert to Supabase
          const { data, error } = await supabase
            .from('shops')
            .insert(shop)
            .select('id, name')
            .single();

          if (error) {
            console.log(`❌ Failed to insert ${shop.name}:`, error.message);
            errorCount++;
            errors.push({ shop: shop.name, error: error.message });
          } else {
            console.log(`✅ Successfully imported: ${shop.name} (ID: ${data.id})`);
            successCount++;
          }
        } else {
          console.log(`✅ Would import: ${shop.name}`);
          successCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`❌ Unexpected error for ${shop.name}:`, error.message);
        errorCount++;
        errors.push({ shop: shop.name, error: error.message });
      }
    }
  }

  // Summary
  console.log('\n📊 Import Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📈 Success Rate: ${((successCount / shops.length) * 100).toFixed(1)}%`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ shop, error, errors: validationErrors }) => {
      console.log(`  - ${shop}: ${error || validationErrors?.join(', ')}`);
    });
  }

  return { successCount, errorCount, errors };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node scripts/import-shop-data.js <csv-file-path> [options]

Options:
  --dry-run          Preview import without inserting data
  --batch-size=N     Process N records at a time (default: 10)
  --output=file      Save converted data to JSON file instead of importing
  --geocode          Enable geocoding for coordinates (requires KAKAO_API_KEY)

Example:
  node scripts/import-shop-data.js shop-data.csv --dry-run
  node scripts/import-shop-data.js shop-data.csv --batch-size=5 --geocode
  node scripts/import-shop-data.js shop-data.csv --output=converted-shops.json
`);
    process.exit(1);
  }

  const csvFilePath = args[0];
  const options = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 10,
    outputFile: args.find(arg => arg.startsWith('--output='))?.split('=')[1],
    enableGeocoding: args.includes('--geocode')
  };

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    process.exit(1);
  }

  console.log('🚀 Starting shop data import...');
  console.log(`📁 Input file: ${csvFilePath}`);
  console.log(`⚙️  Options:`, options);

  const shops = [];
  const rawData = [];

  // Read and parse CSV
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        rawData.push(data);
      })
      .on('end', async () => {
        try {
          console.log(`\n📊 Found ${rawData.length} records in CSV`);
          console.log('🔄 Converting data format...');

          // Convert each record
          for (let i = 0; i < rawData.length; i++) {
            const record = rawData[i];
            console.log(`Processing ${i + 1}/${rawData.length}: ${record.사업장명}`);

            try {
              const convertedShop = await convertShopData(record);
              shops.push(convertedShop);
            } catch (error) {
              console.log(`❌ Failed to convert ${record.사업장명}:`, error.message);
            }

            // Add delay for geocoding API
            if (options.enableGeocoding && i < rawData.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }

          console.log(`\n✅ Successfully converted ${shops.length} shops`);

          // Output to file or import to database
          if (options.outputFile) {
            // Save to JSON file
            fs.writeFileSync(options.outputFile, JSON.stringify(shops, null, 2));
            console.log(`💾 Data saved to: ${options.outputFile}`);
            console.log('\nTo import this data later, use:');
            console.log(`node scripts/import-from-json.js ${options.outputFile}`);
          } else {
            // Import to Supabase
            const result = await importShopsToSupabase(shops, options);
            
            if (result.errorCount === 0) {
              console.log('\n🎉 All shops imported successfully!');
            } else {
              console.log(`\n⚠️  Import completed with ${result.errorCount} errors`);
            }
          }

          resolve();
        } catch (error) {
          console.error('❌ Import failed:', error);
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

module.exports = {
  convertShopData,
  importShopsToSupabase,
  formatPhoneNumber,
  determineServiceCategory,
  BUSINESS_TYPE_MAPPING
};
