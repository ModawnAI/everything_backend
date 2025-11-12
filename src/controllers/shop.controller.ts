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
import { shopContactMethodsService } from '../services/shop-contact-methods.service';
import { shopCategoriesService } from '../services/shop-categories.service';

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
    disableGeofencing?: string;
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
   * @swagger
   * /api/shops/nearby:
   *   get:
   *     summary: Find nearby shops
   *     description: Find shops within a specified radius using PostGIS spatial queries with optional filtering by category and type
   *     tags: [Shops]
   *     parameters:
   *       - in: query
   *         name: latitude
   *         required: true
   *         schema:
   *           type: number
   *           minimum: -90
   *           maximum: 90
   *         description: Latitude coordinate
   *         example: 37.5665
   *       - in: query
   *         name: longitude
   *         required: true
   *         schema:
   *           type: number
   *           minimum: -180
   *           maximum: 180
   *         description: Longitude coordinate
   *         example: 126.9780
   *       - in: query
   *         name: radius
   *         required: false
   *         schema:
   *           type: number
   *           minimum: 0.1
   *           maximum: 50
   *           default: 5
   *         description: Search radius in kilometers
   *         example: 2.5
   *       - in: query
   *         name: category
   *         required: false
   *         schema:
   *           type: string
   *           enum: [hair, nail, skin, makeup, massage, eyebrow, eyelash]
   *         description: Filter by service category
   *         example: "hair"
   *       - in: query
   *         name: shopType
   *         required: false
   *         schema:
   *           type: string
   *           enum: [salon, individual, home_service]
   *         description: Filter by shop type
   *         example: "salon"
   *       - in: query
   *         name: onlyFeatured
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Show only featured shops
   *         example: false
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Maximum number of results
   *         example: 20
   *       - in: query
   *         name: offset
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of results to skip (for pagination)
   *         example: 0
   *       - in: query
   *         name: disableGeofencing
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Disable Seoul city boundary validation
   *         example: false
   *     responses:
   *       200:
   *         description: Nearby shops retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     shops:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                             format: uuid
   *                             example: "123e4567-e89b-12d3-a456-426614174000"
   *                           name:
   *                             type: string
   *                             example: "뷰티살롱 ABC"
   *                           description:
   *                             type: string
   *                             example: "전문적인 헤어 및 네일 서비스를 제공합니다"
   *                           address:
   *                             type: string
   *                             example: "서울시 강남구 테헤란로 123"
   *                           latitude:
   *                             type: number
   *                             example: 37.5665
   *                           longitude:
   *                             type: number
   *                             example: 126.9780
   *                           distance:
   *                             type: number
   *                             description: Distance in kilometers
   *                             example: 1.2
   *                           mainCategory:
   *                             type: string
   *                             example: "hair"
   *                           subCategories:
   *                             type: array
   *                             items:
   *                               type: string
   *                             example: ["cut", "color", "perm"]
   *                           shopType:
   *                             type: string
   *                             enum: [salon, individual, home_service]
   *                             example: "salon"
   *                           status:
   *                             type: string
   *                             enum: [pending, approved, rejected, suspended]
   *                             example: "approved"
   *                           rating:
   *                             type: number
   *                             minimum: 0
   *                             maximum: 5
   *                             example: 4.5
   *                           reviewCount:
   *                             type: integer
   *                             minimum: 0
   *                             example: 127
   *                           isOpen:
   *                             type: boolean
   *                             example: true
   *                           isFeatured:
   *                             type: boolean
   *                             example: false
   *                           images:
   *                             type: array
   *                             items:
   *                               type: string
   *                               format: uri
   *                             example: ["https://storage.supabase.co/v1/object/public/shop-images/image1.jpg"]
   *                     totalCount:
   *                       type: integer
   *                       description: Total number of shops found
   *                       example: 45
   *                     searchRadius:
   *                       type: number
   *                       description: Search radius used (km)
   *                       example: 2.5
   *                     center:
   *                       type: object
   *                       properties:
   *                         latitude:
   *                           type: number
   *                           example: 37.5665
   *                         longitude:
   *                           type: number
   *                           example: 126.9780
   *       400:
   *         description: Bad request - Invalid coordinates or parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: object
   *                   properties:
   *                     code:
   *                       type: string
   *                       example: "INVALID_COORDINATES"
   *                     message:
   *                       type: string
   *                       example: "유효하지 않은 좌표입니다."
   *                     details:
   *                       type: string
   *                       example: "위도와 경도는 필수이며 유효한 범위 내에 있어야 합니다."
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
        offset = '0',
        disableGeofencing = 'false'
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

      // Parse boolean parameters
      const onlyFeaturedBool = onlyFeatured === 'true';
      const disableGeofencingBool = disableGeofencing === 'true';

      // Validate category using categories service
      if (category) {
        try {
          const categories = await shopCategoriesService.getAllCategories({ includeInactive: false, withServiceTypes: false });
          const validCategories = categories.map(cat => cat.id as ServiceCategory);
          
          if (!validCategories.includes(category)) {
            res.status(400).json({
              error: {
                code: 'INVALID_CATEGORY',
                message: '유효하지 않은 카테고리입니다.',
                details: `유효한 카테고리: ${validCategories.join(', ')}`
              }
            });
            return;
          }
        } catch (error) {
          logger.error('Error validating category', { error, category });
          // Fallback to hardcoded validation if service fails
          const validCategories: ServiceCategory[] = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];
          if (!validCategories.includes(category)) {
            res.status(400).json({
              error: {
                code: 'INVALID_CATEGORY',
                message: '유효하지 않은 카테고리입니다.',
                details: `유효한 카테고리: ${validCategories.join(', ')}`
              }
            });
            return;
          }
        }
      }

      // Call the optimized spatial utility function with configurable geofencing
      const params: any = {
        userLocation: { latitude: lat, longitude: lng },
        radiusKm,
        onlyFeatured: onlyFeaturedBool,
        limit: limitNum,
        offset: offsetNum,
        enforceSeoulBoundary: !disableGeofencingBool // Configurable Seoul city boundary validation
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

      // Fetch contact methods and shop images for all shops
      const shopIds = nearbyShops.map(shop => shop.id);
      const contactMethodsMap = new Map<string, any[]>();
      const shopImagesMap = new Map<string, any[]>();

      if (shopIds.length > 0) {
        try {
          const { data: allContactMethods, error: contactError } = await getSupabaseClient()
            .from('shop_contact_methods')
            .select('*')
            .in('shop_id', shopIds)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

          if (!contactError && allContactMethods) {
            allContactMethods.forEach(contactMethod => {
              if (!contactMethodsMap.has(contactMethod.shop_id)) {
                contactMethodsMap.set(contactMethod.shop_id, []);
              }
              contactMethodsMap.get(contactMethod.shop_id)!.push(contactMethod);
            });
          }
        } catch (error) {
          logger.error('Failed to fetch contact methods for nearby shops', {
            error: error instanceof Error ? error.message : 'Unknown error',
            shopIds
          });
        }

        // Fetch shop images
        try {
          const { data: allShopImages, error: imagesError } = await getSupabaseClient()
            .from('shop_images')
            .select('*')
            .in('shop_id', shopIds)
            .order('is_main', { ascending: false })
            .order('display_order', { ascending: true });

          if (!imagesError && allShopImages) {
            allShopImages.forEach(image => {
              if (!shopImagesMap.has(image.shop_id)) {
                shopImagesMap.set(image.shop_id, []);
              }
              shopImagesMap.get(image.shop_id)!.push(image);
            });
          }
        } catch (error) {
          logger.error('Failed to fetch shop images for nearby shops', {
            error: error instanceof Error ? error.message : 'Unknown error',
            shopIds
          });
        }
      }

      // Enhanced response with performance metrics and detailed shop data
      const responseData = {
        shops: nearbyShops.map(shop => ({
          id: shop.id,
          name: shop.name,
          address: shop.address,
          detailed_address: shop.detailed_address,
          latitude: shop.latitude,
          longitude: shop.longitude,
          distance: {
            km: shop.distance_km,
            meters: shop.distance_m
          },
          shop_type: shop.shop_type,
          shop_status: shop.shop_status,
          main_category: shop.main_category,
          sub_categories: shop.sub_categories || [],
          is_featured: shop.is_featured,
          featured_until: shop.featured_until,
          partnership_started_at: shop.partnership_started_at,
          phone_number: shop.phone_number,
          description: shop.description,
          operating_hours: shop.operating_hours,
          payment_methods: shop.payment_methods || [],
          total_bookings: shop.total_bookings || 0,
          commission_rate: shop.commission_rate,
          contact_methods: contactMethodsMap.get(shop.id) || [],
          shop_images: shopImagesMap.get(shop.id) || []
        })),
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
          hasMore: nearbyShops.length === limitNum,
          currentPage: Math.floor(offsetNum / limitNum) + 1
        },
        performance: {
          sortingAlgorithm: 'PRD 2.1 (partnered → partnership_date → featured → distance)',
          indexesUsed: [
            category ? 'idx_shops_active_category_location' : null,
            shopType ? 'idx_shops_type_status_location' : null,
            onlyFeaturedBool ? 'idx_shops_featured_location' : null
          ].filter(Boolean),
          geofencing: 'Seoul city boundary enforced'
        }
      };

      // Return successful response
      res.status(200).json({
        success: true,
        data: responseData,
        message: `반경 ${radiusKm}km 내 ${nearbyShops.length}개의 샵을 찾았습니다.`
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
   * GET /api/shops/popular
   * Get popular shops using the official partner shop priority algorithm (PRD 2.1)
   * Sorting: partnered shops (by newest partnership_started_at) → non-partnered shops
   */
  async getPopularShops(req: Request, res: Response): Promise<void> {
    try {
      const {
        category,
        limit = '50',
        offset = '0'
      } = req.query;

      // Parse and validate limit and offset
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);

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

      // Validate category if provided
      if (category) {
        try {
          const categories = await shopCategoriesService.getAllCategories({ includeInactive: false, withServiceTypes: false });
          const validCategories = categories.map(cat => cat.id as ServiceCategory);

          if (!validCategories.includes(category as ServiceCategory)) {
            res.status(400).json({
              error: {
                code: 'INVALID_CATEGORY',
                message: '유효하지 않은 카테고리입니다.',
                details: `유효한 카테고리: ${validCategories.join(', ')}`
              }
            });
            return;
          }
        } catch (error) {
          logger.error('Error validating category', { error, category });
          const validCategories: ServiceCategory[] = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];
          if (!validCategories.includes(category as ServiceCategory)) {
            res.status(400).json({
              error: {
                code: 'INVALID_CATEGORY',
                message: '유효하지 않은 카테고리입니다.',
                details: `유효한 카테고리: ${validCategories.join(', ')}`
              }
            });
            return;
          }
        }
      }

      // Build query with PRD 2.1 algorithm: partnered shops first, sorted by partnership date
      let query = getSupabaseClient()
        .from('shops')
        .select(`
          id,
          name,
          address,
          detailed_address,
          latitude,
          longitude,
          shop_type,
          shop_status,
          main_category,
          sub_categories,
          is_featured,
          featured_until,
          partnership_started_at,
          phone_number,
          description,
          operating_hours,
          payment_methods,
          total_bookings,
          commission_rate
        `)
        .eq('shop_status', 'active')
        .range(offsetNum, offsetNum + limitNum - 1)
        .order('is_featured', { ascending: false, nullsFirst: false }) // featured shops first
        .order('shop_type', { ascending: false }) // partnered (true) before non_partnered (false)
        .order('partnership_started_at', { ascending: false, nullsFirst: false }) // newest first within partnered
        .order('created_at', { ascending: false }); // fallback for non-partnered shops

      // Apply category filter if provided
      if (category) {
        query = query.eq('main_category', category);
      }

      const { data: shops, error } = await query;

      if (error) {
        logger.error('Error fetching popular shops', {
          error: error.message,
          category,
          limit: limitNum,
          offset: offsetNum
        });
        throw error;
      }

      // Fetch contact methods and shop images for all shops
      const shopIds = (shops || []).map(shop => shop.id);
      const contactMethodsMap = new Map<string, any[]>();
      const shopImagesMap = new Map<string, any[]>();

      if (shopIds.length > 0) {
        try {
          const { data: allContactMethods, error: contactError } = await getSupabaseClient()
            .from('shop_contact_methods')
            .select('*')
            .in('shop_id', shopIds)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

          if (!contactError && allContactMethods) {
            allContactMethods.forEach(contactMethod => {
              if (!contactMethodsMap.has(contactMethod.shop_id)) {
                contactMethodsMap.set(contactMethod.shop_id, []);
              }
              contactMethodsMap.get(contactMethod.shop_id)!.push(contactMethod);
            });
          }
        } catch (error) {
          logger.error('Failed to fetch contact methods for popular shops', {
            error: error instanceof Error ? error.message : 'Unknown error',
            shopIds
          });
        }

        // Fetch shop images
        try {
          const { data: allShopImages, error: imagesError } = await getSupabaseClient()
            .from('shop_images')
            .select('*')
            .in('shop_id', shopIds)
            .order('is_main', { ascending: false })
            .order('display_order', { ascending: true });

          if (!imagesError && allShopImages) {
            allShopImages.forEach(image => {
              if (!shopImagesMap.has(image.shop_id)) {
                shopImagesMap.set(image.shop_id, []);
              }
              shopImagesMap.get(image.shop_id)!.push(image);
            });
          }
        } catch (error) {
          logger.error('Failed to fetch shop images for popular shops', {
            error: error instanceof Error ? error.message : 'Unknown error',
            shopIds
          });
        }
      }

      // Log successful search
      logger.info('Popular shops search completed', {
        category,
        resultCount: shops?.length || 0,
        limit: limitNum,
        offset: offsetNum
      });

      // Enhanced response with PRD 2.1 algorithm metadata
      const responseData = {
        shops: (shops || []).map(shop => ({
          id: shop.id,
          name: shop.name,
          address: shop.address,
          detailed_address: shop.detailed_address,
          latitude: shop.latitude,
          longitude: shop.longitude,
          shop_type: shop.shop_type,
          shop_status: shop.shop_status,
          main_category: shop.main_category,
          sub_categories: shop.sub_categories || [],
          is_featured: shop.is_featured,
          featured_until: shop.featured_until,
          partnership_started_at: shop.partnership_started_at,
          phone_number: shop.phone_number,
          description: shop.description,
          operating_hours: shop.operating_hours,
          payment_methods: shop.payment_methods || [],
          total_bookings: shop.total_bookings || 0,
          commission_rate: shop.commission_rate,
          contact_methods: contactMethodsMap.get(shop.id) || [],
          shop_images: shopImagesMap.get(shop.id) || []
        })),
        searchParams: {
          category,
          limit: limitNum,
          offset: offsetNum
        },
        pagination: {
          total: shops?.length || 0,
          limit: limitNum,
          offset: offsetNum,
          hasMore: (shops?.length || 0) === limitNum,
          currentPage: Math.floor(offsetNum / limitNum) + 1
        },
        performance: {
          sortingAlgorithm: 'PRD 2.1: 입점 샵 우선 (최신 입점순) → 비입점 샵',
          description: '공식 입점 샵을 최상단에 우선 노출하고, 입점 샵 그룹 내에서는 최신 입점 순서대로 정렬'
        }
      };

      // Return successful response
      res.status(200).json({
        success: true,
        data: responseData,
        message: `인기 샵 ${shops?.length || 0}개를 찾았습니다.`
      });

    } catch (error) {
      logger.error('Error in getPopularShops', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '인기 샵 조회 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
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

      // Validate category using categories service
      if (category) {
        try {
          const categories = await shopCategoriesService.getAllCategories({ includeInactive: false, withServiceTypes: false });
          const validCategories = categories.map(cat => cat.id as ServiceCategory);
          
          if (!validCategories.includes(category)) {
            res.status(400).json({
              error: {
                code: 'INVALID_CATEGORY',
                message: '유효하지 않은 카테고리입니다.',
                details: `유효한 카테고리: ${validCategories.join(', ')}`
              }
            });
            return;
          }
        } catch (error) {
          logger.error('Error validating category in bounds search', { error, category });
          // Fallback to hardcoded validation if service fails
          const validCategories: ServiceCategory[] = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];
          if (!validCategories.includes(category)) {
            res.status(400).json({
              error: {
                code: 'INVALID_CATEGORY',
                message: '유효하지 않은 카테고리입니다.',
                details: `유효한 카테고리: ${validCategories.join(', ')}`
              }
            });
            return;
          }
        }
      }

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

      // Fetch contact methods for all shops
      const shopIds = shopsInBounds.map(shop => shop.id);
      const contactMethodsMap = new Map<string, any[]>();
      
      if (shopIds.length > 0) {
        try {
          const { data: allContactMethods, error: contactError } = await getSupabaseClient()
            .from('shop_contact_methods')
            .select('*')
            .in('shop_id', shopIds)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

          if (!contactError && allContactMethods) {
            allContactMethods.forEach(contactMethod => {
              if (!contactMethodsMap.has(contactMethod.shop_id)) {
                contactMethodsMap.set(contactMethod.shop_id, []);
              }
              contactMethodsMap.get(contactMethod.shop_id)!.push(contactMethod);
            });
          }
        } catch (error) {
          logger.error('Failed to fetch contact methods for shops in bounds', {
            error: error instanceof Error ? error.message : 'Unknown error',
            shopIds
          });
        }
      }

      // Add contact methods to each shop
      const shopsWithContactMethods = shopsInBounds.map(shop => ({
        ...shop,
        contact_methods: contactMethodsMap.get(shop.id) || []
      }));

      // Log successful search
      logger.info('Shops in bounds search completed', {
        bounds: { northEast, southWest },
        category,
        shopType,
        onlyFeatured: onlyFeaturedBool,
        resultCount: shopsWithContactMethods.length
      });

      // Return successful response
      res.status(200).json({
        success: true,
        data: {
          shops: shopsWithContactMethods,
          bounds: {
            northEast,
            southWest
          },
          filters: {
            category,
            shopType,
            onlyFeatured: onlyFeaturedBool
          },
          total: shopsWithContactMethods.length
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

      // Extract contact methods from shop data if provided
      const { contact_methods, ...shopDataWithoutContactMethods } = shopData;

      // Set default values
      const newShop = {
        ...shopDataWithoutContactMethods,
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

      // Create contact methods if provided
      let contactMethods = [];
      if (contact_methods && Array.isArray(contact_methods)) {
        try {
          contactMethods = await shopContactMethodsService.updateShopContactMethods(shop.id, contact_methods);
          logger.info('Contact methods created successfully', { shopId: shop.id, count: contactMethods.length });
        } catch (contactError) {
          logger.error('Failed to create contact methods', {
            error: contactError instanceof Error ? contactError.message : 'Unknown error',
            shopId: shop.id
          });
          // Don't fail the entire creation, just log the error
        }
      }

      logger.info('Shop created successfully', { shopId: shop.id });

      res.status(201).json({
        success: true,
        data: {
          ...shop,
          contact_methods: contactMethods
        },
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

      // Fetch contact methods and shop images for all shops
      const shopIds = shops?.map(shop => shop.id) || [];
      const contactMethodsMap = new Map<string, any[]>();
      const shopImagesMap = new Map<string, any[]>();

      if (shopIds.length > 0) {
        try {
          const { data: allContactMethods, error: contactError } = await client
            .from('shop_contact_methods')
            .select('*')
            .in('shop_id', shopIds)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

          if (!contactError && allContactMethods) {
            allContactMethods.forEach(contactMethod => {
              if (!contactMethodsMap.has(contactMethod.shop_id)) {
                contactMethodsMap.set(contactMethod.shop_id, []);
              }
              contactMethodsMap.get(contactMethod.shop_id)!.push(contactMethod);
            });
          }
        } catch (error) {
          logger.error('Failed to fetch contact methods for shops', {
            error: error instanceof Error ? error.message : 'Unknown error',
            shopIds
          });
        }

        // Fetch shop images
        try {
          const { data: allShopImages, error: imagesError} = await client
            .from('shop_images')
            .select('*')
            .in('shop_id', shopIds)
            .order('is_main', { ascending: false })
            .order('display_order', { ascending: true });

          if (!imagesError && allShopImages) {
            allShopImages.forEach(image => {
              if (!shopImagesMap.has(image.shop_id)) {
                shopImagesMap.set(image.shop_id, []);
              }
              shopImagesMap.get(image.shop_id)!.push(image);
            });
          }
        } catch (error) {
          logger.error('Failed to fetch shop images for shops', {
            error: error instanceof Error ? error.message : 'Unknown error',
            shopIds
          });
        }
      }

      // Add contact methods and shop images
      const shopsWithContactMethods = (shops || []).map(shop => ({
        ...shop,
        contact_methods: contactMethodsMap.get(shop.id) || [],
        shop_images: shopImagesMap.get(shop.id) || []
      }));

      logger.info('Shops retrieved successfully', {
        count: shopsWithContactMethods.length,
        filters: req.query
      });

      res.status(200).json({
        success: true,
        data: {
          shops: shopsWithContactMethods,
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total: shopsWithContactMethods.length
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

      // Get shop with aggregated data (using left joins to allow missing related data)
      // Note: Removed shop_status filter to allow viewing shops in any status
      const { data: shop, error } = await client
        .from('shops')
        .select(`
          *,
          shop_images(image_url, alt_text, is_primary, display_order),
          shop_services(
            id, name, description, category, price_min, price_max,
            duration_minutes, is_available, display_order
          )
        `)
        .eq('id', id)
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

      // Extract contact methods from update data if provided
      const { contact_methods, ...shopUpdateData } = updateData;

      // Add updated timestamp
      shopUpdateData.updated_at = new Date().toISOString();

      const { data: updatedShop, error } = await client
        .from('shops')
        .update(shopUpdateData)
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

      // Update contact methods if provided
      let contactMethods = null;
      if (contact_methods && Array.isArray(contact_methods)) {
        try {
          contactMethods = await shopContactMethodsService.updateShopContactMethods(id, contact_methods);
          logger.info('Contact methods updated successfully', { shopId: id, count: contactMethods.length });
        } catch (contactError) {
          logger.error('Failed to update contact methods', {
            error: contactError instanceof Error ? contactError.message : 'Unknown error',
            shopId: id
          });
          // Don't fail the entire update, just log the error
        }
      }

      // Get updated contact methods if not already fetched
      if (!contactMethods) {
        try {
          contactMethods = await shopContactMethodsService.getShopContactMethods(id);
        } catch (contactError) {
          logger.error('Failed to fetch contact methods', {
            error: contactError instanceof Error ? contactError.message : 'Unknown error',
            shopId: id
          });
          contactMethods = [];
        }
      }

      logger.info('Shop updated successfully', { shopId: id });

      res.status(200).json({
        success: true,
        data: {
          ...updatedShop,
          contact_methods: contactMethods
        },
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