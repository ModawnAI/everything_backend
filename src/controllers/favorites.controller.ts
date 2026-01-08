/**
 * User Favorites Controller
 * 
 * Handles all user favorites management endpoints including:
 * - Adding/removing shop favorites
 * - Retrieving user's favorite shops
 * - Favorites statistics and analytics
 * - Bulk favorites operations
 * - Real-time sync capabilities
 */

import { Request, Response, NextFunction } from 'express';
import {
  favoritesService,
  FavoriteShopRequest,
  BulkFavoritesRequest
} from '../services/favorites.service';
import { logger } from '../utils/logger';
import { BusinessLogicError, ValidationError } from '../middleware/error-handling.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Request interfaces
export interface AddFavoriteRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
  };
}

export interface RemoveFavoriteRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
  };
}

export interface ToggleFavoriteRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
  };
}

export interface GetFavoritesRequest extends AuthenticatedRequest {
  query: {
    limit?: string;
    offset?: string;
    category?: string;
    sortBy?: 'recent' | 'name' | 'bookings';
    includeShopData?: string;
  };
}

export interface GetFavoritesStatsRequest extends AuthenticatedRequest {}

export interface BulkFavoritesUpdateRequest extends AuthenticatedRequest {
  body: BulkFavoritesRequest & {
    action: 'add' | 'remove';
  };
}

export interface CheckFavoritesRequest extends AuthenticatedRequest {
  body: {
    shopIds: string[];
  };
}

export interface IsFavoriteRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
  };
}

export class FavoritesController {
  /**
   * POST /api/shops/:shopId/favorite
   * Add a shop to user's favorites
   */
  public addFavorite = async (req: AddFavoriteRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { shopId } = req.params;
      const userId = req.user.id;

      if (!shopId) {
        throw new ValidationError('Shop ID is required');
      }

      const result = await favoritesService.addFavorite(userId, shopId);

      if (!result.success) {
        throw new BusinessLogicError(result.message);
      }

      res.status(200).json({
        success: true,
        data: {
          isFavorite: result.isFavorite,
          favoriteId: result.favoriteId,
          message: result.message
        },
        message: 'Shop added to favorites successfully'
      });

    } catch (error) {
      logger.error('FavoritesController.addFavorite error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        shopId: req.params.shopId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * DELETE /api/shops/:shopId/favorite
   * Remove a shop from user's favorites
   */
  public removeFavorite = async (req: RemoveFavoriteRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { shopId } = req.params;
      const userId = req.user.id;

      if (!shopId) {
        throw new ValidationError('Shop ID is required');
      }

      const result = await favoritesService.removeFavorite(userId, shopId);

      if (!result.success) {
        throw new BusinessLogicError(result.message);
      }

      res.status(200).json({
        success: true,
        data: {
          isFavorite: result.isFavorite,
          message: result.message
        },
        message: 'Shop removed from favorites successfully'
      });

    } catch (error) {
      logger.error('FavoritesController.removeFavorite error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        shopId: req.params.shopId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * PUT /api/shops/:shopId/favorite
   * Toggle favorite status (add if not favorited, remove if favorited)
   */
  public toggleFavorite = async (req: ToggleFavoriteRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { shopId } = req.params;
      const userId = req.user.id;

      if (!shopId) {
        throw new ValidationError('Shop ID is required');
      }

      const result = await favoritesService.toggleFavorite(userId, shopId);

      if (!result.success) {
        throw new BusinessLogicError(result.message);
      }

      res.status(200).json({
        success: true,
        data: {
          isFavorite: result.isFavorite,
          favoriteId: result.favoriteId,
          message: result.message
        },
        message: `Shop ${result.isFavorite ? 'added to' : 'removed from'} favorites successfully`
      });

    } catch (error) {
      logger.error('FavoritesController.toggleFavorite error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        shopId: req.params.shopId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * GET /api/user/favorites
   * Get user's favorite shops
   */
  public getFavorites = async (req: GetFavoritesRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { limit, offset, category, sortBy, includeShopData } = req.query;

      const options = {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        category,
        sortBy: sortBy as 'recent' | 'name' | 'bookings' | undefined,
        includeShopData: includeShopData === 'true'
      };

      const result = await favoritesService.getUserFavorites(userId, options);

      if (!result.success) {
        throw new BusinessLogicError(result.message);
      }

      res.status(200).json({
        success: true,
        data: {
          favorites: result.favorites,
          totalCount: result.totalCount,
          pagination: {
            limit: options.limit || 50,
            offset: options.offset || 0,
            hasMore: (options.offset || 0) + result.favorites.length < result.totalCount
          }
        },
        message: 'Favorites retrieved successfully'
      });

    } catch (error) {
      logger.error('FavoritesController.getFavorites error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * GET /api/user/favorites/stats
   * Get user's favorites statistics
   */
  public getFavoritesStats = async (req: GetFavoritesStatsRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;

      const result = await favoritesService.getFavoritesStats(userId);

      if (!result.success) {
        throw new BusinessLogicError(result.message);
      }

      res.status(200).json({
        success: true,
        data: result.stats,
        message: 'Favorites statistics retrieved successfully'
      });

    } catch (error) {
      logger.error('FavoritesController.getFavoritesStats error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * POST /api/user/favorites/bulk
   * Bulk add/remove favorites
   */
  public bulkUpdateFavorites = async (req: BulkFavoritesUpdateRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { shopIds, action } = req.body;

      if (!shopIds || !Array.isArray(shopIds) || shopIds.length === 0) {
        throw new ValidationError('Shop IDs array is required');
      }

      if (!action || !['add', 'remove'].includes(action)) {
        throw new ValidationError('Action must be either "add" or "remove"');
      }

      if (shopIds.length > 100) {
        throw new ValidationError('Cannot process more than 100 shops at once');
      }

      const result = await favoritesService.bulkUpdateFavorites(userId, shopIds, action);

      if (!result.success) {
        throw new BusinessLogicError(result.message);
      }

      res.status(200).json({
        success: true,
        data: {
          added: result.added,
          removed: result.removed,
          failed: result.failed,
          summary: {
            total: shopIds.length,
            successful: result.added.length + result.removed.length,
            failed: result.failed.length
          }
        },
        message: `Bulk ${action} operation completed`
      });

    } catch (error) {
      logger.error('FavoritesController.bulkUpdateFavorites error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * POST /api/user/favorites/check
   * Check favorite status for multiple shops
   */
  public checkFavorites = async (req: CheckFavoritesRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { shopIds } = req.body;

      if (!shopIds || !Array.isArray(shopIds) || shopIds.length === 0) {
        throw new ValidationError('Shop IDs array is required');
      }

      if (shopIds.length > 100) {
        throw new ValidationError('Cannot check more than 100 shops at once');
      }

      const result = await favoritesService.checkMultipleFavorites(userId, shopIds);

      res.status(200).json({
        success: true,
        data: {
          favorites: result,
          summary: {
            total: shopIds.length,
            favorited: Object.values(result).filter(Boolean).length,
            notFavorited: Object.values(result).filter(fav => !fav).length
          }
        },
        message: 'Favorites status checked successfully'
      });

    } catch (error) {
      logger.error('FavoritesController.checkFavorites error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * GET /api/shops/:shopId/favorite/status
   * Check if a specific shop is favorited
   */
  public isFavorite = async (req: IsFavoriteRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { shopId } = req.params;
      const userId = req.user.id;

      if (!shopId) {
        throw new ValidationError('Shop ID is required');
      }

      const isFavorited = await favoritesService.isFavorite(userId, shopId);

      res.status(200).json({
        success: true,
        data: {
          shopId,
          isFavorite: isFavorited
        },
        message: 'Favorite status checked successfully'
      });

    } catch (error) {
      logger.error('FavoritesController.isFavorite error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        shopId: req.params.shopId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * GET /api/user/favorites/ids
   * Get lightweight list of favorite shop IDs for fast sync
   */
  public getFavoriteIds = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;

      const result = await favoritesService.getFavoriteIds(userId);

      if (!result.success) {
        throw new BusinessLogicError(result.message || 'Failed to retrieve favorite IDs');
      }

      res.status(200).json({
        success: true,
        data: {
          favoriteIds: result.favoriteIds,
          count: result.count,
          timestamp: new Date().toISOString()
        },
        message: 'Favorite IDs retrieved successfully'
      });

    } catch (error) {
      logger.error('FavoritesController.getFavoriteIds error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * POST /api/user/favorites/batch
   * Batch toggle multiple favorites (for offline sync)
   */
  public batchToggleFavorites = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { add = [], remove = [] } = req.body;

      // Validate input
      if (!Array.isArray(add) || !Array.isArray(remove)) {
        throw new ValidationError('add and remove must be arrays');
      }

      if (add.length === 0 && remove.length === 0) {
        throw new ValidationError('At least one shop ID must be provided in add or remove');
      }

      // Validate max batch size
      const maxBatchSize = 50;
      if (add.length + remove.length > maxBatchSize) {
        throw new ValidationError(`Batch size cannot exceed ${maxBatchSize} operations`);
      }

      const result = await favoritesService.batchToggleFavorites(userId, add, remove);

      if (!result.success) {
        throw new BusinessLogicError(result.message || 'Failed to batch toggle favorites');
      }

      res.status(200).json({
        success: true,
        data: {
          added: result.added,
          removed: result.removed,
          failed: result.failed,
          favoriteIds: result.favoriteIds,
          count: result.count
        },
        message: 'Batch toggle completed successfully'
      });

    } catch (error) {
      logger.error('FavoritesController.batchToggleFavorites error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        addCount: req.body.add?.length || 0,
        removeCount: req.body.remove?.length || 0,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next(error);
    }
  };
}

export const favoritesController = new FavoritesController();
