/**
 * Home Service
 * Provides data for home page sections including:
 * - Nearby nail shops
 * - Frequently visited shops
 * - Best recommended shops
 * - Editor's picks
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ServiceCategory } from '../types/database.types';

export interface ShopPreview {
  id: string;
  name: string;
  category: ServiceCategory;
  thumbnailUrl: string | null;
  rating: number;
  reviewCount: number;
  distanceKm?: number;
  distanceText?: string;
  visitCount?: number;
  address?: string | null;
}

export interface EditorPick {
  id: string;
  shopId: string;
  shop: ShopPreview;
  title: string | null;
  description: string | null;
  displayOrder: number;
}

export interface HomeSections {
  nearby: ShopPreview[];
  frequentlyVisited: ShopPreview[];
  bestRecommended: ShopPreview[];
  editorPicks: EditorPick[];
}

class HomeService {
  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  }

  /**
   * Get nearby nail shops
   */
  async getNearbyNailShops(
    lat: number,
    lng: number,
    limit = 10,
    radiusKm = 5
  ): Promise<ShopPreview[]> {
    const supabase = getSupabaseClient();

    try {
      // Calculate bounding box for approximate filtering
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos(lat * (Math.PI / 180)));

      const { data, error } = await supabase
        .from('shops')
        .select(`
          id,
          name,
          main_category,
          latitude,
          longitude,
          shop_images (
            image_url,
            is_primary,
            display_order
          )
        `)
        .eq('shop_status', 'active')
        .eq('main_category', 'nail')
        .gte('latitude', lat - latDelta)
        .lte('latitude', lat + latDelta)
        .gte('longitude', lng - lngDelta)
        .lte('longitude', lng + lngDelta)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(limit * 3); // Get more to filter by exact distance

      if (error) {
        logger.error('Failed to fetch nearby nail shops', { error: error.message });
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Calculate exact distance and filter
      const shopsWithDistance = data
        .map((shop: any) => ({
          ...shop,
          distanceKm: this.calculateDistance(lat, lng, shop.latitude, shop.longitude),
        }))
        .filter((shop: any) => shop.distanceKm <= radiusKm)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
        .slice(0, limit);

      return shopsWithDistance.map((shop: any) => this.mapShopPreview(shop, true));
    } catch (error) {
      logger.error('Error in getNearbyNailShops', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get frequently visited shops for a user
   */
  async getFrequentlyVisited(userId: string, limit = 10): Promise<ShopPreview[]> {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          shop_id,
          shops (
            id,
            name,
            main_category,
            shop_images (
              image_url,
              is_primary,
              display_order
            )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('reservation_date', { ascending: false });

      if (error) {
        logger.error('Failed to fetch frequently visited shops', { error: error.message });
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Count visits per shop
      const visitCounts = new Map<string, { shop: any; count: number }>();

      for (const reservation of data) {
        const shopId = reservation.shop_id;
        const shop = reservation.shops;

        if (!shop) continue;

        if (visitCounts.has(shopId)) {
          visitCounts.get(shopId)!.count++;
        } else {
          visitCounts.set(shopId, { shop, count: 1 });
        }
      }

      // Sort by visit count and return top shops
      return Array.from(visitCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((v) => ({
          id: v.shop.id,
          name: v.shop.name,
          category: v.shop.main_category,
          thumbnailUrl: this.getMainImageUrl(v.shop.shop_images),
          rating: 0, // TODO: Calculate from reviews
          reviewCount: 0, // TODO: Calculate from reviews
          visitCount: v.count,
        }));
    } catch (error) {
      logger.error('Error in getFrequentlyVisited', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get best recommended shops (by bookings count for now)
   * TODO: Add rating-based filtering when review aggregation is implemented
   */
  async getBestRecommended(limit = 10): Promise<ShopPreview[]> {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase
        .from('shops')
        .select(`
          id,
          name,
          main_category,
          total_bookings,
          shop_images (
            image_url,
            is_primary,
            display_order
          )
        `)
        .eq('shop_status', 'active')
        .gt('total_bookings', 0) // At least 1 booking
        .order('total_bookings', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch best recommended shops', { error: error.message });
        return [];
      }

      return (data || []).map((shop: any) => this.mapShopPreview(shop, false));
    } catch (error) {
      logger.error('Error in getBestRecommended', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get editor's picks
   */
  async getEditorPicks(limit = 10): Promise<EditorPick[]> {
    const supabase = getSupabaseClient();

    try {
      const now = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('editor_picks')
        .select(`
          id,
          shop_id,
          title,
          description,
          display_order,
          shops (
            id,
            name,
            main_category,
            address,
            shop_images (
              image_url,
              is_primary,
              display_order
            )
          )
        `)
        .eq('active', true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('display_order', { ascending: true })
        .limit(limit);

      if (error) {
        // Table might not exist yet
        if (error.code === 'PGRST205' || error.message.includes('does not exist')) {
          logger.warn('Editor picks table not found - migration may need to be run');
          return [];
        }
        logger.error('Failed to fetch editor picks', { error: error.message });
        return [];
      }

      return (data || [])
        .filter((p: any) => p.shops) // Filter out picks with deleted shops
        .map((p: any) => ({
          id: p.id,
          shopId: p.shop_id,
          shop: this.mapShopPreview(p.shops, false),
          title: p.title,
          description: p.description,
          displayOrder: p.display_order,
        }));
    } catch (error) {
      logger.error('Error in getEditorPicks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get all home sections in one call
   */
  async getAllSections(
    userId?: string,
    lat?: number,
    lng?: number
  ): Promise<HomeSections> {
    const [nearby, frequentlyVisited, bestRecommended, editorPicks] =
      await Promise.all([
        lat && lng ? this.getNearbyNailShops(lat, lng) : Promise.resolve([]),
        userId ? this.getFrequentlyVisited(userId) : Promise.resolve([]),
        this.getBestRecommended(),
        this.getEditorPicks(),
      ]);

    return {
      nearby,
      frequentlyVisited,
      bestRecommended,
      editorPicks,
    };
  }

  /**
   * Get main image URL from shop_images array
   */
  private getMainImageUrl(shopImages: any[] | null | undefined): string | null {
    if (!shopImages || shopImages.length === 0) {
      return null;
    }

    // Find primary image first
    const primaryImage = shopImages.find((img) => img.is_primary);
    if (primaryImage) {
      return primaryImage.image_url;
    }

    // Fall back to first image by display order
    const sortedImages = [...shopImages].sort(
      (a, b) => (a.display_order || 0) - (b.display_order || 0)
    );
    return sortedImages[0]?.image_url || null;
  }

  /**
   * Map database shop to ShopPreview
   * TODO: Add rating/reviewCount when review aggregation is implemented
   */
  private mapShopPreview(shop: any, includeDistance: boolean): ShopPreview {
    const preview: ShopPreview = {
      id: shop.id,
      name: shop.name,
      category: shop.main_category,
      thumbnailUrl: this.getMainImageUrl(shop.shop_images),
      rating: 0, // TODO: Calculate from reviews
      reviewCount: 0, // TODO: Calculate from reviews
      address: shop.address || null,
    };

    if (includeDistance && shop.distanceKm !== undefined) {
      preview.distanceKm = shop.distanceKm;
      preview.distanceText = this.formatDistance(shop.distanceKm);
    }

    return preview;
  }
}

export const homeService = new HomeService();
export default homeService;
