/**
 * Service Catalog Service
 * 
 * Handles enhanced service catalog operations including:
 * - Service catalog entry management
 * - Advanced search and filtering
 * - Service type metadata management
 * - Popularity and trending calculations
 * - Service statistics and analytics
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  ServiceCatalogEntry,
  ServiceCatalogEntrySummary,
  ServiceTypeMetadata,
  ServiceTypeMetadataSummary,
  ServiceCatalogFilter,
  ServiceCatalogSearchResult,
  ServiceCatalogStats,
  ServiceCatalogSearchRequest,
  CreateServiceCatalogEntryRequest,
  UpdateServiceCatalogEntryRequest,
  ServicePriceVariation,
  SeasonalPricing,
  ServiceRequirement,
  ServiceRestriction,
  ServiceImage,
  ServiceVideo,
  BeforeAfterImage
} from '../types/service-catalog.types';
import { ServiceCategory } from '../types/database.types';

class ServiceCatalogService {
  private supabase = getSupabaseClient();

  /**
   * Get all service catalog entries with optional filtering
   */
  async getServiceCatalogEntries(options: {
    shop_id?: string;
    category?: ServiceCategory;
    service_level?: string;
    difficulty_level?: string;
    is_available?: boolean;
    featured_only?: boolean;
    trending_only?: boolean;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<ServiceCatalogEntry[]> {
    try {
      const {
        shop_id,
        category,
        service_level,
        difficulty_level,
        is_available,
        featured_only,
        trending_only,
        limit = 50,
        offset = 0,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = options;

      let query = this.supabase
        .from('shop_services')
        .select(`
          *,
          service_images:service_images(*),
          service_videos:service_videos(*),
          before_after_images:before_after_images(*),
          service_type_metadata:service_type_metadata(*)
        `)
        .range(offset, offset + limit - 1);

      // Apply filters
      if (shop_id) {
        query = query.eq('shop_id', shop_id);
      }
      if (category) {
        query = query.eq('category', category);
      }
      if (service_level) {
        query = query.eq('service_level', service_level);
      }
      if (difficulty_level) {
        query = query.eq('difficulty_level', difficulty_level);
      }
      if (is_available !== undefined) {
        query = query.eq('is_available', is_available);
      }
      if (featured_only) {
        query = query.eq('featured', true);
      }
      if (trending_only) {
        query = query.eq('trending', true);
      }

      // Apply sorting
      query = query.order(sort_by, { ascending: sort_order === 'asc' });

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching service catalog entries', { error, options });
        throw new Error('Failed to fetch service catalog entries');
      }

      logger.info('Service catalog entries retrieved successfully', {
        count: data?.length || 0,
        options
      });

      return data || [];
    } catch (error) {
      logger.error('Error in getServiceCatalogEntries', { error, options });
      throw error;
    }
  }

  /**
   * Get a specific service catalog entry by ID
   */
  async getServiceCatalogEntryById(serviceId: string): Promise<ServiceCatalogEntry | null> {
    try {
      const { data, error } = await this.supabase
        .from('shop_services')
        .select(`
          *,
          service_images:service_images(*),
          service_videos:service_videos(*),
          before_after_images:before_after_images(*),
          service_type_metadata:service_type_metadata(*)
        `)
        .eq('id', serviceId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Error fetching service catalog entry', { error, serviceId });
        throw new Error('Failed to fetch service catalog entry');
      }

      logger.info('Service catalog entry retrieved successfully', { serviceId });
      return data;
    } catch (error) {
      logger.error('Error in getServiceCatalogEntryById', { error, serviceId });
      throw error;
    }
  }

  /**
   * Search service catalog entries with advanced filtering
   */
  async searchServiceCatalog(searchRequest: ServiceCatalogSearchRequest): Promise<ServiceCatalogSearchResult> {
    try {
      const {
        query,
        filters = {},
        page = 1,
        limit = 20,
        sort_by = 'popularity_score',
        sort_order = 'desc',
        include_unavailable = false
      } = searchRequest;

      const offset = (page - 1) * limit;

      let dbQuery = this.supabase
        .from('shop_services')
        .select(`
          *,
          service_images:service_images(*),
          service_videos:service_videos(*),
          before_after_images:before_after_images(*),
          service_type_metadata:service_type_metadata(*)
        `);

      // Apply text search
      if (query) {
        dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%,search_keywords.cs.{${query}}`);
      }

      // Apply filters
      if (filters.categories && filters.categories.length > 0) {
        dbQuery = dbQuery.in('category', filters.categories);
      }

      if (filters.price_range) {
        if (filters.price_range.min !== undefined) {
          dbQuery = dbQuery.gte('price_min', filters.price_range.min);
        }
        if (filters.price_range.max !== undefined) {
          dbQuery = dbQuery.lte('price_max', filters.price_range.max);
        }
      }

      if (filters.duration_range) {
        if (filters.duration_range.min !== undefined) {
          dbQuery = dbQuery.gte('duration_minutes', filters.duration_range.min);
        }
        if (filters.duration_range.max !== undefined) {
          dbQuery = dbQuery.lte('duration_minutes', filters.duration_range.max);
        }
      }

      if (filters.service_levels && filters.service_levels.length > 0) {
        dbQuery = dbQuery.in('service_level', filters.service_levels);
      }

      if (filters.difficulty_levels && filters.difficulty_levels.length > 0) {
        dbQuery = dbQuery.in('difficulty_level', filters.difficulty_levels);
      }

      if (filters.featured_only) {
        dbQuery = dbQuery.eq('featured', true);
      }

      if (filters.trending_only) {
        dbQuery = dbQuery.eq('trending', true);
      }

      if (filters.min_rating) {
        dbQuery = dbQuery.gte('rating_average', filters.min_rating);
      }

      if (!include_unavailable) {
        dbQuery = dbQuery.eq('is_available', true);
      }

      // Apply sorting
      dbQuery = dbQuery.order(sort_by, { ascending: sort_order === 'asc' });

      // Get total count - temporarily disabled due to type issues
      // const { count } = await dbQuery.select('*', { count: 'exact', head: true });
      const count = 0;

      // Get paginated results
      const { data, error } = await dbQuery.range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error searching service catalog', { error, searchRequest });
        throw new Error('Failed to search service catalog');
      }

      const result: ServiceCatalogSearchResult = {
        services: data || [],
        total_count: count || 0,
        page,
        limit,
        has_more: (count || 0) > offset + limit,
        filters_applied: filters,
        search_metadata: {
          search_time_ms: 0, // This would be calculated in a real implementation
          search_query: query,
          suggestions: [] // This would be populated by a search suggestion service
        }
      };

      logger.info('Service catalog search completed', {
        query,
        result_count: result.services.length,
        total_count: result.total_count,
        page,
        limit
      });

      return result;
    } catch (error) {
      logger.error('Error in searchServiceCatalog', { error, searchRequest });
      throw error;
    }
  }

  /**
   * Get service catalog statistics
   */
  async getServiceCatalogStats(): Promise<ServiceCatalogStats> {
    try {
      // Get basic counts
      const { count: totalServices } = await this.supabase
        .from('shop_services')
        .select('*', { count: 'exact', head: true });

      // Get services by category
      const { data: categoryData } = await this.supabase
        .from('shop_services')
        .select('category')
        .eq('is_available', true);

      const servicesByCategory = categoryData?.reduce((acc, service) => {
        acc[service.category] = (acc[service.category] || 0) + 1;
        return acc;
      }, {} as Partial<Record<ServiceCategory, number>>) || {};

      // Get services by level
      const { data: levelData } = await this.supabase
        .from('shop_services')
        .select('service_level')
        .eq('is_available', true);

      const servicesByLevel = levelData?.reduce((acc, service) => {
        acc[service.service_level] = (acc[service.service_level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get average prices by category
      const { data: priceData } = await this.supabase
        .from('shop_services')
        .select('category, price_min, price_max')
        .eq('is_available', true);

      const averagePriceByCategory = priceData?.reduce((acc, service) => {
        const avgPrice = ((service.price_min || 0) + (service.price_max || 0)) / 2;
        if (!acc[service.category]) {
          acc[service.category] = { total: 0, count: 0 };
        }
        acc[service.category].total += avgPrice;
        acc[service.category].count += 1;
        return acc;
      }, {} as Record<ServiceCategory, { total: number; count: number }>) || {};

      // Calculate averages
      const avgPriceByCategory = Object.entries(averagePriceByCategory).reduce((acc, [category, data]) => {
        acc[category as ServiceCategory] = (data as any).total / (data as any).count;
        return acc;
      }, {} as Record<ServiceCategory, number>);

      // Get popular services
      const { data: popularServices } = await this.supabase
        .from('shop_services')
        .select('*')
        .eq('is_available', true)
        .order('popularity_score', { ascending: false })
        .limit(10);

      // Get trending services
      const { data: trendingServices } = await this.supabase
        .from('shop_services')
        .select('*')
        .eq('is_available', true)
        .eq('trending', true)
        .order('popularity_score', { ascending: false })
        .limit(10);

      // Get recently added services
      const { data: recentlyAdded } = await this.supabase
        .from('shop_services')
        .select('*')
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get total bookings (this would come from reservations table in a real implementation)
      const totalBookings = 0; // Placeholder

      // Get average rating
      const { data: ratingData } = await this.supabase
        .from('shop_services')
        .select('rating_average')
        .eq('is_available', true)
        .not('rating_average', 'is', null);

      const averageRating = ratingData?.length > 0
        ? ratingData.reduce((sum, service) => sum + service.rating_average, 0) / ratingData.length
        : 0;

      const stats: ServiceCatalogStats = {
        total_services: totalServices || 0,
        services_by_category: servicesByCategory as Record<ServiceCategory, number>,
        services_by_level: servicesByLevel,
        average_price_by_category: avgPriceByCategory,
        most_popular_services: popularServices || [],
        trending_services: trendingServices || [],
        recently_added: recentlyAdded || [],
        total_bookings: totalBookings,
        average_rating: averageRating,
        last_updated: new Date().toISOString()
      };

      logger.info('Service catalog statistics retrieved successfully', {
        total_services: stats.total_services,
        categories_count: Object.keys(stats.services_by_category).length
      });

      return stats;
    } catch (error) {
      logger.error('Error in getServiceCatalogStats', { error });
      throw error;
    }
  }

  /**
   * Get service type metadata
   */
  async getServiceTypeMetadata(category?: ServiceCategory): Promise<ServiceTypeMetadata[]> {
    try {
      let query = this.supabase
        .from('service_type_metadata')
        .select('*')
        .order('created_at', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching service type metadata', { error, category });
        throw new Error('Failed to fetch service type metadata');
      }

      logger.info('Service type metadata retrieved successfully', {
        count: data?.length || 0,
        category
      });

      return data || [];
    } catch (error) {
      logger.error('Error in getServiceTypeMetadata', { error, category });
      throw error;
    }
  }

  /**
   * Get popular services across all categories
   */
  async getPopularServices(limit: number = 10): Promise<ServiceCatalogEntrySummary[]> {
    try {
      const { data, error } = await this.supabase
        .from('shop_services')
        .select(`
          id,
          shop_id,
          name,
          description,
          category,
          price_min,
          price_max,
          duration_minutes,
          service_level,
          difficulty_level,
          is_available,
          popularity_score,
          rating_average,
          rating_count,
          featured,
          trending,
          tags,
          images:service_images(id, service_id, image_url, alt_text, display_order, image_type, is_primary, created_at),
          created_at,
          updated_at
        `)
        .eq('is_available', true)
        .order('popularity_score', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching popular services', { error, limit });
        throw new Error('Failed to fetch popular services');
      }

      logger.info('Popular services retrieved successfully', {
        count: data?.length || 0,
        limit
      });

      return (data || []) as ServiceCatalogEntrySummary[];
    } catch (error) {
      logger.error('Error in getPopularServices', { error, limit });
      throw error;
    }
  }

  /**
   * Get trending services
   */
  async getTrendingServices(limit: number = 10): Promise<ServiceCatalogEntrySummary[]> {
    try {
      const { data, error } = await this.supabase
        .from('shop_services')
        .select(`
          id,
          shop_id,
          name,
          description,
          category,
          price_min,
          price_max,
          duration_minutes,
          service_level,
          difficulty_level,
          is_available,
          popularity_score,
          rating_average,
          rating_count,
          featured,
          trending,
          tags,
          images:service_images(id, service_id, image_url, alt_text, display_order, image_type, is_primary, created_at),
          created_at,
          updated_at
        `)
        .eq('is_available', true)
        .eq('trending', true)
        .order('popularity_score', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching trending services', { error, limit });
        throw new Error('Failed to fetch trending services');
      }

      logger.info('Trending services retrieved successfully', {
        count: data?.length || 0,
        limit
      });

      return (data || []) as ServiceCatalogEntrySummary[];
    } catch (error) {
      logger.error('Error in getTrendingServices', { error, limit });
      throw error;
    }
  }

  /**
   * Update service popularity score
   */
  async updateServicePopularity(serviceId: string, bookingCount: number, ratingAverage: number): Promise<void> {
    try {
      // Calculate popularity score based on booking count and rating
      const popularityScore = (bookingCount * 0.7) + (ratingAverage * 10 * 0.3);

      const { error } = await this.supabase
        .from('shop_services')
        .update({
          popularity_score: popularityScore,
          booking_count: bookingCount,
          rating_average: ratingAverage,
          updated_at: new Date().toISOString()
        })
        .eq('id', serviceId);

      if (error) {
        logger.error('Error updating service popularity', { error, serviceId, bookingCount, ratingAverage });
        throw new Error('Failed to update service popularity');
      }

      logger.info('Service popularity updated successfully', {
        serviceId,
        popularityScore,
        bookingCount,
        ratingAverage
      });
    } catch (error) {
      logger.error('Error in updateServicePopularity', { error, serviceId, bookingCount, ratingAverage });
      throw error;
    }
  }

  /**
   * Mark service as trending
   */
  async markServiceAsTrending(serviceId: string, isTrending: boolean = true): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('shop_services')
        .update({
          trending: isTrending,
          updated_at: new Date().toISOString()
        })
        .eq('id', serviceId);

      if (error) {
        logger.error('Error marking service as trending', { error, serviceId, isTrending });
        throw new Error('Failed to mark service as trending');
      }

      logger.info('Service trending status updated successfully', {
        serviceId,
        isTrending
      });
    } catch (error) {
      logger.error('Error in markServiceAsTrending', { error, serviceId, isTrending });
      throw error;
    }
  }

  /**
   * Get service catalog configuration
   */
  async getServiceCatalogConfig(): Promise<Record<string, any>> {
    try {
      // This would typically come from a configuration table
      // For now, return default configuration
      const config = {
        enable_advanced_search: true,
        enable_price_ranges: true,
        enable_seasonal_pricing: true,
        enable_service_requirements: true,
        enable_media_gallery: true,
        enable_before_after_images: true,
        enable_rating_system: true,
        enable_trending_services: true,
        max_images_per_service: 10,
        max_videos_per_service: 5,
        default_search_radius_km: 10,
        max_search_radius_km: 50,
        cache_duration_minutes: 15,
        featured_services_limit: 20,
        trending_services_limit: 10
      };

      logger.info('Service catalog configuration retrieved successfully');
      return config;
    } catch (error) {
      logger.error('Error in getServiceCatalogConfig', { error });
      throw error;
    }
  }
}

export const serviceCatalogService = new ServiceCatalogService();
