/**
 * Shop Controller
 * 
 * Handles shop-related operations including:
 * - Location-based shop discovery
 * - Shop CRUD operations
 * - Shop management and verification
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { findNearbyShops, getShopsInBounds, validateCoordinates } from '../utils/spatial';
import { logger } from '../utils/logger';
import { Shop, ServiceCategory, ShopType, ShopStatus } from '../types/database.types';

// Request interfaces
interface NearbyShopsRequest extends Request {
  query: {
    latitude?: string;
    longitude?: string;
    radius?: string;
    category?: ServiceCategory;
    shopType?: ShopType;
    onlyFeatured?: string;
    limit?: string;
    offset?: string;
  };
}

interface BoundsShopsRequest extends Request {
  query: {
    neLat?: string;
    neLng?: string;
    swLat?: string;
    swLng?: string;
    category?: ServiceCategory;
    shopType?: ShopType;
    onlyFeatured?: string;
  };
}

export class ShopController {
  /**
   * GET /api/shops/nearby
   * Find nearby shops within specified radius using PostGIS spatial queries
   */
  async getNearbyShops(req: NearbyShopsRequest, res: Response): Promise<void> {
    try {
      const {
        latitude,
        longitude,
        radius = '10', // Default 10km radius
        category,
        shopType,
        onlyFeatured = 'false',
        limit = '50',
        offset = '0'
      } = req.query;

      // Validate required parameters
      if (!latitude || !longitude) {
        res.status(400).json({
          error: {
            code: 'MISSING_COORDINATES',
            message: '위도와 경도는 필수입니다.',
            details: 'latitude와 longitude 파라미터를 제공해주세요.'
          }
        });
        return;
      }

      // Parse and validate coordinates
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radiusKm = parseFloat(radius);
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      const onlyFeaturedBool = onlyFeatured === 'true';

      // Validate coordinate ranges
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        res.status(400).json({
          error: {
            code: 'INVALID_COORDINATES',
            message: '유효하지 않은 좌표입니다.',
            details: '위도는 -90~90, 경도는 -180~180 범위 내에서 입력해주세요.'
          }
        });
        return;
      }

      // Validate radius
      if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 100) {
        res.status(400).json({
          error: {
            code: 'INVALID_RADIUS',
            message: '검색 반경이 유효하지 않습니다.',
            details: '반경은 0.1~100km 범위 내에서 입력해주세요.'
          }
        });
        return;
      }

      // Validate limit and offset
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          error: {
            code: 'INVALID_LIMIT',
            message: '검색 결과 개수가 유효하지 않습니다.',
            details: 'limit은 1~100 범위 내에서 입력해주세요.'
          }
        });
        return;
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_OFFSET',
            message: '페이지 오프셋이 유효하지 않습니다.',
            details: 'offset은 0 이상의 값으로 입력해주세요.'
          }
        });
        return;
      }

      // Call the spatial utility function
      const params: any = {
        userLocation: { latitude: lat, longitude: lng },
        radiusKm,
        onlyFeatured: onlyFeaturedBool,
        limit: limitNum,
        offset: offsetNum
      };

      if (category) {
        params.category = category;
      }
      if (shopType) {
        params.shopType = shopType as 'partnered' | 'non_partnered';
      }

      const nearbyShops = await findNearbyShops(params);

      // Log successful search
      logger.info('Nearby shops search completed', {
        userLocation: { lat, lng },
        radiusKm,
        category,
        shopType,
        onlyFeatured: onlyFeaturedBool,
        resultCount: nearbyShops.length,
        limit: limitNum,
        offset: offsetNum
      });

      // Return successful response
      res.status(200).json({
        success: true,
        data: {
          shops: nearbyShops,
          searchParams: {
            latitude: lat,
            longitude: lng,
            radiusKm,
            category,
            shopType,
            onlyFeatured: onlyFeaturedBool,
            limit: limitNum,
            offset: offsetNum
          },
          pagination: {
            total: nearbyShops.length,
            limit: limitNum,
            offset: offsetNum,
            hasMore: nearbyShops.length === limitNum
          }
        }
      });

    } catch (error) {
      logger.error('Error in getNearbyShops', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '주변 샵 검색 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shops/bounds
   * Get shops within a bounding box (for map interfaces)
   */
  async getShopsInBounds(req: BoundsShopsRequest, res: Response): Promise<void> {
    try {
      const {
        neLat,
        neLng,
        swLat,
        swLng,
        category,
        shopType,
        onlyFeatured = 'false'
      } = req.query;

      // Validate required parameters
      if (!neLat || !neLng || !swLat || !swLng) {
        res.status(400).json({
          error: {
            code: 'MISSING_BOUNDS',
            message: '지도 영역 좌표가 필요합니다.',
            details: 'neLat, neLng, swLat, swLng 파라미터를 모두 제공해주세요.'
          }
        });
        return;
      }

      // Parse and validate coordinates
      const northEast = {
        latitude: parseFloat(neLat),
        longitude: parseFloat(neLng)
      };
      const southWest = {
        latitude: parseFloat(swLat),
        longitude: parseFloat(swLng)
      };

      // Validate coordinate ranges
      if (!validateCoordinates(northEast) || !validateCoordinates(southWest)) {
        res.status(400).json({
          error: {
            code: 'INVALID_BOUNDS',
            message: '유효하지 않은 지도 영역 좌표입니다.',
            details: '위도는 -90~90, 경도는 -180~180 범위 내에서 입력해주세요.'
          }
        });
        return;
      }

      // Validate bounds (northEast should be north and east of southWest)
      if (northEast.latitude <= southWest.latitude || northEast.longitude <= southWest.longitude) {
        res.status(400).json({
          error: {
            code: 'INVALID_BOUNDS_ORDER',
            message: '지도 영역 좌표 순서가 올바르지 않습니다.',
            details: 'northEast는 southWest보다 북쪽, 동쪽에 위치해야 합니다.'
          }
        });
        return;
      }

      const onlyFeaturedBool = onlyFeatured === 'true';

      // Call the spatial utility function
      const filters: any = {
        onlyFeatured: onlyFeaturedBool
      };

      if (category) {
        filters.category = category;
      }
      if (shopType) {
        filters.shopType = shopType;
      }

      const shopsInBounds = await getShopsInBounds(northEast, southWest, filters);

      // Log successful search
      logger.info('Shops in bounds search completed', {
        bounds: { northEast, southWest },
        category,
        shopType,
        onlyFeatured: onlyFeaturedBool,
        resultCount: shopsInBounds.length
      });

      // Return successful response
      res.status(200).json({
        success: true,
        data: {
          shops: shopsInBounds,
          bounds: {
            northEast,
            southWest
          },
          filters: {
            category,
            shopType,
            onlyFeatured: onlyFeaturedBool
          },
          total: shopsInBounds.length
        }
      });

    } catch (error) {
      logger.error('Error in getShopsInBounds', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '지도 영역 샵 검색 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/shops
   * Create a new shop
   */
  async createShop(req: Request, res: Response): Promise<void> {
    try {
      const shopData = req.body;
      const client = getSupabaseClient();

      // Validate required fields
      if (!shopData.name || !shopData.address || !shopData.main_category) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: '샵명, 주소, 주 서비스 카테고리는 필수입니다.'
          }
        });
        return;
      }

      // Set default values
      const newShop = {
        ...shopData,
        shop_status: 'pending_approval',
        verification_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Create shop location if coordinates provided
      if (shopData.latitude && shopData.longitude) {
        newShop.location = `POINT(${shopData.longitude} ${shopData.latitude})`;
      }

      const { data: shop, error } = await client
        .from('shops')
        .insert(newShop)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create shop', {
          error: error.message,
          shopData
        });

        res.status(500).json({
          error: {
            code: 'SHOP_CREATION_FAILED',
            message: '샵 생성에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      logger.info('Shop created successfully', { shopId: shop.id });

      res.status(201).json({
        success: true,
        data: shop,
        message: '샵이 성공적으로 생성되었습니다.'
      });

    } catch (error) {
      logger.error('Error in createShop', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shops
   * Get all shops with optional filtering
   */
  async getAllShops(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        category,
        shopType,
        limit = '50',
        offset = '0',
        ownerId
      } = req.query;

      const client = getSupabaseClient();
      let query = client.from('shops').select('*');

      // Apply filters
      if (status) {
        query = query.eq('shop_status', status);
      }
      if (category) {
        query = query.eq('main_category', category);
      }
      if (shopType) {
        query = query.eq('shop_type', shopType);
      }
      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      // Apply pagination
      const limitNum = parseInt(limit as string) || 50;
      const offsetNum = parseInt(offset as string) || 0;

      query = query.range(offsetNum, offsetNum + limitNum - 1);

      const { data: shops, error } = await query;

      if (error) {
        logger.error('Failed to get shops', {
          error: error.message,
          query: req.query
        });

        res.status(500).json({
          error: {
            code: 'SHOPS_FETCH_FAILED',
            message: '샵 목록 조회에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      logger.info('Shops retrieved successfully', {
        count: shops?.length || 0,
        filters: req.query
      });

      res.status(200).json({
        success: true,
        data: {
          shops: shops || [],
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total: shops?.length || 0
          }
        }
      });

    } catch (error) {
      logger.error('Error in getAllShops', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shops/:id
   * Get shop details by ID
   */
  async getShopById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      const client = getSupabaseClient();

      // Get shop with aggregated data
      const { data: shop, error } = await client
        .from('shops')
        .select(`
          *,
          shop_images!inner(image_url, alt_text, is_primary, display_order),
          shop_services!inner(
            id, name, description, category, price_min, price_max,
            duration_minutes, is_available, display_order
          )
        `)
        .eq('id', id)
        .eq('shop_status', 'active')
        .single();

      if (error || !shop) {
        res.status(404).json({
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '해당 샵을 찾을 수 없습니다.',
            details: '샵이 존재하지 않거나 비활성 상태입니다.'
          }
        });
        return;
      }

      // Get aggregated statistics
      const { data: stats } = await client
        .from('reservations')
        .select('id', { count: 'exact' })
        .eq('shop_id', id);

      const { data: reviews } = await client
        .from('reviews')
        .select('rating')
        .eq('shop_id', id)
        .eq('status', 'active');

      // Calculate average rating
      const averageRating = reviews && reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : 0;

      // Format response
      const shopDetails = {
        ...shop,
        statistics: {
          totalBookings: stats?.length || 0,
          totalReviews: reviews?.length || 0,
          averageRating: Math.round(averageRating * 10) / 10
        }
      };

      logger.info('Shop details retrieved', { shopId: id });

      res.status(200).json({
        success: true,
        data: shopDetails
      });

    } catch (error) {
      logger.error('Error in getShopById', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 정보 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * PUT /api/shops/:id
   * Update shop details
   */
  async updateShop(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        res.status(400).json({
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      const client = getSupabaseClient();

      // Check if shop exists
      const { data: existingShop, error: fetchError } = await client
        .from('shops')
        .select('id, shop_status')
        .eq('id', id)
        .single();

      if (fetchError || !existingShop) {
        res.status(404).json({
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '해당 샵을 찾을 수 없습니다.',
            details: '샵이 존재하지 않거나 삭제되었습니다.'
          }
        });
        return;
      }

      // Update location if coordinates provided
      if (updateData.latitude && updateData.longitude) {
        updateData.location = `POINT(${updateData.longitude} ${updateData.latitude})`;
      }

      // Add updated timestamp
      updateData.updated_at = new Date().toISOString();

      const { data: updatedShop, error } = await client
        .from('shops')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update shop', {
          error: error.message,
          shopId: id,
          updateData
        });

        res.status(500).json({
          error: {
            code: 'SHOP_UPDATE_FAILED',
            message: '샵 정보 업데이트에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      logger.info('Shop updated successfully', { shopId: id });

      res.status(200).json({
        success: true,
        data: updatedShop,
        message: '샵 정보가 성공적으로 업데이트되었습니다.'
      });

    } catch (error) {
      logger.error('Error in updateShop', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 정보 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * DELETE /api/shops/:id
   * Delete shop (soft delete)
   */
  async deleteShop(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      const client = getSupabaseClient();

      // Check if shop exists
      const { data: existingShop, error: fetchError } = await client
        .from('shops')
        .select('id, shop_status')
        .eq('id', id)
        .single();

      if (fetchError || !existingShop) {
        res.status(404).json({
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '해당 샵을 찾을 수 없습니다.',
            details: '샵이 존재하지 않거나 이미 삭제되었습니다.'
          }
        });
        return;
      }

      // Soft delete - update status to deleted
      const { error } = await client
        .from('shops')
        .update({
          shop_status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        logger.error('Failed to delete shop', {
          error: error.message,
          shopId: id
        });

        res.status(500).json({
          error: {
            code: 'SHOP_DELETION_FAILED',
            message: '샵 삭제에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      logger.info('Shop deleted successfully', { shopId: id });

      res.status(200).json({
        success: true,
        message: '샵이 성공적으로 삭제되었습니다.'
      });

    } catch (error) {
      logger.error('Error in deleteShop', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 삭제 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
} 