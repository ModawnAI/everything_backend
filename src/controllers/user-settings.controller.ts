/**
 * User Settings Controller
 * 
 * Comprehensive user settings management including preferences, notifications, 
 * privacy controls, and real-time synchronization
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { userSettingsService } from '../services/user-settings.service';
import { logger } from '../utils/logger';
import { websocketService } from '../services/websocket.service';

export class UserSettingsController {
  private wsService = websocketService;

  /**
   * GET /api/user/settings
   * Get comprehensive user settings
   */
  public getSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const settings = await userSettingsService.getUserSettings(userId);

      res.status(200).json({
        success: true,
        data: {
          settings,
          message: '사용자 설정을 성공적으로 조회했습니다.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('UserSettingsController.getSettings error:', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });
      next(error);
    }
  };

  /**
   * PUT /api/user/settings
   * Update user settings with real-time synchronization
   */
  public updateSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const updates = req.body;
      const updatedSettings = await userSettingsService.updateUserSettings(userId, updates);

      // Send real-time update to user's connected devices
      try {
        await this.wsService.sendToUser(userId, 'settings_updated', {
          settings: updatedSettings,
          updatedAt: new Date().toISOString()
        });
      } catch (wsError) {
        logger.warn('Failed to send WebSocket update for settings change', {
          userId,
          error: wsError instanceof Error ? wsError.message : 'Unknown error'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          settings: updatedSettings,
          message: '사용자 설정이 성공적으로 업데이트되었습니다.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('UserSettingsController.updateSettings error:', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });
      next(error);
    }
  };

  /**
   * GET /api/user/settings/defaults
   * Get default settings for new users
   */
  public getDefaultSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const defaultSettings = userSettingsService.getDefaultSettings();

      res.status(200).json({
        success: true,
        data: {
          settings: defaultSettings,
          message: '기본 설정을 조회했습니다.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('UserSettingsController.getDefaultSettings error:', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      next(error);
    }
  };

  /**
   * POST /api/user/settings/reset
   * Reset user settings to defaults
   */
  public resetSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const resetSettings = await userSettingsService.resetUserSettings(userId);

      // Send real-time update to user's connected devices
      try {
        await this.wsService.sendToUser(userId, 'settings_reset', {
          settings: resetSettings,
          resetAt: new Date().toISOString()
        });
      } catch (wsError) {
        logger.warn('Failed to send WebSocket update for settings reset', {
          userId,
          error: wsError instanceof Error ? wsError.message : 'Unknown error'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          settings: resetSettings,
          message: '사용자 설정이 기본값으로 초기화되었습니다.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('UserSettingsController.resetSettings error:', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });
      next(error);
    }
  };

  /**
   * GET /api/user/settings/categories
   * Get available settings categories and their options
   */
  public getSettingsCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = userSettingsService.getSettingsCategories();

      res.status(200).json({
        success: true,
        data: {
          categories,
          message: '설정 카테고리를 조회했습니다.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('UserSettingsController.getSettingsCategories error:', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      next(error);
    }
  };

  /**
   * GET /api/user/settings/validation-rules
   * Get validation rules for settings
   */
  public getValidationRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validationRules = userSettingsService.getValidationRules();

      res.status(200).json({
        success: true,
        data: {
          validationRules,
          message: '설정 유효성 검사 규칙을 조회했습니다.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('UserSettingsController.getValidationRules error:', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      next(error);
    }
  };

  /**
   * POST /api/user/settings/bulk-update
   * Update multiple settings at once
   */
  public bulkUpdateSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { settings } = req.body;
      const updatedSettings = await userSettingsService.bulkUpdateSettings(userId, settings);

      // Send real-time update to user's connected devices
      try {
        await this.wsService.sendToUser(userId, 'settings_bulk_updated', {
          settings: updatedSettings,
          updatedAt: new Date().toISOString()
        });
      } catch (wsError) {
        logger.warn('Failed to send WebSocket update for bulk settings change', {
          userId,
          error: wsError instanceof Error ? wsError.message : 'Unknown error'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          settings: updatedSettings,
          message: '사용자 설정이 일괄 업데이트되었습니다.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('UserSettingsController.bulkUpdateSettings error:', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });
      next(error);
    }
  };

  /**
   * GET /api/user/settings/history
   * Get settings change history
   */
  public getSettingsHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { limit = 50, offset = 0 } = req.query;
      const history = await userSettingsService.getSettingsHistory(
        userId, 
        parseInt(limit as string), 
        parseInt(offset as string)
      );

      res.status(200).json({
        success: true,
        data: {
          history,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: history.length
          },
          message: '설정 변경 이력을 조회했습니다.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('UserSettingsController.getSettingsHistory error:', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });
      next(error);
    }
  };
}

// Export singleton instance
export const userSettingsController = new UserSettingsController();
export default userSettingsController;
