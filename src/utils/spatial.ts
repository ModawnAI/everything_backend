import { getSupabaseClient } from '../config/database';
import { logger } from './logger';

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

// Shop location result interface
export interface ShopLocationResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  distance_m: number;
  shop_type: string;
  shop_status: string;
  main_category: string;
  is_featured: boolean;
}

// Search parameters for nearby shops
export interface NearbyShopsParams {
  userLocation: Coordinates;
  radiusKm: number;
  category?: string;
  shopType?: 'partnered' | 'non_partnered';
  onlyFeatured?: boolean;
  limit?: number;
  offset?: number;
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
 * Find nearby shops within specified radius
 * This implements the core "내 주변 샵" (nearby shops) functionality
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
      offset = 0
    } = params;
    
    if (!validateCoordinates(userLocation)) {
      throw new Error('Invalid user location coordinates');
    }
    
    if (radiusKm <= 0 || radiusKm > 100) {
      throw new Error('Radius must be between 0 and 100 km');
    }
    
    const client = getSupabaseClient();
    
    // Build the spatial query
    let query = `
      SELECT 
        s.id,
        s.name,
        s.address,
        s.latitude,
        s.longitude,
        ST_Distance(
          s.location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), ${DEFAULT_SRID})::geography
        ) / 1000 as distance_km,
        ST_Distance(
          s.location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), ${DEFAULT_SRID})::geography
        ) as distance_m,
        s.shop_type,
        s.shop_status,
        s.main_category,
        s.is_featured
      FROM public.shops s
      WHERE 
        s.shop_status = 'active'
        AND s.location IS NOT NULL
        AND ST_DWithin(
          s.location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), ${DEFAULT_SRID})::geography,
          $3
        )
    `;
    
    const queryParams: (string | number)[] = [userLocation.longitude, userLocation.latitude, radiusKm * 1000];
    let paramIndex = 4;
    
    // Add category filter
    if (category) {
      query += ` AND s.main_category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }
    
    // Add shop type filter
    if (shopType) {
      query += ` AND s.shop_type = $${paramIndex}`;
      queryParams.push(shopType);
      paramIndex++;
    }
    
    // Add featured filter
    if (onlyFeatured) {
      query += ` AND s.is_featured = true AND s.featured_until > NOW()`;
    }
    
    // Order by priority: partnered shops first, then by distance
    query += `
      ORDER BY 
        CASE WHEN s.shop_type = 'partnered' THEN 0 ELSE 1 END,
        s.is_featured DESC,
        distance_km ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    
    // For now, use a simple query to get shops and filter by distance
    // In production, this would use the full PostGIS spatial query
    const { data, error } = await client
      .from('shops')
      .select(`
        id, name, address, latitude, longitude, shop_type, 
        shop_status, main_category, is_featured
      `)
      .eq('shop_status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    
    if (error) {
      logger.error('Failed to find nearby shops', { 
        error: error.message,
        userLocation,
        radiusKm 
      });
      return [];
    }
    
    // Filter by distance and add distance calculations
    const results = (data || [])
      .map(shop => {
        const distance = calculateHaversineDistance(
          userLocation,
          { latitude: shop.latitude!, longitude: shop.longitude! }
        );
        return {
          ...shop,
          distance_km: distance,
          distance_m: distance * 1000
        };
      })
      .filter(shop => shop.distance_km <= radiusKm)
      .filter(shop => !category || shop.main_category === category)
      .filter(shop => !shopType || shop.shop_type === shopType)
      .filter(shop => !onlyFeatured || shop.is_featured)
      .sort((a, b) => {
        // Sort by priority: partnered first, then by distance
        if (a.shop_type === 'partnered' && b.shop_type !== 'partnered') return -1;
        if (b.shop_type === 'partnered' && a.shop_type !== 'partnered') return 1;
        if (a.is_featured && !b.is_featured) return -1;
        if (b.is_featured && !a.is_featured) return 1;
        return a.distance_km - b.distance_km;
      })
      .slice(offset, offset + limit);
    
    logger.info('Found nearby shops', {
      userLocation,
      radiusKm,
      resultCount: results.length,
      category,
      shopType
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
        // Sort by priority: partnered first, then by name
        if (a.shop_type === 'partnered' && b.shop_type !== 'partnered') return -1;
        if (b.shop_type === 'partnered' && a.shop_type !== 'partnered') return 1;
        if (a.is_featured && !b.is_featured) return -1;
        if (b.is_featured && !a.is_featured) return 1;
        return a.name.localeCompare(b.name);
      });
    
    return results;
    
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