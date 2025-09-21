import { Request, Response } from 'express';
import { shopSearchService, ShopSearchFilters } from '../services/shop-search.service';
import { shopCategoriesService } from '../services/shop-categories.service';
import { logger } from '../utils/logger';
import { ServiceCategory, ShopType, ShopStatus } from '../types/database.types';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Request interfaces
interface ShopSearchRequest extends AuthenticatedRequest {
  query: {
    q?: string;                      // Search query
    query?: string;                  // Alternative search query parameter
    category?: ServiceCategory;      // Primary service category filter
    categories?: string;             // Multiple categories (comma-separated)
    subCategories?: string;          // Sub-categories (comma-separated)
    shopType?: ShopType;            // Shop type filter
    shopTypes?: string;             // Multiple shop types (comma-separated)
    status?: ShopStatus;            // Shop status filter
    statuses?: string;              // Multiple statuses (comma-separated)
    onlyFeatured?: string;          // Featured shops only ('true'/'false')
    onlyOpen?: string;              // Currently open shops only ('true'/'false')
    openOn?: string;                // Open on specific day
    openAt?: string;                // Open at specific time (HH:MM)
    priceMin?: string;              // Minimum price filter
    priceMax?: string;              // Maximum price filter
    ratingMin?: string;             // Minimum rating filter
    ratingMax?: string;             // Maximum rating filter
    latitude?: string;              // User latitude for location-based search
    longitude?: string;             // User longitude for location-based search
    radius?: string;                // Search radius in km
    neLat?: string;                 // Northeast latitude for bounds search
    neLng?: string;                 // Northeast longitude for bounds search
    swLat?: string;                 // Southwest latitude for bounds search
    swLng?: string;                 // Southwest longitude for bounds search
    paymentMethods?: string;        // Payment methods (comma-separated)
    hasServices?: string;           // Required services (comma-separated)
    serviceNames?: string;          // Service names (comma-separated)
    bookingMin?: string;            // Minimum total bookings
    bookingMax?: string;            // Maximum total bookings
    commissionMin?: string;         // Minimum commission rate
    commissionMax?: string;         // Maximum commission rate
    createdAfter?: string;          // Created after date (ISO string)
    createdBefore?: string;         // Created before date (ISO string)
    partnershipAfter?: string;      // Partnership after date (ISO string)
    partnershipBefore?: string;     // Partnership before date (ISO string)
    hasBusinessLicense?: string;    // Has business license ('true'/'false')
    hasImages?: string;             // Has images ('true'/'false')
    minImages?: string;             // Minimum number of images
    excludeIds?: string;            // Exclude shop IDs (comma-separated)
    includeInactive?: string;       // Include inactive shops ('true'/'false')
    sortBy?: 'relevance' | 'distance' | 'rating' | 'price' | 'name' | 'created_at' | 'bookings' | 'partnership_date';
    sortOrder?: 'asc' | 'desc';
    limit?: string;                 // Results per page
    offset?: string;                // Pagination offset
    page?: string;                  // Page number (alternative to offset)
  };
}

interface SearchSuggestionsRequest extends Request {
  query: {
    q?: string;                     // Search query for suggestions
    limit?: string;                 // Number of suggestions to return
  };
}

export class ShopSearchController {
  /**
   * GET /api/shops/search
   * Advanced shop search with full-text search and filtering
   */
  async searchShops(req: ShopSearchRequest, res: Response): Promise<void> {
    try {
      const {
        q,
        query,
        category,
        categories,
        subCategories,
        shopType,
        shopTypes,
        status,
        statuses,
        onlyFeatured,
        onlyOpen,
        openOn,
        openAt,
        priceMin,
        priceMax,
        ratingMin,
        ratingMax,
        latitude,
        longitude,
        radius,
        neLat,
        neLng,
        swLat,
        swLng,
        paymentMethods,
        hasServices,
        serviceNames,
        bookingMin,
        bookingMax,
        commissionMin,
        commissionMax,
        createdAfter,
        createdBefore,
        partnershipAfter,
        partnershipBefore,
        hasBusinessLicense,
        hasImages,
        minImages,
        excludeIds,
        includeInactive,
        sortBy = 'relevance',
        sortOrder = 'desc',
        limit = '20',
        offset = '0',
        page
      } = req.query;

      // Validate and parse parameters
      const searchQuery = q || query;
      const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 results
      let offsetNum = parseInt(offset) || 0;

      // Handle page-based pagination
      if (page) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        offsetNum = (pageNum - 1) * limitNum;
      }

      // Validate location parameters
      let location: { latitude: number; longitude: number; radiusKm?: number } | undefined;
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_COORDINATES',
              message: '유효하지 않은 좌표입니다.',
              details: '위도는 -90~90, 경도는 -180~180 범위여야 합니다.'
            }
          });
          return;
        }

        location = {
          latitude: lat,
          longitude: lng,
          radiusKm: radius ? Math.min(parseFloat(radius) || 10, 50) : 10 // Max 50km radius
        };
      }

      // Validate bounds parameters
      let bounds: { northEast: { latitude: number; longitude: number }; southWest: { latitude: number; longitude: number } } | undefined;
      if (neLat && neLng && swLat && swLng) {
        const neLat_num = parseFloat(neLat);
        const neLng_num = parseFloat(neLng);
        const swLat_num = parseFloat(swLat);
        const swLng_num = parseFloat(swLng);
        
        // Validate coordinate ranges
        if (isNaN(neLat_num) || isNaN(neLng_num) || isNaN(swLat_num) || isNaN(swLng_num) ||
            neLat_num < -90 || neLat_num > 90 || neLng_num < -180 || neLng_num > 180 ||
            swLat_num < -90 || swLat_num > 90 || swLng_num < -180 || swLng_num > 180) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_BOUNDS',
              message: '유효하지 않은 경계 좌표입니다.',
              details: '위도는 -90~90, 경도는 -180~180 범위여야 합니다.'
            }
          });
          return;
        }

        // Validate bounds logic (northeast should be northeast of southwest)
        if (neLat_num <= swLat_num || neLng_num <= swLng_num) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_BOUNDS_LOGIC',
              message: '잘못된 경계 설정입니다.',
              details: '북동쪽 좌표는 남서쪽 좌표보다 크거나 같아야 합니다.'
            }
          });
          return;
        }

        bounds = {
          northEast: {
            latitude: neLat_num,
            longitude: neLng_num
          },
          southWest: {
            latitude: swLat_num,
            longitude: swLng_num
          }
        };
      }

      // Validate category using categories service
      if (category) {
        try {
          const categories = await shopCategoriesService.getAllCategories({ includeInactive: false, withServiceTypes: false });
          const validCategories = categories.map(cat => cat.id as ServiceCategory);
          
          if (!validCategories.includes(category)) {
            res.status(400).json({
              success: false,
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
              success: false,
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

      // Validate shop type
      if (shopType) {
        const validShopTypes: ShopType[] = ['partnered', 'non_partnered'];
        if (!validShopTypes.includes(shopType)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_SHOP_TYPE',
              message: '유효하지 않은 샵 타입입니다.',
              details: `유효한 샵 타입: ${validShopTypes.join(', ')}`
            }
          });
          return;
        }
      }

      // Parse array parameters
      const categoriesArray = categories ? categories.split(',').map(c => c.trim() as ServiceCategory) : undefined;
      const subCategoriesArray = subCategories ? subCategories.split(',').map(c => c.trim() as ServiceCategory) : undefined;
      const shopTypesArray = shopTypes ? shopTypes.split(',').map(t => t.trim() as ShopType) : undefined;
      const statusesArray = statuses ? statuses.split(',').map(s => s.trim() as ShopStatus) : undefined;
      const paymentMethodsArray = paymentMethods ? paymentMethods.split(',').map(p => p.trim()) : undefined;
      const hasServicesArray = hasServices ? hasServices.split(',').map(s => s.trim() as ServiceCategory) : undefined;
      const serviceNamesArray = serviceNames ? serviceNames.split(',').map(s => s.trim()) : undefined;
      const excludeIdsArray = excludeIds ? excludeIds.split(',').map(id => id.trim()) : undefined;

      // Validate sort parameters
      const validSortBy = ['relevance', 'distance', 'rating', 'price', 'name', 'created_at', 'bookings', 'partnership_date'];
      if (!validSortBy.includes(sortBy)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SORT_BY',
            message: '유효하지 않은 정렬 기준입니다.',
            details: `유효한 정렬 기준: ${validSortBy.join(', ')}`
          }
        });
        return;
      }

      if (sortOrder !== 'asc' && sortOrder !== 'desc') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SORT_ORDER',
            message: '유효하지 않은 정렬 순서입니다.',
            details: '유효한 정렬 순서: asc, desc'
          }
        });
        return;
      }

      // Build search filters
      const filters: ShopSearchFilters = {
        query: searchQuery,
        category,
        categories: categoriesArray,
        subCategories: subCategoriesArray,
        shopType,
        shopTypes: shopTypesArray,
        status: status || 'active',
        statuses: statusesArray,
        onlyFeatured: onlyFeatured === 'true',
        onlyOpen: onlyOpen === 'true',
        openOn,
        openAt,
        location,
        bounds,
        paymentMethods: paymentMethodsArray,
        hasServices: hasServicesArray,
        serviceNames: serviceNamesArray,
        createdAfter,
        createdBefore,
        partnershipAfter,
        partnershipBefore,
        hasBusinessLicense: hasBusinessLicense === 'true' ? true : hasBusinessLicense === 'false' ? false : undefined,
        hasImages: hasImages === 'true',
        minImages: minImages ? parseInt(minImages) : undefined,
        excludeIds: excludeIdsArray,
        includeInactive: includeInactive === 'true',
        sortBy,
        sortOrder,
        limit: limitNum,
        offset: offsetNum
      };

      // Add price range filter
      if (priceMin || priceMax) {
        filters.priceRange = {};
        if (priceMin) {
          const min = parseFloat(priceMin);
          if (!isNaN(min) && min >= 0) {
            filters.priceRange.min = min;
          }
        }
        if (priceMax) {
          const max = parseFloat(priceMax);
          if (!isNaN(max) && max >= 0) {
            filters.priceRange.max = max;
          }
        }
      }

      // Add rating filter
      if (ratingMin || ratingMax) {
        filters.rating = {};
        if (ratingMin) {
          const min = parseFloat(ratingMin);
          if (!isNaN(min) && min >= 0 && min <= 5) {
            filters.rating.min = min;
          }
        }
        if (ratingMax) {
          const max = parseFloat(ratingMax);
          if (!isNaN(max) && max >= 0 && max <= 5) {
            filters.rating.max = max;
          }
        }
      }

      // Add booking range filter
      if (bookingMin || bookingMax) {
        filters.bookingRange = {};
        if (bookingMin) {
          const min = parseInt(bookingMin);
          if (!isNaN(min) && min >= 0) {
            filters.bookingRange.min = min;
          }
        }
        if (bookingMax) {
          const max = parseInt(bookingMax);
          if (!isNaN(max) && max >= 0) {
            filters.bookingRange.max = max;
          }
        }
      }

      // Add commission range filter
      if (commissionMin || commissionMax) {
        filters.commissionRange = {};
        if (commissionMin) {
          const min = parseFloat(commissionMin);
          if (!isNaN(min) && min >= 0 && min <= 100) {
            filters.commissionRange.min = min;
          }
        }
        if (commissionMax) {
          const max = parseFloat(commissionMax);
          if (!isNaN(max) && max >= 0 && max <= 100) {
            filters.commissionRange.max = max;
          }
        }
      }

      // Perform search
      const searchResults = await shopSearchService.searchShops(filters, req.user?.id);

      // Log search for analytics
      logger.info('Shop search performed', {
        query: searchQuery,
        category,
        shopType,
        location: location ? `${location.latitude},${location.longitude}` : undefined,
        resultsCount: searchResults.shops.length,
        totalCount: searchResults.totalCount,
        executionTime: searchResults.searchMetadata.executionTime,
        searchType: searchResults.searchMetadata.searchType
      });

      res.status(200).json({
        success: true,
        data: searchResults,
        message: searchQuery 
          ? `"${searchQuery}" 검색 결과 ${searchResults.totalCount}개를 찾았습니다.`
          : `총 ${searchResults.totalCount}개의 샵을 찾았습니다.`
      });

    } catch (error) {
      logger.error('Shop search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: '검색 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shops/search/suggestions
   * Get search suggestions for autocomplete
   */
  async getSearchSuggestions(req: SearchSuggestionsRequest, res: Response): Promise<void> {
    try {
      const { q, limit = '5' } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_QUERY',
            message: '검색어가 필요합니다.',
            details: 'q 파라미터에 검색어를 입력해주세요.'
          }
        });
        return;
      }

      const limitNum = Math.min(parseInt(limit) || 5, 10); // Max 10 suggestions
      const suggestions = await shopSearchService.getSearchSuggestions(q, limitNum);

      res.status(200).json({
        success: true,
        data: {
          query: q,
          suggestions,
          count: suggestions.length
        },
        message: `${suggestions.length}개의 검색 제안을 찾았습니다.`
      });

    } catch (error) {
      logger.error('Search suggestions failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'SUGGESTIONS_FAILED',
          message: '검색 제안을 가져오는 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shops/search/popular
   * Get popular search terms and trending shops
   */
  async getPopularSearches(req: Request, res: Response): Promise<void> {
    try {
      // For now, return static popular searches
      // In production, this would be based on search analytics
      const popularSearches = [
        '네일아트',
        '속눈썹 연장',
        '왁싱',
        '눈썹 문신',
        '헤어 컷',
        '젤네일',
        '마사지',
        '피부관리',
        '메이크업',
        '반영구'
      ];

      // Get trending categories from categories service
      let trendingCategories;
      try {
        const categories = await shopCategoriesService.getAllCategories({ includeInactive: false, withServiceTypes: false });
        trendingCategories = categories.map((cat, index) => ({
          category: cat.id,
          name: cat.displayName,
          count: 1250 - (index * 150) // Mock trending counts based on sort order
        }));
      } catch (error) {
        logger.error('Error getting trending categories', { error });
        // Fallback to hardcoded data
        trendingCategories = [
          { category: 'nail', name: '네일', count: 1250 },
          { category: 'eyelash', name: '속눈썹', count: 980 },
          { category: 'waxing', name: '왁싱', count: 750 },
          { category: 'eyebrow_tattoo', name: '눈썹문신', count: 650 },
          { category: 'hair', name: '헤어', count: 1100 }
        ];
      }

      res.status(200).json({
        success: true,
        data: {
          popularSearches,
          trendingCategories,
          lastUpdated: new Date().toISOString()
        },
        message: '인기 검색어를 조회했습니다.'
      });

    } catch (error) {
      logger.error('Popular searches failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'POPULAR_SEARCHES_FAILED',
          message: '인기 검색어를 가져오는 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}

export const shopSearchController = new ShopSearchController();
