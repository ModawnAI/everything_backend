/**
 * Import Shops from CSV Script
 *
 * Imports 100 beauty shops from CSV file with Korean addresses.
 * - Parses CSV with proper encoding handling
 * - Maps Korean business types to service_category enum
 * - Geocodes addresses using Kakao Maps API
 * - Inserts shops into Supabase database
 *
 * Run with: npx ts-node src/scripts/import-shops-from-csv.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';

const KAKAO_API_KEY = process.env.KAKAO_API_KEY;
const CSV_FILE_PATH = '/home/bitnami/.playwright-mcp/a.csv';

// Service category enum values from database
type ServiceCategory = 'nail' | 'eyelash' | 'waxing' | 'eyebrow_tattoo' | 'hair';

interface CSVShop {
  사업장명: string;
  지번주소: string;
  전화번호: string;
  업태구분명: string;
  위생업태명: string;
  좌석수: string;
  도로명주소: string;
  소재지우편번호: string;
  인허가일자: string;
}

interface ShopInsert {
  name: string;
  address: string;
  detailed_address: string | null;
  postal_code: string | null;
  phone_number: string | null;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  main_category: ServiceCategory;
  sub_categories: ServiceCategory[];
  shop_type: 'non_partnered';
  shop_status: 'active';
  verification_status: 'pending';
}

interface KakaoGeocodingResponse {
  documents: Array<{
    address_name: string;
    x: string; // longitude
    y: string; // latitude
    address_type: string;
    road_address?: {
      address_name: string;
    };
  }>;
  meta: {
    total_count: number;
  };
}

/**
 * Map Korean business types to service_category enum values
 */
function mapBusinessTypeToCategory(businessType: string): { main: ServiceCategory; subs: ServiceCategory[] } {
  // Clean and split multiple types (e.g., "일반미용업, 네일미용업")
  const types = businessType.split(',').map(t => t.trim());

  const categoryMapping: { [key: string]: ServiceCategory } = {
    '일반미용업': 'hair',       // General salon → hair
    '네일미용업': 'nail',       // Nail salon → nail
    '피부미용업': 'waxing',     // Skin care → waxing (closest match)
    '종합미용업': 'hair',       // Comprehensive → hair (default)
    '반영구미용업': 'eyebrow_tattoo', // Semi-permanent makeup
  };

  const mappedCategories: ServiceCategory[] = [];

  for (const type of types) {
    const mapped = categoryMapping[type];
    if (mapped && !mappedCategories.includes(mapped)) {
      mappedCategories.push(mapped);
    }
  }

  // Default to 'hair' if no mapping found
  if (mappedCategories.length === 0) {
    mappedCategories.push('hair');
  }

  return {
    main: mappedCategories[0],
    subs: mappedCategories.slice(1),
  };
}

/**
 * Parse CSV file with proper handling for quoted fields
 */
function parseCSV(filePath: string): CSVShop[] {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Remove BOM if present and normalize line endings
  const normalizedContent = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalizedContent.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const headers = parseCSVLine(lines[0]);
  const shops: CSVShop[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length < headers.length) {
      console.log(`  ⚠️ Row ${i + 1} has fewer columns than expected, skipping`);
      continue;
    }

    const shop: CSVShop = {
      사업장명: values[0] || '',
      지번주소: values[1] || '',
      전화번호: values[2] || '',
      업태구분명: values[3] || '',
      위생업태명: values[4] || '',
      좌석수: values[5] || '',
      도로명주소: values[6] || '',
      소재지우편번호: values[7] || '',
      인허가일자: values[8] || '',
    };

    shops.push(shop);
  }

  return shops;
}

/**
 * Parse a single CSV line handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  values.push(current.trim());

  return values;
}

/**
 * Clean and normalize Korean address
 */
function normalizeAddress(address: string): string {
  return address
    .replace(/\s+/g, ' ')
    .replace(/\(.*?\)/g, '') // Remove parenthetical parts
    .trim();
}

/**
 * Extract district/area from address for fallback search
 */
function extractDistrict(address: string): string | null {
  // Match patterns like "서울특별시 종로구" or "서울시 강남구"
  const match = address.match(/(서울특별시|서울시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)\s*\S+[구군시]/);
  return match ? match[0] : null;
}

/**
 * Geocode an address using Kakao Local API
 * Tries multiple strategies: exact address -> keyword -> district
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_API_KEY) {
    throw new Error('KAKAO_API_KEY is not configured');
  }

  const normalizedAddress = normalizeAddress(address);

  // Strategy 1: Try exact address search
  const addressUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(normalizedAddress)}`;

  try {
    const response = await fetch(addressUrl, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_API_KEY}`,
      },
    });

    if (response.ok) {
      const data: KakaoGeocodingResponse = await response.json();
      if (data.documents.length > 0) {
        const firstResult = data.documents[0];
        return {
          lat: parseFloat(firstResult.y),
          lng: parseFloat(firstResult.x),
        };
      }
    }
  } catch (error) {
    // Silent fail, try next strategy
  }

  // Strategy 2: Try keyword search (more flexible)
  const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(normalizedAddress)}`;

  try {
    const keywordResponse = await fetch(keywordUrl, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_API_KEY}`,
      },
    });

    if (keywordResponse.ok) {
      const keywordData: KakaoGeocodingResponse = await keywordResponse.json();
      if (keywordData.documents.length > 0) {
        const firstResult = keywordData.documents[0];
        return {
          lat: parseFloat(firstResult.y),
          lng: parseFloat(firstResult.x),
        };
      }
    }
  } catch (error) {
    // Silent fail, try next strategy
  }

  // Strategy 3: Try district-level search as fallback
  const district = extractDistrict(address);
  if (district) {
    const districtUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(district)}`;

    try {
      const districtResponse = await fetch(districtUrl, {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
      });

      if (districtResponse.ok) {
        const districtData: KakaoGeocodingResponse = await districtResponse.json();
        if (districtData.documents.length > 0) {
          const firstResult = districtData.documents[0];
          return {
            lat: parseFloat(firstResult.y),
            lng: parseFloat(firstResult.x),
          };
        }
      }
    } catch (error) {
      // Silent fail
    }
  }

  return null;
}

/**
 * Clean and format phone number
 */
function formatPhoneNumber(phone: string): string | null {
  if (!phone || phone.trim() === '') {
    return null;
  }

  // Remove extra spaces and normalize
  return phone.replace(/\s+/g, '-').replace(/^(\d{2,3})-+(\d{3,4})-+(\d{4})$/, '$1-$2-$3');
}

/**
 * Check if shop already exists by name and address
 */
async function shopExists(
  supabase: ReturnType<typeof getSupabaseClient>,
  name: string,
  address: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('shops')
    .select('id')
    .eq('name', name)
    .ilike('address', `%${address.substring(0, 20)}%`)
    .limit(1);

  if (error) {
    console.error('Error checking shop existence:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Main function to import shops from CSV
 */
async function importShopsFromCSV() {
  console.log('🚀 Starting Shop Import from CSV...\n');
  console.log(`📁 CSV File: ${CSV_FILE_PATH}\n`);

  if (!KAKAO_API_KEY) {
    console.error('❌ KAKAO_API_KEY is not configured in environment');
    console.log('Please set KAKAO_API_KEY in your .env file');
    process.exit(1);
  }

  // Check if CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  // Parse CSV
  console.log('📋 Parsing CSV file...');
  const shops = parseCSV(CSV_FILE_PATH);
  console.log(`✅ Found ${shops.length} shops in CSV\n`);

  const supabase = getSupabaseClient();

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let geocodeFailCount = 0;

  for (let i = 0; i < shops.length; i++) {
    const csvShop = shops[i];
    console.log(`[${i + 1}/${shops.length}] Processing: ${csvShop.사업장명}`);

    // Skip if no name or address
    if (!csvShop.사업장명 || (!csvShop.도로명주소 && !csvShop.지번주소)) {
      console.log('  ⚠️ Skipped - Missing name or address');
      skipCount++;
      continue;
    }

    // Use road address first, fallback to lot address
    const address = csvShop.도로명주소 || csvShop.지번주소;
    console.log(`  📍 Address: ${address.substring(0, 50)}...`);

    // Check if shop already exists
    const exists = await shopExists(supabase, csvShop.사업장명, address);
    if (exists) {
      console.log('  ⚠️ Skipped - Shop already exists');
      skipCount++;
      continue;
    }

    // Map business type to category
    const { main, subs } = mapBusinessTypeToCategory(csvShop.위생업태명);
    console.log(`  📂 Category: ${main}${subs.length > 0 ? ` (+${subs.join(', ')})` : ''}`);

    // Rate limit: Kakao API allows ~30 requests per second
    await new Promise(resolve => setTimeout(resolve, 150));

    // Geocode address
    const coords = await geocodeAddress(address);

    if (!coords) {
      console.log('  ⚠️ Geocoding failed - Using null coordinates');
      geocodeFailCount++;
    } else {
      console.log(`  🗺️ Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    }

    // Prepare shop data for insertion
    const shopData: ShopInsert = {
      name: csvShop.사업장명,
      address: address,
      detailed_address: csvShop.지번주소 !== csvShop.도로명주소 ? csvShop.지번주소 : null,
      postal_code: csvShop.소재지우편번호 || null,
      phone_number: formatPhoneNumber(csvShop.전화번호),
      latitude: coords?.lat || null,
      longitude: coords?.lng || null,
      location: coords ? `POINT(${coords.lng} ${coords.lat})` : null,
      main_category: main,
      sub_categories: subs,
      shop_type: 'non_partnered',
      shop_status: 'active',
      verification_status: 'pending',
    };

    // Insert into database
    const { data, error } = await supabase
      .from('shops')
      .insert(shopData)
      .select('id')
      .single();

    if (error) {
      console.log(`  ❌ Insert failed: ${error.message}`);
      failCount++;
      continue;
    }

    console.log(`  ✅ Inserted: ${data.id}`);
    successCount++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Import Summary');
  console.log('='.repeat(60));
  console.log(`✅ Inserted:      ${successCount}`);
  console.log(`❌ Failed:        ${failCount}`);
  console.log(`⚠️ Skipped:       ${skipCount}`);
  console.log(`🗺️ Geocode Failed: ${geocodeFailCount} (inserted with null coords)`);
  console.log(`📋 Total:         ${shops.length}`);
  console.log('='.repeat(60));

  if (geocodeFailCount > 0) {
    console.log('\n💡 Tip: Run the geocode script later to fill in missing coordinates:');
    console.log('   npx ts-node src/scripts/geocode-shop-addresses.ts');
  }

  process.exit(0);
}

// Run the script
importShopsFromCSV().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
