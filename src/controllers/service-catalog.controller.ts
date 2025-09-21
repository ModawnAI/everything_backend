/**
 * Service Catalog Controller
 * 
 * Handles enhanced service catalog operations including:
 * - Service catalog entry management
 * - Advanced search and filtering
 * - Service type metadata management
 * - Popularity and trending calculations
 * - Service statistics and analytics
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { serviceCatalogService } from '../services/service-catalog.service';
import {
  ServiceCatalogSearchRequest,
  CreateServiceCatalogEntryRequest,
  UpdateServiceCatalogEntryRequest,
  ServiceCatalogFilter
} from '../types/service-catalog.types';
import { ServiceCategory } from '../types/database.types';

// Request interfaces
interface ServiceCatalogSearchRequestInterface extends Request {
  query: {
    q?: string;
    category?: ServiceCategory;
    price_min?: string;
    price_max?: string;
    duration_min?: string;
    duration_max?: string;
    service_level?: string;
    difficulty_level?: string;
    featured_only?: string;
    trending_only?: string;
    min_rating?: string;
    tags?: string;
    page?: string;
    limit?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    include_unavailable?: string;
  };
}

interface ServiceCatalogEntryRequest extends Request {
  params: {
    serviceId: string;
  };
}

interface CreateServiceCatalogEntryRequestInterface extends Request {
  body: CreateServiceCatalogEntryRequest;
}

interface UpdateServiceCatalogEntryRequestInterface extends Request {
  params: {
    serviceId: string;
  };
  body: UpdateServiceCatalogEntryRequest;
}

class ServiceCatalogController {
  /**
   * Get all service catalog entries with optional filtering
   */
  async getServiceCatalogEntries(req: ServiceCatalogSearchRequestInterface, res: Response): Promise<void> {
    try {
      const {
        category,
        service_level,
        difficulty_level,
        featured_only,
        trending_only,
        limit = '50',
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      const options = {
        category: category as ServiceCategory,
        service_level: service_level as 'basic' | 'premium' | 'luxury' | undefined,
        difficulty_level: difficulty_level as 'beginner' | 'intermediate' | 'advanced' | undefined,
        is_available: req.query.include_unavailable !== 'true',
        featured_only: featured_only === 'true',
        trending_only: trending_only === 'true',
        limit: parseInt(limit),
        offset: 0,
        sort_by,
        sort_order: sort_order as 'asc' | 'desc'
      };

      logger.info('Getting service catalog entries', { options });

      const services = await serviceCatalogService.getServiceCatalogEntries(options);

      logger.info('Service catalog entries retrieved successfully', {
        count: services.length,
        options
      });

      res.status(200).json({
        success: true,
        data: {
          services,
          total: services.length,
          metadata: {
            ...options,
            has_more: services.length === options.limit
          }
        }
      });

    } catch (error) {
      logger.error('Error getting service catalog entries', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service catalog entries',
        message: 'An error occurred while fetching service catalog entries'
      });
    }
  }

  /**
   * Get a specific service catalog entry by ID
   */
  async getServiceCatalogEntryById(req: ServiceCatalogEntryRequest, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;

      logger.info('Getting service catalog entry', { serviceId });

      const service = await serviceCatalogService.getServiceCatalogEntryById(serviceId);

      if (!service) {
        res.status(404).json({
          success: false,
          error: 'Service not found',
          message: `Service with ID '${serviceId}' does not exist`
        });
        return;
      }

      logger.info('Service catalog entry retrieved successfully', { serviceId });

      res.status(200).json({
        success: true,
        data: {
          service
        }
      });

    } catch (error) {
      logger.error('Error getting service catalog entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceId: req.params.serviceId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service catalog entry',
        message: 'An error occurred while fetching service catalog entry'
      });
    }
  }

  /**
   * Search service catalog entries with advanced filtering
   */
  async searchServiceCatalog(req: ServiceCatalogSearchRequestInterface, res: Response): Promise<void> {
    try {
      const {
        q: query,
        category,
        price_min,
        price_max,
        duration_min,
        duration_max,
        service_level,
        difficulty_level,
        featured_only,
        trending_only,
        min_rating,
        tags,
        page = '1',
        limit = '20',
        sort_by = 'popularity_score',
        sort_order = 'desc',
        include_unavailable = 'false'
      } = req.query;

      const filters: ServiceCatalogFilter = {};

      if (category) {
        filters.categories = [category as ServiceCategory];
      }

      if (price_min || price_max) {
        filters.price_range = {
          min: price_min ? parseInt(price_min) : undefined,
          max: price_max ? parseInt(price_max) : undefined
        };
      }

      if (duration_min || duration_max) {
        filters.duration_range = {
          min: duration_min ? parseInt(duration_min) : undefined,
          max: duration_max ? parseInt(duration_max) : undefined
        };
      }

      if (service_level) {
        filters.service_levels = [service_level as 'basic' | 'premium' | 'luxury'];
      }

      if (difficulty_level) {
        filters.difficulty_levels = [difficulty_level as 'beginner' | 'intermediate' | 'advanced'];
      }

      if (featured_only === 'true') {
        filters.featured_only = true;
      }

      if (trending_only === 'true') {
        filters.trending_only = true;
      }

      if (min_rating) {
        filters.min_rating = parseFloat(min_rating);
      }

      if (tags) {
        filters.tags = tags.split(',').map(tag => tag.trim());
      }

      const searchRequest: ServiceCatalogSearchRequest = {
        query,
        filters,
        page: parseInt(page),
        limit: parseInt(limit),
        sort_by: sort_by as any,
        sort_order: sort_order as 'asc' | 'desc',
        include_unavailable: include_unavailable === 'true'
      };

      logger.info('Searching service catalog', { searchRequest });

      const result = await serviceCatalogService.searchServiceCatalog(searchRequest);

      logger.info('Service catalog search completed', {
        query,
        result_count: result.services.length,
        total_count: result.total_count,
        page: result.page,
        limit: result.limit
      });

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error searching service catalog', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to search service catalog',
        message: 'An error occurred while searching service catalog'
      });
    }
  }

  /**
   * Get service catalog statistics
   */
  async getServiceCatalogStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting service catalog statistics');

      const stats = await serviceCatalogService.getServiceCatalogStats();

      logger.info('Service catalog statistics retrieved successfully');

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting service catalog statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service catalog statistics',
        message: 'An error occurred while fetching service catalog statistics'
      });
    }
  }

  /**
   * Get service type metadata
   */
  async getServiceTypeMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.query;

      logger.info('Getting service type metadata', { category });

      const metadata = await serviceCatalogService.getServiceTypeMetadata(category as ServiceCategory);

      logger.info('Service type metadata retrieved successfully', {
        count: metadata.length,
        category
      });

      res.status(200).json({
        success: true,
        data: {
          metadata,
          total: metadata.length,
          category: category || 'all'
        }
      });

    } catch (error) {
      logger.error('Error getting service type metadata', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category: req.query.category
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service type metadata',
        message: 'An error occurred while fetching service type metadata'
      });
    }
  }

  /**
   * Get popular services
   */
  async getPopularServices(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      logger.info('Getting popular services', { limit });

      const services = await serviceCatalogService.getPopularServices(limit);

      logger.info('Popular services retrieved successfully', {
        count: services.length,
        limit
      });

      res.status(200).json({
        success: true,
        data: {
          services,
          total: services.length,
          limit
        }
      });

    } catch (error) {
      logger.error('Error getting popular services', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve popular services',
        message: 'An error occurred while fetching popular services'
      });
    }
  }

  /**
   * Get trending services
   */
  async getTrendingServices(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      logger.info('Getting trending services', { limit });

      const services = await serviceCatalogService.getTrendingServices(limit);

      logger.info('Trending services retrieved successfully', {
        count: services.length,
        limit
      });

      res.status(200).json({
        success: true,
        data: {
          services,
          total: services.length,
          limit
        }
      });

    } catch (error) {
      logger.error('Error getting trending services', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve trending services',
        message: 'An error occurred while fetching trending services'
      });
    }
  }

  /**
   * Get service catalog configuration
   */
  async getServiceCatalogConfig(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting service catalog configuration');

      const config = await serviceCatalogService.getServiceCatalogConfig();

      logger.info('Service catalog configuration retrieved successfully');

      res.status(200).json({
        success: true,
        data: config
      });

    } catch (error) {
      logger.error('Error getting service catalog configuration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service catalog configuration',
        message: 'An error occurred while fetching service catalog configuration'
      });
    }
  }

  /**
   * Update service popularity (internal use)
   */
  async updateServicePopularity(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;
      const { bookingCount, ratingAverage } = req.body;

      if (!serviceId || bookingCount === undefined || ratingAverage === undefined) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          message: 'serviceId, bookingCount, and ratingAverage are required'
        });
        return;
      }

      logger.info('Updating service popularity', { serviceId, bookingCount, ratingAverage });

      await serviceCatalogService.updateServicePopularity(serviceId, bookingCount, ratingAverage);

      logger.info('Service popularity updated successfully', { serviceId });

      res.status(200).json({
        success: true,
        message: 'Service popularity updated successfully'
      });

    } catch (error) {
      logger.error('Error updating service popularity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceId: req.params.serviceId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update service popularity',
        message: 'An error occurred while updating service popularity'
      });
    }
  }

  /**
   * Mark service as trending (internal use)
   */
  async markServiceAsTrending(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;
      const { isTrending = true } = req.body;

      logger.info('Marking service as trending', { serviceId, isTrending });

      await serviceCatalogService.markServiceAsTrending(serviceId, isTrending);

      logger.info('Service trending status updated successfully', { serviceId, isTrending });

      res.status(200).json({
        success: true,
        message: 'Service trending status updated successfully'
      });

    } catch (error) {
      logger.error('Error marking service as trending', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceId: req.params.serviceId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to mark service as trending',
        message: 'An error occurred while marking service as trending'
      });
    }
  }
}

export const serviceCatalogController = new ServiceCatalogController();
