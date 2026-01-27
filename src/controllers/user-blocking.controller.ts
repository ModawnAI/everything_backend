/**
 * User Blocking Controller
 *
 * Handles HTTP requests for user blocking functionality.
 */

import { Response, NextFunction } from 'express';
import {
  userBlockingService,
  BlockReason,
  UserBlockingServiceError,
} from '../services/user-blocking.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/auth.types';

export class UserBlockingController {
  /**
   * Block a user
   * POST /api/users/block
   */
  async blockUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const blockerId = req.user?.id;
      logger.info('[UserBlocking] blockUser called', { blockerId, body: req.body });

      if (!blockerId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const { userId, reason, description } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: 'User ID to block is required',
          },
        });
      }

      const validReasons: BlockReason[] = [
        'spam',
        'harassment',
        'inappropriate_content',
        'fake_account',
        'other',
      ];

      if (reason && !validReasons.includes(reason)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REASON',
            message: `Invalid reason. Must be one of: ${validReasons.join(', ')}`,
          },
        });
      }

      const block = await userBlockingService.blockUser({
        blockerId,
        blockedUserId: userId,
        reason: reason || 'other',
        description,
      });

      return res.status(201).json({
        success: true,
        data: block,
        message: '사용자를 차단했습니다.',
      });
    } catch (error) {
      if (error instanceof UserBlockingServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      logger.error('Error blocking user', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }

  /**
   * Unblock a user
   * DELETE /api/users/block/:userId
   */
  async unblockUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const blockerId = req.user?.id;
      if (!blockerId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: 'User ID to unblock is required',
          },
        });
      }

      await userBlockingService.unblockUser(blockerId, userId);

      return res.status(200).json({
        success: true,
        message: '사용자 차단을 해제했습니다.',
      });
    } catch (error) {
      if (error instanceof UserBlockingServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      logger.error('Error unblocking user', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }

  /**
   * Get blocked users list
   * GET /api/users/blocked
   */
  async getBlockedUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await userBlockingService.getBlockedUsers(userId, page, limit);

      return res.status(200).json({
        success: true,
        data: result.blocks,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      if (error instanceof UserBlockingServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      logger.error('Error getting blocked users', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }

  /**
   * Check if a user is blocked
   * GET /api/users/block/check/:userId
   */
  async checkIsBlocked(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const blockerId = req.user?.id;
      if (!blockerId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: 'User ID to check is required',
          },
        });
      }

      const isBlocked = await userBlockingService.isUserBlocked(blockerId, userId);

      return res.status(200).json({
        success: true,
        data: { isBlocked },
      });
    } catch (error) {
      logger.error('Error checking if user is blocked', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }

  /**
   * Get blocked user IDs (for content filtering)
   * GET /api/users/blocked/ids
   */
  async getBlockedUserIds(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      logger.info('[UserBlocking] getBlockedUserIds called', { userId });

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const blockedIds = await userBlockingService.getBlockedUserIds(userId);
      logger.info('[UserBlocking] Returning blocked IDs', { userId, count: blockedIds.length, ids: blockedIds });

      return res.status(200).json({
        success: true,
        data: blockedIds,
      });
    } catch (error) {
      logger.error('Error getting blocked user IDs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }

  // ========== Admin Endpoints ==========

  /**
   * Get block notifications for admin review
   * GET /api/admin/blocks/notifications
   */
  async getBlockNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const onlyUnreviewed = req.query.unreviewed === 'true';

      const result = await userBlockingService.getBlockNotifications(
        page,
        limit,
        onlyUnreviewed
      );

      return res.status(200).json({
        success: true,
        data: result.notifications,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      if (error instanceof UserBlockingServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      logger.error('Error getting block notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }

  /**
   * Review a block notification
   * PATCH /api/admin/blocks/notifications/:id/review
   */
  async reviewBlockNotification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const { id } = req.params;
      const { notes } = req.body;

      await userBlockingService.reviewBlockNotification(id, adminId, notes);

      return res.status(200).json({
        success: true,
        message: '차단 알림을 검토 완료했습니다.',
      });
    } catch (error) {
      if (error instanceof UserBlockingServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      logger.error('Error reviewing block notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }

  /**
   * Get block statistics for admin dashboard
   * GET /api/admin/blocks/statistics
   */
  async getBlockStatistics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const statistics = await userBlockingService.getBlockStatistics();

      return res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error('Error getting block statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
}

export const userBlockingController = new UserBlockingController();
