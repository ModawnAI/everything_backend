import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ServiceCategory, ShopType, ShopStatus } from '../types/database.types';
import { cacheService } from './cache.service';
import { favoritesService } from './favorites.service';
import { shopCategoriesService } from './shop-categories.service';
import crypto from 'crypto';

export interface ShopSearchFilters {
  query?: string;                    // Text search query
  category?: ServiceCategory;        // Primary service category filter
  categories?: ServiceCategory[];    // Multiple category selection
  subCategories?: ServiceCategory[]; // Sub-category filtering
  shopType?: ShopType;              // Shop type filter
  shopTypes?: ShopType[];           // Multiple shop type selection
  status?: ShopStatus;              // Shop status filter
  statuses?: ShopStatus[];          // Multiple status selection
  onlyFeatured?: boolean;           // Featured shops only
  onlyOpen?: boolean;               // Currently open shops only
  openOn?: string;                  // Open on specific day (monday, tuesday, etc.)
  openAt?: string;                  // Open at specific time (HH:MM format)
  priceRange?: {                    // Price range filter
    min?: number;
    max?: number;
  };
  rating?: {                        // Rating filter
    min?: number;
    max?: number;
  };
  location?: {                      // Location-based filtering
    latitude: number;
    longitude: number;
    radiusKm?: number;
  };
  bounds?: {                        // Bounds-based filtering for map views
    northEast: {
      latitude: number;
      longitude: number;
    };
    southWest: {
      latitude: number;
      longitude: number;
    };
  };
  paymentMethods?: string[];        // Accepted payment methods
  hasServices?: ServiceCategory[];  // Must have specific services available
  serviceNames?: string[];          // Filter by specific service names
  bookingRange?: {                  // Total bookings filter
    min?: number;
    max?: number;
  };
  commissionRange?: {               // Commission rate filter
    min?: number;
    max?: number;
  };
  createdAfter?: string;            // Created after date (ISO string)
  createdBefore?: string;           // Created before date (ISO string)
  partnershipAfter?: string;        // Partnership started after date
  partnershipBefore?: string;       // Partnership started before date
  hasBusinessLicense?: boolean;     // Has business license
  hasImages?: boolean;              // Has shop images
  minImages?: number;               // Minimum number of images
  excludeIds?: string[];            // Exclude specific shop IDs
  includeInactive?: boolean;        // Include inactive shops in results
  sortBy?: 'relevance' | 'distance' | 'rating' | 'price' | 'name' | 'created_at' | 'bookings' | 'partnership_date';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ShopSearchResult {
  id: string;
  name: string;
  description?: string;
  address: string;
  detailedAddress?: string;
  latitude?: number;
  longitude?: number;
  shopType: ShopType;
  shopStatus: ShopStatus;
  mainCategory: ServiceCategory;
  subCategories?: ServiceCategory[];
  phoneNumber?: string;
  email?: string;
  operatingHours?: Record<string, any>;
  paymentMethods?: string[];
  businessLicenseNumber?: string;
  isFeatured: boolean;
  featuredUntil?: string;
  totalBookings: number;
  commissionRate?: number;
  createdAt: string;
  updatedAt: string;
  // Computed fields for search
  distance?: number;               // Distance in km (if location provided)
  relevanceScore?: number;         // Text search relevance
  isOpen?: boolean;               // Currently open status
  averageRating?: number;         // Average rating from reviews
  reviewCount?: number;           // Number of reviews
  priceRange?: {                  // Price range from services
    min: number;
    max: number;
  };
  // Favorites information
  isFavorite?: boolean;           // Whether the shop is favorited by the current user
  favoriteId?: string;            // ID of the favorite record (if favorited)
  images?: Array<{
    id: string;
    imageUrl: string;
    altText?: string;
    isPrimary: boolean;
  }>;
  services?: Array<{
    id: string;
    name: string;
    category: ServiceCategory;
    priceMin?: number;
    priceMax?: number;
    duration?: number;
    isAvailable: boolean;
  }>;
}

export interface ShopSearchResponse {
  shops: ShopSearchResult[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  searchMetadata: {
    query?: string;
    filters: Partial<ShopSearchFilters>;
    executionTime: number;
    searchType: 'text' | 'location' | 'bounds' | 'filter' | 'hybrid';
    sortedBy: string;
    cacheMetrics: {
      hit: boolean;
      key?: string;
      ttl?: number;
    };
  };
}

export class ShopSearchService {
  private supabase = getSupabaseClient();
  private readonly CACHE_PREFIX = 'shop_search';
  private readonly DEFAULT_CACHE_TTL = 600; // 10 minutes
  private readonly POPULAR_SEARCH_TTL = 900; // 15 minutes for popular searches

  /**
   * Search shops with advanced filtering and full-text search
   */
  async searchShops(filters: ShopSearchFilters, userId?: string): Promise<ShopSearchResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('Shop search initiated', { filters });

      // Generate cache key and check cache first
      const cacheKey = this.generateCacheKey(filters, userId);
      const cacheTTL = this.getCacheTTL(filters);
      
      // Try to get from cache
      const cachedResult = await cacheService.get<ShopSearchResponse>(cacheKey, this.CACHE_PREFIX);
      if (cachedResult) {
        logger.info('Shop search cache hit', { 
          cacheKey, 
          executionTime: Date.now() - startTime 
        });
        
        // Update cache metrics and return cached result
        cachedResult.searchMetadata.cacheMetrics = {
          hit: true,
          key: cacheKey,
          ttl: cacheTTL
        };
        cachedResult.searchMetadata.executionTime = Date.now() - startTime;
        
        return cachedResult;
      }

      logger.info('Shop search cache miss, executing query', { cacheKey });

      const {
        query,
        category,
        shopType,
        status = 'active',
        onlyFeatured = false,
        onlyOpen = false,
        priceRange,
        rating,
        location,
        sortBy = 'relevance',
        sortOrder = 'desc',
        limit = 20,
        offset = 0
      } = filters;

      // Determine search type
      const searchType = this.determineSearchType(filters);
      
      // Build the search query
      let searchQuery: any;
      
      if (searchType === 'bounds' || (searchType === 'hybrid' && filters.bounds)) {
        // Use bounds-based search with PostGIS
        searchQuery = await this.buildBoundsSearchQuery(filters);
      } else if (searchType === 'location' || (searchType === 'hybrid' && location)) {
        // Use spatial search with PostGIS
        searchQuery = await this.buildSpatialSearchQuery(filters);
      } else {
        // Use standard search with full-text capabilities
        searchQuery = await this.buildTextSearchQuery(filters);
      }

      const { data: shops, error, count } = await searchQuery;

      if (error) {
        logger.error('Shop search query failed', { 
          error: error.message, 
          filters 
        });
        throw new Error(`Search failed: ${error.message}`);
      }

      // Enrich results with computed fields
      const enrichedShops = await this.enrichSearchResults(shops || [], filters, userId);

      // Apply post-query filtering and sorting
      const processedShops = await this.processSearchResults(enrichedShops, filters);

      const executionTime = Date.now() - startTime;
      const totalCount = count || processedShops.length;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      const response: ShopSearchResponse = {
        shops: processedShops,
        totalCount,
        hasMore: totalCount > offset + processedShops.length,
        currentPage,
        totalPages,
        searchMetadata: {
          query,
          filters: {
            category,
            shopType,
            status,
            onlyFeatured,
            onlyOpen,
            priceRange,
            rating,
            location: location ? {
              latitude: location.latitude,
              longitude: location.longitude,
              radiusKm: location.radiusKm
            } : undefined,
            sortBy,
            sortOrder,
            limit,
            offset
          },
          executionTime,
          searchType,
          sortedBy: `${sortBy} ${sortOrder}`,
          cacheMetrics: {
            hit: false,
            key: cacheKey,
            ttl: cacheTTL
          }
        }
      };

      // Cache the result for future requests
      await cacheService.set(cacheKey, response, {
        ttl: cacheTTL,
        prefix: this.CACHE_PREFIX,
        tags: ['shop_search', searchType]
      });

      logger.info('Shop search completed and cached', {
        cacheKey,
        executionTime,
        resultCount: processedShops.length,
        totalCount,
        searchType
      });

      return response;

    } catch (error) {
      logger.error('Shop search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters
      });
      throw error;
    }
  }

  /**
   * Generate cache key for search filters
   */
  private generateCacheKey(filters: ShopSearchFilters, userId?: string): string {
    // Create a normalized version of filters for consistent caching
    const normalizedFilters = {
      query: filters.query?.toLowerCase().trim(),
      category: filters.category,
      categories: filters.categories?.sort(),
      subCategories: filters.subCategories?.sort(),
      shopType: filters.shopType,
      shopTypes: filters.shopTypes?.sort(),
      status: filters.status,
      statuses: filters.statuses?.sort(),
      onlyFeatured: filters.onlyFeatured,
      onlyOpen: filters.onlyOpen,
      openOn: filters.openOn,
      openAt: filters.openAt,
      location: filters.location ? {
        latitude: Math.round(filters.location.latitude * 10000) / 10000, // Round to 4 decimal places
        longitude: Math.round(filters.location.longitude * 10000) / 10000,
        radiusKm: filters.location.radiusKm
      } : undefined,
      bounds: filters.bounds ? {
        northEast: {
          latitude: Math.round(filters.bounds.northEast.latitude * 10000) / 10000,
          longitude: Math.round(filters.bounds.northEast.longitude * 10000) / 10000
        },
        southWest: {
          latitude: Math.round(filters.bounds.southWest.latitude * 10000) / 10000,
          longitude: Math.round(filters.bounds.southWest.longitude * 10000) / 10000
        }
      } : undefined,
      paymentMethods: filters.paymentMethods?.sort(),
      hasServices: filters.hasServices?.sort(),
      serviceNames: filters.serviceNames?.sort(),
      priceRange: filters.priceRange,
      rating: filters.rating,
      bookingRange: filters.bookingRange,
      commissionRange: filters.commissionRange,
      createdAfter: filters.createdAfter,
      createdBefore: filters.createdBefore,
      partnershipAfter: filters.partnershipAfter,
      partnershipBefore: filters.partnershipBefore,
      hasBusinessLicense: filters.hasBusinessLicense,
      hasImages: filters.hasImages,
      minImages: filters.minImages,
      excludeIds: filters.excludeIds?.sort(),
      includeInactive: filters.includeInactive,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      limit: filters.limit,
      offset: filters.offset
    };

    // Create hash of normalized filters including userId
    const cacheData = {
      ...normalizedFilters,
      userId: userId || 'anonymous' // Include userId in cache key
    };
    const filtersString = JSON.stringify(cacheData);
    const hash = crypto.createHash('md5').update(filtersString).digest('hex');
    
    return `${this.CACHE_PREFIX}:${hash}`;
  }

  /**
   * Determine cache TTL based on search characteristics
   */
  private getCacheTTL(filters: ShopSearchFilters): number {
    // Popular searches (simple queries) get longer TTL
    if (filters.query && filters.query.length <= 10 && !filters.location && !filters.bounds) {
      return this.POPULAR_SEARCH_TTL;
    }
    
    // Location-based searches get shorter TTL due to dynamic nature
    if (filters.location || filters.bounds) {
      return Math.floor(this.DEFAULT_CACHE_TTL * 0.5); // 5 minutes
    }
    
    // Complex filtered searches get standard TTL
    return this.DEFAULT_CACHE_TTL;
  }

  /**
   * Invalidate search cache when shop data changes
   */
  async invalidateShopCache(shopId?: string): Promise<void> {
    try {
      if (shopId) {
        // Invalidate specific shop-related caches
        await cacheService.invalidateByTags(['shop_search']);
        logger.info('Shop search cache invalidated for shop', { shopId });
      } else {
        // Invalidate all search caches
        await cacheService.invalidateByTags(['shop_search']);
        logger.info('All shop search cache invalidated');
      }
    } catch (error) {
      logger.error('Failed to invalidate shop search cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
    }
  }

  /**
   * Invalidate location-based caches (when shop locations change)
   */
  async invalidateLocationCache(): Promise<void> {
    try {
      await cacheService.invalidateByTags(['shop_search']);
      logger.info('Location-based shop search cache invalidated');
    } catch (error) {
      logger.error('Failed to invalidate location-based cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ hits: number; misses: number; hitRate: number }> {
    try {
      const stats = await cacheService.getStats();
      const hitRate = stats.hits + stats.misses > 0 ? 
        (stats.hits / (stats.hits + stats.misses)) * 100 : 0;
      
      return {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: Math.round(hitRate * 100) / 100
      };
    } catch (error) {
      logger.error('Failed to get cache stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { hits: 0, misses: 0, hitRate: 0 };
    }
  }

  /**
   * Determine the type of search based on filters
   */
  private determineSearchType(filters: ShopSearchFilters): 'text' | 'location' | 'bounds' | 'filter' | 'hybrid' {
    const hasTextQuery = !!filters.query;
    const hasLocation = !!filters.location;
    const hasBounds = !!filters.bounds;
    const hasFilters = !!(filters.category || filters.shopType || filters.priceRange || filters.rating);

    if (hasTextQuery && (hasLocation || hasBounds)) return 'hybrid';
    if (hasBounds) return 'bounds';
    if (hasLocation) return 'location';
    if (hasTextQuery) return 'text';
    return 'filter';
  }

  /**
   * Build spatial search query using PostGIS
   */
  private async buildSpatialSearchQuery(filters: ShopSearchFilters) {
    const {
      query,
      category,
      categories,
      subCategories,
      shopType,
      shopTypes,
      status = 'active',
      statuses,
      onlyFeatured = false,
      location,
      limit = 20,
      offset = 0
    } = filters;

    if (!location) {
      throw new Error('Location is required for spatial search');
    }

    // Build base spatial query
    let baseQuery = this.supabase
      .from('shops')
      .select(`
        *,
        shop_images:shop_images(
          id,
          image_url,
          alt_text,
          is_primary,
          display_order
        ),
        shop_services:shop_services(
          id,
          name,
          category,
          price_min,
          price_max,
          duration_minutes,
          is_available
        )
      `, { count: 'exact' });

    // Apply advanced filtering
    baseQuery = this.applyAdvancedFilters(baseQuery, filters);

    // Apply text search if provided
    if (query) {
      const searchTerm = query.trim();
      baseQuery = baseQuery.or(
        `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`
      );
    }

    // For spatial filtering, we'll need to use RPC or raw SQL
    // For now, we'll use a simple approach and filter by approximate bounds
    const radiusKm = location.radiusKm || 10;
    const latDelta = radiusKm / 111; // Rough conversion: 1 degree ≈ 111 km
    const lngDelta = radiusKm / (111 * Math.cos(location.latitude * Math.PI / 180));

    baseQuery = baseQuery
      .gte('latitude', location.latitude - latDelta)
      .lte('latitude', location.latitude + latDelta)
      .gte('longitude', location.longitude - lngDelta)
      .lte('longitude', location.longitude + lngDelta);

    // Apply pagination
    baseQuery = baseQuery.range(offset, offset + limit - 1);

    return baseQuery;
  }

  /**
   * Build text search query with PostgreSQL full-text search
   */
  private async buildTextSearchQuery(filters: ShopSearchFilters) {
    const {
      query,
      limit = 20,
      offset = 0
    } = filters;

    let baseQuery = this.supabase
      .from('shops')
      .select(`
        *,
        shop_images:shop_images(
          id,
          image_url,
          alt_text,
          is_primary,
          display_order
        ),
        shop_services:shop_services(
          id,
          name,
          category,
          price_min,
          price_max,
          duration_minutes,
          is_available
        )
      `, { count: 'exact' });

    // Apply advanced filtering
    baseQuery = this.applyAdvancedFilters(baseQuery, filters);

    // Apply text search
    if (query) {
      const searchTerm = query.trim();
      // Use ilike for now, can be enhanced with tsvector/tsquery later
      baseQuery = baseQuery.or(
        `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`
      );
    }

    // Apply sorting
    const { sortBy = 'created_at', sortOrder = 'desc' } = filters;
    if (sortBy === 'relevance' && query) {
      // For relevance sorting, we'll order by name match first, then description
      baseQuery = baseQuery.order('name');
    } else {
      const ascending = sortOrder === 'asc';
      const orderColumn = this.mapSortByToColumn(sortBy);
      baseQuery = baseQuery.order(orderColumn, { ascending });
    }

    // Apply pagination
    baseQuery = baseQuery.range(offset, offset + limit - 1);

    return baseQuery;
  }

  /**
   * Build bounds-based search query using PostGIS ST_Within
   */
  private async buildBoundsSearchQuery(filters: ShopSearchFilters) {
    const {
      bounds,
      query,
      limit = 20,
      offset = 0
    } = filters;

    if (!bounds) {
      throw new Error('Bounds are required for bounds-based search');
    }

    const { northEast, southWest } = bounds;

    // Validate bounds coordinates
    if (!northEast.latitude || !northEast.longitude || !southWest.latitude || !southWest.longitude) {
      throw new Error('Invalid bounds coordinates');
    }

    // Build base bounds query using PostGIS ST_Within
    let baseQuery = this.supabase
      .from('shops')
      .select(`
        *,
        shop_images:shop_images(
          id,
          image_url,
          alt_text,
          is_primary,
          display_order
        ),
        shop_services:shop_services(
          id,
          name,
          category,
          price_min,
          price_max,
          duration_minutes,
          is_available
        )
      `, { count: 'exact' });

    // Apply advanced filtering
    baseQuery = this.applyAdvancedFilters(baseQuery, filters);

    // Apply bounds filtering using PostGIS
    // Note: We use RPC call for complex PostGIS operations
    const boundsFilter = `ST_Within(location, ST_MakeEnvelope(${southWest.longitude}, ${southWest.latitude}, ${northEast.longitude}, ${northEast.latitude}, 4326))`;
    
    // For now, use simple lat/lng bounds filtering (can be enhanced with RPC for PostGIS)
    baseQuery = baseQuery
      .gte('latitude', southWest.latitude)
      .lte('latitude', northEast.latitude)
      .gte('longitude', southWest.longitude)
      .lte('longitude', northEast.longitude)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    // Apply text search if provided
    if (query) {
      const searchTerm = query.trim();
      baseQuery = baseQuery.or(
        `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`
      );
    }

    // Apply PRD 2.1 sorting for bounds queries
    baseQuery = baseQuery
      .order('shop_type', { ascending: false }) // partnered first
      .order('partnership_started_at', { ascending: false, nullsFirst: false })
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true });

    // Apply pagination
    baseQuery = baseQuery.range(offset, offset + limit - 1);

    return baseQuery;
  }

  /**
   * Apply advanced filters to the query
   */
  private applyAdvancedFilters(baseQuery: any, filters: ShopSearchFilters): any {
    const {
      category,
      categories,
      subCategories,
      shopType,
      shopTypes,
      status = 'active',
      statuses,
      onlyFeatured = false,
      paymentMethods,
      bookingRange,
      commissionRange,
      createdAfter,
      createdBefore,
      partnershipAfter,
      partnershipBefore,
      hasBusinessLicense,
      hasImages,
      minImages,
      excludeIds,
      includeInactive = false
    } = filters;

    // Status filtering
    if (statuses && statuses.length > 0) {
      baseQuery = baseQuery.in('shop_status', statuses);
    } else if (!includeInactive) {
      baseQuery = baseQuery.eq('shop_status', status);
    }

    // Category filtering
    if (categories && categories.length > 0) {
      baseQuery = baseQuery.in('main_category', categories);
    } else if (category) {
      baseQuery = baseQuery.eq('main_category', category);
    }

    // Sub-category filtering (using array overlaps)
    if (subCategories && subCategories.length > 0) {
      // For PostgreSQL array overlaps, we need to use overlaps
      baseQuery = baseQuery.overlaps('sub_categories', subCategories);
    }

    // Shop type filtering
    if (shopTypes && shopTypes.length > 0) {
      baseQuery = baseQuery.in('shop_type', shopTypes);
    } else if (shopType) {
      baseQuery = baseQuery.eq('shop_type', shopType);
    }

    // Featured filtering
    if (onlyFeatured) {
      baseQuery = baseQuery.eq('is_featured', true);
      baseQuery = baseQuery.gt('featured_until', new Date().toISOString());
    }

    // Payment methods filtering
    if (paymentMethods && paymentMethods.length > 0) {
      baseQuery = baseQuery.overlaps('payment_methods', paymentMethods);
    }

    // Booking range filtering
    if (bookingRange) {
      if (bookingRange.min !== undefined) {
        baseQuery = baseQuery.gte('total_bookings', bookingRange.min);
      }
      if (bookingRange.max !== undefined) {
        baseQuery = baseQuery.lte('total_bookings', bookingRange.max);
      }
    }

    // Commission range filtering
    if (commissionRange) {
      if (commissionRange.min !== undefined) {
        baseQuery = baseQuery.gte('commission_rate', commissionRange.min);
      }
      if (commissionRange.max !== undefined) {
        baseQuery = baseQuery.lte('commission_rate', commissionRange.max);
      }
    }

    // Date range filtering
    if (createdAfter) {
      baseQuery = baseQuery.gte('created_at', createdAfter);
    }
    if (createdBefore) {
      baseQuery = baseQuery.lte('created_at', createdBefore);
    }

    // Partnership date filtering
    if (partnershipAfter) {
      baseQuery = baseQuery.gte('partnership_started_at', partnershipAfter);
    }
    if (partnershipBefore) {
      baseQuery = baseQuery.lte('partnership_started_at', partnershipBefore);
    }

    // Business license filtering
    if (hasBusinessLicense !== undefined) {
      if (hasBusinessLicense) {
        baseQuery = baseQuery.not('business_license_number', 'is', null);
      } else {
        baseQuery = baseQuery.is('business_license_number', null);
      }
    }

    // Exclude specific IDs
    if (excludeIds && excludeIds.length > 0) {
      baseQuery = baseQuery.not('id', 'in', `(${excludeIds.map(id => `'${id}'`).join(',')})`);
    }

    return baseQuery;
  }

  /**
   * Map sortBy parameter to database column
   */
  private mapSortByToColumn(sortBy: string): string {
    const columnMap: Record<string, string> = {
      'relevance': 'name',
      'distance': 'name', // Will be handled separately in spatial queries
      'rating': 'name', // Will be computed from reviews
      'price': 'name', // Will be computed from services
      'name': 'name',
      'created_at': 'created_at',
      'bookings': 'total_bookings',
      'partnership_date': 'partnership_started_at'
    };
    
    return columnMap[sortBy] || 'created_at';
  }

  /**
   * Enrich search results with computed fields and favorites information
   */
  private async enrichSearchResults(
    shops: any[], 
    filters: ShopSearchFilters,
    userId?: string
  ): Promise<ShopSearchResult[]> {
    // Get favorites information for all shops if user is authenticated
    let favoritesMap: Record<string, { isFavorite: boolean; favoriteId?: string }> = {};
    
    if (userId && shops.length > 0) {
      try {
        const shopIds = shops.map(shop => shop.id);
        const favoritesStatus = await favoritesService.checkMultipleFavorites(userId, shopIds);
        
        // Convert to map for easy lookup
        favoritesMap = Object.entries(favoritesStatus).reduce((acc, [shopId, isFavorite]) => {
          acc[shopId] = { isFavorite, favoriteId: undefined };
          return acc;
        }, {} as Record<string, { isFavorite: boolean; favoriteId?: string }>);
      } catch (error) {
        logger.warn('Failed to fetch favorites information for search results', { 
          userId, 
          shopCount: shops.length, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return shops.map(shop => {
      const result: ShopSearchResult = {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        address: shop.address,
        detailedAddress: shop.detailed_address,
        latitude: shop.latitude,
        longitude: shop.longitude,
        shopType: shop.shop_type,
        shopStatus: shop.shop_status,
        mainCategory: shop.main_category,
        subCategories: shop.sub_categories,
        phoneNumber: shop.phone_number,
        email: shop.email,
        operatingHours: shop.operating_hours,
        paymentMethods: shop.payment_methods,
        businessLicenseNumber: shop.business_license_number,
        isFeatured: shop.is_featured,
        featuredUntil: shop.featured_until,
        totalBookings: shop.total_bookings || 0,
        commissionRate: shop.commission_rate,
        createdAt: shop.created_at,
        updatedAt: shop.updated_at,
        // Add favorites information
        isFavorite: userId ? (favoritesMap[shop.id]?.isFavorite || false) : undefined,
        favoriteId: userId && favoritesMap[shop.id]?.isFavorite ? favoritesMap[shop.id].favoriteId : undefined
      };

      // Calculate distance if location provided
      if (filters.location && shop.latitude && shop.longitude) {
        result.distance = this.calculateDistance(
          filters.location.latitude,
          filters.location.longitude,
          shop.latitude,
          shop.longitude
        );
      }

      // Calculate relevance score for text search
      if (filters.query) {
        result.relevanceScore = this.calculateRelevanceScore(shop, filters.query);
      }

      // Determine if shop is currently open
      result.isOpen = this.isShopCurrentlyOpen(shop.operating_hours);

      // Process images
      if (shop.shop_images) {
        result.images = shop.shop_images.map((img: any) => ({
          id: img.id,
          imageUrl: img.image_url,
          altText: img.alt_text,
          isPrimary: img.is_primary
        }));
      }

      // Process services and calculate price range
      if (shop.shop_services) {
        result.services = shop.shop_services.map((service: any) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          priceMin: service.price_min,
          priceMax: service.price_max,
          duration: service.duration_minutes,
          isAvailable: service.is_available
        }));

        // Calculate price range from services
        const availableServices = shop.shop_services.filter((s: any) => s.is_available);
        if (availableServices.length > 0) {
          const prices = availableServices
            .flatMap((s: any) => [s.price_min, s.price_max])
            .filter((p: any) => p != null);
          
          if (prices.length > 0) {
            result.priceRange = {
              min: Math.min(...prices),
              max: Math.max(...prices)
            };
          }
        }
      }

      return result;
    });
  }

  /**
   * Process and sort search results
   */
  private async processSearchResults(
    shops: ShopSearchResult[], 
    filters: ShopSearchFilters
  ): Promise<ShopSearchResult[]> {
    let processedShops = [...shops];

    // Apply post-query filters
    if (filters.onlyOpen) {
      processedShops = processedShops.filter(shop => shop.isOpen);
    }

    // Apply operating hours filtering
    if (filters.openOn) {
      processedShops = processedShops.filter(shop => 
        this.isOpenOnDay(shop.operatingHours, filters.openOn!)
      );
    }

    if (filters.openAt) {
      processedShops = processedShops.filter(shop => 
        this.isOpenAtTime(shop.operatingHours, filters.openAt!)
      );
    }

    // Apply price range filtering
    if (filters.priceRange) {
      processedShops = processedShops.filter(shop => {
        if (!shop.priceRange) return false;
        
        const { min, max } = filters.priceRange!;
        return (!min || shop.priceRange.min >= min) && 
               (!max || shop.priceRange.max <= max);
      });
    }

    // Apply rating filtering
    if (filters.rating) {
      processedShops = processedShops.filter(shop => {
        const rating = shop.averageRating || 0;
        const { min, max } = filters.rating!;
        return (!min || rating >= min) && (!max || rating <= max);
      });
    }

    // Apply service-specific filtering
    if (filters.hasServices && filters.hasServices.length > 0) {
      processedShops = processedShops.filter(shop => 
        this.hasRequiredServices(shop.services || [], filters.hasServices!)
      );
    }

    if (filters.serviceNames && filters.serviceNames.length > 0) {
      processedShops = processedShops.filter(shop => 
        this.hasServiceNames(shop.services || [], filters.serviceNames!)
      );
    }

    // Apply image filtering
    if (filters.hasImages) {
      processedShops = processedShops.filter(shop => 
        shop.images && shop.images.length > 0
      );
    }

    if (filters.minImages) {
      processedShops = processedShops.filter(shop => 
        shop.images && shop.images.length >= filters.minImages!
      );
    }

    // Apply custom sorting
    const { sortBy = 'relevance', sortOrder = 'desc' } = filters;
    
    processedShops.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = (b.relevanceScore || 0) - (a.relevanceScore || 0);
          break;
        case 'distance':
          comparison = (a.distance || Infinity) - (b.distance || Infinity);
          break;
        case 'rating':
          comparison = (b.averageRating || 0) - (a.averageRating || 0);
          break;
        case 'price':
          const aPrice = a.priceRange?.min || Infinity;
          const bPrice = b.priceRange?.min || Infinity;
          comparison = aPrice - bPrice;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ko');
          break;
        case 'created_at':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'bookings':
          comparison = (b.totalBookings || 0) - (a.totalBookings || 0);
          break;
        case 'partnership_date':
          const aPartnership = a.createdAt; // Fallback to created_at if no partnership date
          const bPartnership = b.createdAt;
          comparison = new Date(bPartnership).getTime() - new Date(aPartnership).getTime();
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? comparison : -comparison;
    });

    return processedShops;
  }

  /**
   * Check if shop is open on a specific day
   */
  private isOpenOnDay(operatingHours: any, day: string): boolean {
    if (!operatingHours || !operatingHours[day.toLowerCase()]) return false;
    
    const dayHours = operatingHours[day.toLowerCase()];
    return !dayHours.closed && dayHours.open && dayHours.close;
  }

  /**
   * Check if shop is open at a specific time
   */
  private isOpenAtTime(operatingHours: any, time: string): boolean {
    if (!operatingHours) return false;
    
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = operatingHours[currentDay];
    
    if (!dayHours || dayHours.closed) return false;
    
    const { open, close } = dayHours;
    if (!open || !close) return false;
    
    return time >= open && time <= close;
  }

  /**
   * Check if shop has required services
   */
  private hasRequiredServices(services: any[], requiredServices: ServiceCategory[]): boolean {
    const serviceCategories = services.map(s => s.category);
    return requiredServices.every(required => 
      serviceCategories.includes(required)
    );
  }

  /**
   * Check if shop has services with specific names
   */
  private hasServiceNames(services: any[], requiredNames: string[]): boolean {
    const serviceNames = services.map(s => s.name.toLowerCase());
    return requiredNames.some(required => 
      serviceNames.some(name => name.includes(required.toLowerCase()))
    );
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate relevance score for text search
   */
  private calculateRelevanceScore(shop: any, query: string): number {
    const searchTerm = query.toLowerCase();
    let score = 0;

    // Name match (highest weight)
    if (shop.name?.toLowerCase().includes(searchTerm)) {
      score += 10;
      if (shop.name.toLowerCase().startsWith(searchTerm)) {
        score += 5; // Bonus for prefix match
      }
    }

    // Description match (medium weight)
    if (shop.description?.toLowerCase().includes(searchTerm)) {
      score += 5;
    }

    // Address match (lower weight)
    if (shop.address?.toLowerCase().includes(searchTerm)) {
      score += 2;
    }

    // Category match (medium weight)
    if (shop.main_category?.toLowerCase().includes(searchTerm)) {
      score += 3;
    }

    return score;
  }

  /**
   * Check if shop is currently open based on operating hours
   */
  private isShopCurrentlyOpen(operatingHours: any): boolean {
    if (!operatingHours) return false;

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    const dayHours = operatingHours[currentDay];
    if (!dayHours || dayHours.closed) return false;

    const { open, close } = dayHours;
    if (!open || !close) return false;

    return currentTime >= open && currentTime <= close;
  }

  /**
   * Get popular search suggestions
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      if (!query || query.length < 2) return [];

      const searchTerm = query.toLowerCase().trim();

      // Get shop names that match the query
      const { data: shops } = await this.supabase
        .from('shops')
        .select('name, main_category')
        .eq('shop_status', 'active')
        .ilike('name', `%${searchTerm}%`)
        .limit(limit);

      const suggestions = new Set<string>();

      // Add shop names
      shops?.forEach(shop => {
        if (shop.name.toLowerCase().includes(searchTerm)) {
          suggestions.add(shop.name);
        }
      });

      // Add category suggestions
      const categories = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];
      categories.forEach(category => {
        if (category.includes(searchTerm)) {
          suggestions.add(category);
        }
      });

      return Array.from(suggestions).slice(0, limit);

    } catch (error) {
      logger.error('Failed to get search suggestions', { error, query });
      return [];
    }
  }
}

export const shopSearchService = new ShopSearchService();
