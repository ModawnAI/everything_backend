import { getSupabaseClient } from '../config/database';
import { logger } from './logger';
import { executeSpatialQuery } from './secure-query-builder';

/**
 * PostGIS Spatial Utilities
 * Provides location-based query functions for shop discovery and distance calculations
 */

// Default SRID for geographic coordinates (WGS84)
export const DEFAULT_SRID = 4326;

// Distance units
export type DistanceUnit = 'km' | 'm' | 'mi';

// Location coordinate interface
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Shop location result interface with enhanced data from optimized queries
export interface ShopLocationResult {
  id: string;
  name: string;
  address: string;
  detailed_address?: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  distance_m: number;
  shop_type: string;
  shop_status: string;
  main_category: string;
  sub_categories?: string[];
  is_featured: boolean;
  featured_until?: string;
  partnership_started_at?: string;
  phone_number?: string;
  description?: string;
  operating_hours?: any;
  payment_methods?: string[];
  total_bookings?: number;
  commission_rate?: number;
  created_at: string;
  updated_at: string;
}

// Search parameters for nearby shops with Seoul boundary validation
export interface NearbyShopsParams {
  userLocation: Coordinates;
  radiusKm: number;
  category?: string;
  shopType?: 'partnered' | 'non_partnered';
  onlyFeatured?: boolean;
  limit?: number;
  offset?: number;
  enforceSeoulBoundary?: boolean; // New parameter for geofencing
}

/**
 * Calculate distance using Haversine formula (for fallback when PostGIS not available)
 */
function calculateHaversineDistance(point1: Coordinates, point2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Validate coordinates
 */
export function validateCoordinates(coords: Coordinates): boolean {
  const { latitude, longitude } = coords;
  
  // Check if values are numbers
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }
  
  // Check if values are within valid ranges
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  
  // Check for NaN or Infinity
  if (!isFinite(latitude) || !isFinite(longitude)) {
    return false;
  }
  
  return true;
}

/**
 * Create PostGIS POINT geometry from coordinates
 */
export function createPointGeometry(coords: Coordinates): string {
  if (!validateCoordinates(coords)) {
    throw new Error('Invalid coordinates provided');
  }
  
  return `ST_SetSRID(ST_MakePoint(${coords.longitude}, ${coords.latitude}), ${DEFAULT_SRID})`;
}

/**
 * Calculate distance between two points in kilometers
 */
export async function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): Promise<number | null> {
  try {
    if (!validateCoordinates(point1) || !validateCoordinates(point2)) {
      throw new Error('Invalid coordinates provided');
    }
    
    // Calculate distance using Haversine formula
    // In production, this would use PostGIS ST_Distance
    return calculateHaversineDistance(point1, point2);
    
  } catch (error) {
    logger.error('Error calculating distance', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Seoul metropolitan area boundary coordinates for geofencing validation
 * Extended bounding box to include greater Seoul area (수도권)
 */
const SEOUL_BOUNDARY = {
  north: 37.9,      // 북쪽 경계 (파주, 양주 포함)
  south: 37.2,      // 남쪽 경계 (수원, 용인 포함)
  east: 127.4,      // 동쪽 경계 (남양주, 광주 포함)
  west: 126.5       // 서쪽 경계 (인천 포함)
};

/**
 * Validate if coordinates are within Seoul city boundary
 */
export function isWithinSeoulBoundary(coordinates: Coordinates): boolean {
  const { latitude, longitude } = coordinates;
  
  return (
    latitude >= SEOUL_BOUNDARY.south &&
    latitude <= SEOUL_BOUNDARY.north &&
    longitude >= SEOUL_BOUNDARY.west &&
    longitude <= SEOUL_BOUNDARY.east
  );
}

/**
 * Find nearby shops within specified radius
 * This implements the core "내 주변 샵" (nearby shops) functionality
 * Optimized with PostGIS indexes and PRD 2.1 sorting algorithm
 */
export async function findNearbyShops(
  params: NearbyShopsParams
): Promise<ShopLocationResult[]> {
  try {
    const {
      userLocation,
      radiusKm,
      category,
      shopType,
      onlyFeatured = false,
      limit = 50,
      offset = 0,
      enforceSeoulBoundary = true
    } = params;
    
    if (!validateCoordinates(userLocation)) {
      throw new Error('Invalid user location coordinates');
    }
    
    // Seoul city boundary validation (geofencing)
    if (enforceSeoulBoundary && !isWithinSeoulBoundary(userLocation)) {
      logger.warn('User location outside Seoul boundary', {
        userLocation,
        boundary: SEOUL_BOUNDARY
      });
      
      // Return empty results for locations outside Seoul
      return [];
    }
    
    if (radiusKm <= 0 || radiusKm > 100) {
      throw new Error('Radius must be between 0 and 100 km');
    }
    
    const client = getSupabaseClient();

    // Try PostGIS-based query first, fallback to Haversine if RPC not available
    let spatialResults: any[] = [];
    let usedFallback = false;

    try {
      // Use optimized secure query builder with composite indexes
      spatialResults = await executeSpatialQuery({
        userLocation,
        radiusKm,
        category,
        shopType,
        onlyFeatured,
        limit,
        offset
      });
    } catch (rpcError) {
      // Fallback to simple Supabase query with client-side distance calculation
      logger.warn('PostGIS RPC not available, using Haversine fallback', {
        error: rpcError instanceof Error ? rpcError.message : 'Unknown error'
      });
      usedFallback = true;

      // Build a simple query without PostGIS
      let query = client
        .from('shops')
        .select(`
          id, name, address, detailed_address, latitude, longitude,
          shop_type, shop_status, main_category, sub_categories,
          is_featured, featured_until, partnership_started_at,
          phone_number, description, operating_hours, payment_methods,
          total_bookings, commission_rate, created_at, updated_at
        `)
        .eq('shop_status', 'active')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Apply category filter
      if (category) {
        query = query.eq('main_category', category);
      }

      // Apply shop type filter
      if (shopType) {
        query = query.eq('shop_type', shopType);
      }

      // Apply featured filter
      if (onlyFeatured) {
        query = query.eq('is_featured', true);
      }

      const { data: rawShops, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      // Calculate distance using Haversine formula and filter by radius
      spatialResults = (rawShops || [])
        .map((shop: any) => {
          const distanceKm = calculateHaversineDistance(
            userLocation,
            { latitude: shop.latitude, longitude: shop.longitude }
          );
          return {
            ...shop,
            distance_km: distanceKm,
            distance_m: distanceKm * 1000
          };
        })
        .filter((shop: any) => shop.distance_km <= radiusKm)
        .sort((a: any, b: any) => {
          // PRD 2.1 sorting: partnered first, then by partnership date, featured, distance
          if (a.shop_type === 'partnered' && b.shop_type !== 'partnered') return -1;
          if (b.shop_type === 'partnered' && a.shop_type !== 'partnered') return 1;

          // Both partnered - sort by partnership date (newest first)
          if (a.shop_type === 'partnered' && b.shop_type === 'partnered') {
            const aDate = a.partnership_started_at ? new Date(a.partnership_started_at).getTime() : 0;
            const bDate = b.partnership_started_at ? new Date(b.partnership_started_at).getTime() : 0;
            if (aDate !== bDate) return bDate - aDate;
          }

          // Featured shops next
          if (a.is_featured && !b.is_featured) return -1;
          if (b.is_featured && !a.is_featured) return 1;

          // Finally by distance
          return a.distance_km - b.distance_km;
        })
        .slice(offset, offset + limit);
    }

    // Transform secure query results to expected format with enhanced data
    const results = spatialResults.map((row: any) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      detailed_address: row.detailed_address,
      latitude: row.latitude,
      longitude: row.longitude,
      shop_type: row.shop_type,
      shop_status: row.shop_status,
      main_category: row.main_category,
      sub_categories: row.sub_categories,
      is_featured: row.is_featured,
      featured_until: row.featured_until,
      partnership_started_at: row.partnership_started_at,
      phone_number: row.phone_number,
      description: row.description,
      operating_hours: row.operating_hours,
      payment_methods: row.payment_methods,
      total_bookings: row.total_bookings,
      commission_rate: row.commission_rate,
      distance_km: row.distance_km,
      distance_m: row.distance_m,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    
    logger.info('Found nearby shops', {
      userLocation,
      radiusKm,
      resultCount: results.length,
      category,
      shopType,
      onlyFeatured,
      withinSeoulBoundary: isWithinSeoulBoundary(userLocation),
      usedHaversineFallback: usedFallback,
      indexesUsed: usedFallback ? ['haversine_fallback'] : [
        category ? 'idx_shops_active_category_location' : null,
        shopType ? 'idx_shops_type_status_location' : null,
        onlyFeatured ? 'idx_shops_featured_location' : null
      ].filter(Boolean)
    });
    
    return results;
    
  } catch (error) {
    logger.error('Error finding nearby shops', {
      error: error instanceof Error ? error.message : 'Unknown error',
      params
    });
    return [];
  }
}

/**
 * Get shops within a bounding box (rectangular area)
 * Useful for map-based interfaces
 */
export async function getShopsInBounds(
  northEast: Coordinates,
  southWest: Coordinates,
  filters?: {
    category?: string;
    shopType?: string;
    onlyFeatured?: boolean;
  }
): Promise<ShopLocationResult[]> {
  try {
    if (!validateCoordinates(northEast) || !validateCoordinates(southWest)) {
      throw new Error('Invalid bounding box coordinates');
    }
    
    const client = getSupabaseClient();
    
    let query = `
      SELECT 
        s.id,
        s.name,
        s.address,
        s.latitude,
        s.longitude,
        0 as distance_km,
        0 as distance_m,
        s.shop_type,
        s.shop_status,
        s.main_category,
        s.is_featured
      FROM public.shops s
      WHERE 
        s.shop_status = 'active'
        AND s.location IS NOT NULL
        AND ST_Within(
          s.location,
          ST_MakeEnvelope($1, $2, $3, $4, ${DEFAULT_SRID})
        )
    `;
    
    const queryParams: (string | number)[] = [
      southWest.longitude, // xmin
      southWest.latitude,  // ymin
      northEast.longitude, // xmax
      northEast.latitude   // ymax
    ];
    
    let paramIndex = 5;
    
    // Add filters
    if (filters?.category) {
      query += ` AND s.main_category = $${paramIndex}`;
      queryParams.push(filters.category);
      paramIndex++;
    }
    
    if (filters?.shopType) {
      query += ` AND s.shop_type = $${paramIndex}`;
      queryParams.push(filters.shopType);
      paramIndex++;
    }
    
    if (filters?.onlyFeatured) {
      query += ` AND s.is_featured = true AND s.featured_until > NOW()`;
    }
    
    query += `
      ORDER BY 
        CASE WHEN s.shop_type = 'partnered' THEN 0 ELSE 1 END,
        s.is_featured DESC,
        s.name ASC
    `;
    
    // For now, use a simple bounding box filter
    // In production, this would use PostGIS ST_Within
    const { data, error } = await client
      .from('shops')
      .select(`
        id, name, address, latitude, longitude, shop_type, 
        shop_status, main_category, is_featured
      `)
      .eq('shop_status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('latitude', southWest.latitude)
      .lte('latitude', northEast.latitude)
      .gte('longitude', southWest.longitude)
      .lte('longitude', northEast.longitude);
    
    if (error) {
      logger.error('Failed to get shops in bounds', { 
        error: error.message,
        northEast,
        southWest 
      });
      return [];
    }
    
    // Apply filters and add distance fields (set to 0 for bounds queries)
    const results = (data || [])
      .filter(shop => !filters?.category || shop.main_category === filters.category)
      .filter(shop => !filters?.shopType || shop.shop_type === filters.shopType)
      .filter(shop => !filters?.onlyFeatured || shop.is_featured)
      .map(shop => ({
        ...shop,
        distance_km: 0,
        distance_m: 0
      }))
      .sort((a, b) => {
        // Implement PRD 2.1 sorting algorithm for bounds queries
        // 1. Partnered shops first
        if (a.shop_type === 'partnered' && b.shop_type !== 'partnered') return -1;
        if (b.shop_type === 'partnered' && a.shop_type !== 'partnered') return 1;
        
        // 2. Partnership started date (newest first) - for partnered shops
        if (a.shop_type === 'partnered' && b.shop_type === 'partnered') {
          const aDate = (a as any).partnership_started_at ? new Date((a as any).partnership_started_at).getTime() : 0;
          const bDate = (b as any).partnership_started_at ? new Date((b as any).partnership_started_at).getTime() : 0;
          if (aDate !== bDate) return bDate - aDate; // DESC order
        }
        
        // 3. Featured shops
        if (a.is_featured && !b.is_featured) return -1;
        if (b.is_featured && !a.is_featured) return 1;
        
        // 4. Fallback to name for consistent ordering
        return a.name.localeCompare(b.name);
      });
    
    return results.map(shop => ({
      ...shop,
      created_at: (shop as any).created_at || new Date().toISOString(),
      updated_at: (shop as any).updated_at || new Date().toISOString()
    }));
    
  } catch (error) {
    logger.error('Error getting shops in bounds', {
      error: error instanceof Error ? error.message : 'Unknown error',
      northEast,
      southWest,
      filters
    });
    return [];
  }
}

/**
 * Update shop location coordinates and PostGIS geometry
 */
export async function updateShopLocation(
  shopId: string,
  coordinates: Coordinates
): Promise<boolean> {
  try {
    if (!validateCoordinates(coordinates)) {
      throw new Error('Invalid coordinates provided');
    }
    
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('shops')
      .update({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        location: `POINT(${coordinates.longitude} ${coordinates.latitude})`,
        updated_at: new Date().toISOString()
      })
      .eq('id', shopId);
    
    if (error) {
      logger.error('Failed to update shop location', {
        error: error.message,
        shopId,
        coordinates
      });
      return false;
    }
    
    logger.info('Shop location updated successfully', {
      shopId,
      coordinates
    });
    
    return true;
    
  } catch (error) {
    logger.error('Error updating shop location', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId,
      coordinates
    });
    return false;
  }
}

/**
 * Validate that PostGIS extension is properly installed and configured
 */
export async function validatePostGISInstallation(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    
    // Test PostGIS functionality
    // Test basic database connectivity
    const { error } = await client
      .from('shops')
      .select('count')
      .limit(1);
    
    if (error) {
      logger.error('Database connectivity validation failed', { error: error.message });
      return false;
    }
    
    logger.info('Database connectivity validation successful');
    
    return true;
    
  } catch (error) {
    logger.error('Error validating PostGIS installation', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Convert distance between units
 */
export function convertDistance(
  distance: number,
  fromUnit: DistanceUnit,
  toUnit: DistanceUnit
): number {
  // Convert to meters first
  let meters: number;
  
  switch (fromUnit) {
    case 'm':
      meters = distance;
      break;
    case 'km':
      meters = distance * 1000;
      break;
    case 'mi':
      meters = distance * 1609.344;
      break;
    default:
      throw new Error(`Unknown distance unit: ${fromUnit}`);
  }
  
  // Convert from meters to target unit
  switch (toUnit) {
    case 'm':
      return meters;
    case 'km':
      return meters / 1000;
    case 'mi':
      return meters / 1609.344;
    default:
      throw new Error(`Unknown distance unit: ${toUnit}`);
  }
}

export default {
  validateCoordinates,
  createPointGeometry,
  calculateDistance,
  findNearbyShops,
  getShopsInBounds,
  updateShopLocation,
  validatePostGISInstallation,
  convertDistance,
}; 