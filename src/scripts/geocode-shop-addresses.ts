/**
 * Geocode Shop Addresses Script
 *
 * Converts Korean addresses to latitude/longitude coordinates using Kakao Maps API.
 * Run with: npx ts-node src/scripts/geocode-shop-addresses.ts
 */

import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';

const KAKAO_API_KEY = process.env.KAKAO_API_KEY;

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

interface Shop {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Clean and normalize Korean address for better geocoding results
 */
function normalizeAddress(address: string): string {
  // Remove specific building/suite numbers that may not exist
  // Keep district + street + general location
  let normalized = address
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Extract district/area from address for fallback search
 */
function extractDistrict(address: string): string | null {
  // Match patterns like "서울 강남구" or "서울시 강남구"
  const match = address.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[시]?\s*\S+[구군시]/);
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
    console.error(`  ⚠️ Address search error:`, error);
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
        console.log(`  📌 Found via keyword search`);
        return {
          lat: parseFloat(firstResult.y),
          lng: parseFloat(firstResult.x),
        };
      }
    }
  } catch (error) {
    console.error(`  ⚠️ Keyword search error:`, error);
  }

  // Strategy 3: Try district-level search as fallback
  const district = extractDistrict(normalizedAddress);
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
          console.log(`  📌 Using district center: ${district}`);
          return {
            lat: parseFloat(firstResult.y),
            lng: parseFloat(firstResult.x),
          };
        }
      }
    } catch (error) {
      console.error(`  ⚠️ District search error:`, error);
    }
  }

  return null;
}

/**
 * Update shop with geocoded coordinates
 */
async function updateShopCoordinates(
  supabase: ReturnType<typeof getSupabaseClient>,
  shopId: string,
  lat: number,
  lng: number
): Promise<boolean> {
  // Update latitude, longitude, and location (PostGIS POINT)
  const { error } = await supabase
    .from('shops')
    .update({
      latitude: lat,
      longitude: lng,
      location: `POINT(${lng} ${lat})`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopId);

  if (error) {
    console.error(`  ❌ DB update error:`, error);
    return false;
  }

  return true;
}

/**
 * Main function to geocode all shops
 */
async function geocodeAllShops() {
  console.log('🌍 Starting Shop Address Geocoding...\n');

  if (!KAKAO_API_KEY) {
    console.error('❌ KAKAO_API_KEY is not configured in environment');
    console.log('Please set KAKAO_API_KEY in your .env file');
    process.exit(1);
  }

  const supabase = getSupabaseClient();

  // Fetch shops without coordinates or with null lat/lng
  console.log('📋 Fetching shops without coordinates...');
  const { data: shops, error: fetchError } = await supabase
    .from('shops')
    .select('id, name, address, latitude, longitude')
    .not('address', 'is', null)
    .or('latitude.is.null,latitude.eq.0')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching shops:', fetchError);
    process.exit(1);
  }

  if (!shops || shops.length === 0) {
    console.log('✅ No shops need geocoding - all shops have coordinates!');
    process.exit(0);
  }

  console.log(`📍 Found ${shops.length} shops to geocode\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i] as Shop;
    console.log(`[${i + 1}/${shops.length}] Processing: ${shop.name}`);

    if (!shop.address) {
      console.log('  ⚠️ Skipped - No address');
      skipCount++;
      continue;
    }

    console.log(`  📍 Address: ${shop.address}`);

    // Rate limit: Kakao API allows ~30 requests per second
    await new Promise(resolve => setTimeout(resolve, 100));

    const coords = await geocodeAddress(shop.address);

    if (!coords) {
      console.log('  ❌ Geocoding failed - No results found');
      failCount++;
      continue;
    }

    console.log(`  🗺️ Coordinates: ${coords.lat}, ${coords.lng}`);

    const updated = await updateShopCoordinates(supabase, shop.id, coords.lat, coords.lng);

    if (updated) {
      console.log('  ✅ Updated successfully');
      successCount++;
    } else {
      console.log('  ❌ Database update failed');
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Geocoding Summary');
  console.log('='.repeat(50));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  console.log(`⚠️ Skipped: ${skipCount}`);
  console.log(`📋 Total:   ${shops.length}`);
  console.log('='.repeat(50));

  process.exit(0);
}

// Run the script
geocodeAllShops().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
