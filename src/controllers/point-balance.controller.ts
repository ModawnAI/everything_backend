import { Request, Response } from 'express';
import { pointBalanceService } from '../services/point-balance.service';
import { logger } from '../utils/logger';
import { PointTransactionType, PointStatus } from '../types/database.types';

// Valid values for validation
const VALID_TRANSACTION_TYPES: PointTransactionType[] = [
  'earned_service',
  'earned_referral', 
  'used_service',
  'expired',
  'adjusted',
  'influencer_bonus'
];

const VALID_POINT_STATUSES: PointStatus[] = [
  'pending',
  'available',
  'used',
  'expired'
];

export class PointBalanceController {
  /**
   * GET /api/users/:userId/points/balance
   * Get current point balance for a user
   */
  async getPointBalance(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const balance = await pointBalanceService.getPointBalance(userId);

      res.json({
        success: true,
        data: balance
      });
    } catch (error) {
      logger.error('Error getting point balance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get point balance'
      });
    }
  }

  /**
   * GET /api/users/:userId/points/history
   * Get point transaction history with filtering and pagination
   */
  async getPointHistory(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const {
        startDate,
        endDate,
        transactionType,
        status,
        page = '1',
        limit = '20'
      } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      // Validate transaction type if provided
      if (transactionType && !VALID_TRANSACTION_TYPES.includes(transactionType as PointTransactionType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid transaction type'
        });
        return;
      }

      // Validate status if provided
      if (status && !VALID_POINT_STATUSES.includes(status as PointStatus)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
        return;
      }

      const filters = {
        startDate: startDate as string,
        endDate: endDate as string,
        transactionType: transactionType as PointTransactionType,
        status: status as PointStatus,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const history = await pointBalanceService.getPointHistory(userId, filters);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Error getting point history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get point history'
      });
    }
  }

  /**
   * GET /api/users/:userId/points/analytics
   * Get point analytics and insights
   */
  async getPointAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { months = '12' } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const monthsNumber = parseInt(months as string, 10);
      if (isNaN(monthsNumber) || monthsNumber < 1 || monthsNumber > 60) {
        res.status(400).json({
          success: false,
          error: 'Months must be a number between 1 and 60'
        });
        return;
      }

      const analytics = await pointBalanceService.getPointAnalytics(userId, monthsNumber);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting point analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get point analytics'
      });
    }
  }

  /**
   * GET /api/users/:userId/points/projection
   * Get point projection showing future available points
   */
  async getPointProjection(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { days = '90' } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const daysNumber = parseInt(days as string, 10);
      if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 365) {
        res.status(400).json({
          success: false,
          error: 'Days must be a number between 1 and 365'
        });
        return;
      }

      const projection = await pointBalanceService.getPointProjection(userId, daysNumber);

      res.json({
        success: true,
        data: projection
      });
    } catch (error) {
      logger.error('Error getting point projection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get point projection'
      });
    }
  }

  /**
   * GET /api/users/:userId/points/summary
   * Get comprehensive point summary including balance, analytics, and projection
   */
  async getPointSummary(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const summary = await pointBalanceService.getPointSummary(userId);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting point summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get point summary'
      });
    }
  }
}

export const pointBalanceController = new PointBalanceController(); 