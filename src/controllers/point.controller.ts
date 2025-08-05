/**
 * Point Controller
 * 
 * Handles point-related API endpoints including:
 * - Point balance retrieval
 * - Transaction history
 * - Point earning and usage
 * - Admin point adjustments
 */

import { Request, Response } from 'express';
import { pointTransactionService, CreatePointTransactionRequest } from '../services/point-transaction.service';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class PointController {
  private supabase = getSupabaseClient();

  /**
   * GET /api/users/:userId/points/balance
   * Get user's point balance
   */
  async getUserPointBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user?.id;

      // Validate userId parameter
      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: '사용자 ID가 필요합니다.',
            details: 'URL에 사용자 ID를 포함해야 합니다.'
          }
        });
        return;
      }

      // Validate user access
      if (authenticatedUserId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '접근 권한이 없습니다.',
            details: '자신의 포인트 정보만 조회할 수 있습니다.'
          }
        });
        return;
      }

      const balance = await pointTransactionService.getUserPointBalance(userId);

      logger.info('User point balance retrieved', {
        userId,
        availableBalance: balance.availableBalance,
        pendingBalance: balance.pendingBalance
      });

      res.status(200).json({
        success: true,
        data: balance
      });

    } catch (error) {
      logger.error('Error getting user point balance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'POINT_BALANCE_RETRIEVAL_FAILED',
          message: '포인트 잔액 조회에 실패했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * GET /api/users/:userId/points/history
   * Get user's point transaction history
   */
  async getUserTransactionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const transactionType = req.query.transactionType as string;
      const status = req.query.status as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      // Validate userId parameter
      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: '사용자 ID가 필요합니다.',
            details: 'URL에 사용자 ID를 포함해야 합니다.'
          }
        });
        return;
      }

      // Validate user access
      if (authenticatedUserId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '접근 권한이 없습니다.',
            details: '자신의 포인트 내역만 조회할 수 있습니다.'
          }
        });
        return;
      }

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAGINATION',
            message: '잘못된 페이지네이션 파라미터입니다.',
            details: '페이지는 1 이상, 한도는 1-100 사이여야 합니다.'
          }
        });
        return;
      }

      const filters = {
        ...(transactionType && { transactionType: transactionType as any }),
        ...(status && { status: status as any }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      };

      const history = await pointTransactionService.getUserTransactionHistory(
        userId,
        page,
        limit,
        filters
      );

      logger.info('User transaction history retrieved', {
        userId,
        transactionCount: history.transactions.length,
        totalCount: history.totalCount
      });

      res.status(200).json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Error getting user transaction history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'TRANSACTION_HISTORY_RETRIEVAL_FAILED',
          message: '포인트 내역 조회에 실패했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * POST /api/points/earn
   * Create point earning transaction (system use)
   */
  async earnPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        userId,
        transactionType,
        amount,
        description,
        reservationId,
        relatedUserId,
        metadata
      } = req.body;

      // Validate required fields
      if (!userId || !transactionType || !amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'userId, transactionType, amount는 필수입니다.'
          }
        });
        return;
      }

      // Validate amount
      if (amount <= 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: '유효하지 않은 포인트 금액입니다.',
            details: '적립 포인트는 0보다 커야 합니다.'
          }
        });
        return;
      }

      // Validate transaction type for earning
      const earningTypes = ['earned_service', 'earned_referral', 'influencer_bonus'];
      if (!earningTypes.includes(transactionType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TRANSACTION_TYPE',
            message: '유효하지 않은 거래 유형입니다.',
            details: '적립 거래 유형만 사용할 수 있습니다.'
          }
        });
        return;
      }

      const request: CreatePointTransactionRequest = {
        userId,
        transactionType,
        amount,
        description,
        reservationId,
        relatedUserId,
        metadata
      };

      const transaction = await pointTransactionService.createTransaction(request);

      logger.info('Points earned successfully', {
        userId,
        transactionId: transaction.id,
        amount: transaction.amount,
        type: transaction.transactionType
      });

      res.status(201).json({
        success: true,
        data: transaction,
        message: '포인트가 성공적으로 적립되었습니다.'
      });

    } catch (error) {
      logger.error('Error earning points', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'POINT_EARNING_FAILED',
          message: '포인트 적립에 실패했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * POST /api/points/use
   * Create point usage transaction
   */
  async usePoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { amount, reservationId, description } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      // Validate required fields
      if (!amount || !reservationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'amount와 reservationId는 필수입니다.'
          }
        });
        return;
      }

      // Validate amount
      if (amount <= 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: '유효하지 않은 포인트 금액입니다.',
            details: '사용 포인트는 0보다 커야 합니다.'
          }
        });
        return;
      }

      // Check if user has enough available points
      const balance = await pointTransactionService.getUserPointBalance(userId);
      if (balance.availableBalance < amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_POINTS',
            message: '사용 가능한 포인트가 부족합니다.',
            details: `사용 가능한 포인트: ${balance.availableBalance}원, 요청한 포인트: ${amount}원`
          }
        });
        return;
      }

      // Validate reservation ownership
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('id, user_id')
        .eq('id', reservationId)
        .eq('user_id', userId)
        .single();

      if (reservationError || !reservation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESERVATION_NOT_FOUND',
            message: '예약을 찾을 수 없습니다.',
            details: '해당 예약이 존재하지 않거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      const request: CreatePointTransactionRequest = {
        userId,
        transactionType: 'used_service',
        amount: -amount, // Negative amount for usage
        description: description || '서비스 결제 사용',
        reservationId,
        metadata: {
          source: 'user_request',
          requestedAt: new Date().toISOString()
        }
      };

      const transaction = await pointTransactionService.createTransaction(request);

      logger.info('Points used successfully', {
        userId,
        transactionId: transaction.id,
        amount: Math.abs(transaction.amount),
        reservationId
      });

      res.status(201).json({
        success: true,
        data: transaction,
        message: '포인트가 성공적으로 사용되었습니다.'
      });

    } catch (error) {
      logger.error('Error using points', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'POINT_USAGE_FAILED',
          message: '포인트 사용에 실패했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * POST /api/admin/points/adjust
   * Admin point adjustment (admin only)
   */
  async adjustPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId, amount, reason, type } = req.body;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      // Check admin permissions
      const { data: admin, error: adminError } = await this.supabase
        .from('users')
        .select('user_role')
        .eq('id', adminId)
        .single();

      if (adminError || !admin || admin.user_role !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '관리자 권한이 필요합니다.',
            details: '포인트 조정은 관리자만 가능합니다.'
          }
        });
        return;
      }

      // Validate required fields
      if (!userId || !amount || !reason || !type) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'userId, amount, reason, type는 필수입니다.'
          }
        });
        return;
      }

      // Validate amount
      if (amount <= 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: '유효하지 않은 포인트 금액입니다.',
            details: '조정 포인트는 0보다 커야 합니다.'
          }
        });
        return;
      }

      // Validate adjustment type
      if (!['add', 'subtract'].includes(type)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ADJUSTMENT_TYPE',
            message: '유효하지 않은 조정 유형입니다.',
            details: '조정 유형은 add 또는 subtract여야 합니다.'
          }
        });
        return;
      }

      // Check if user exists
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '사용자를 찾을 수 없습니다.',
            details: '해당 사용자가 존재하지 않습니다.'
          }
        });
        return;
      }

      // Get current balance
      const currentBalance = await pointTransactionService.getUserPointBalance(userId);

      // Calculate adjustment amount
      const adjustmentAmount = type === 'add' ? amount : -amount;

      const request: CreatePointTransactionRequest = {
        userId,
        transactionType: 'adjusted',
        amount: adjustmentAmount,
        description: `${type === 'add' ? '포인트 추가' : '포인트 차감'}: ${reason}`,
        metadata: {
          source: 'admin_adjustment',
          adjustedBy: adminId,
          reason,
          type,
          previousBalance: currentBalance.availableBalance,
          newBalance: currentBalance.availableBalance + adjustmentAmount
        }
      };

      const transaction = await pointTransactionService.createTransaction(request);

      logger.info('Points adjusted by admin', {
        adminId,
        userId,
        transactionId: transaction.id,
        amount: Math.abs(transaction.amount),
        type,
        reason
      });

      res.status(201).json({
        success: true,
        data: {
          transaction,
          adjustment: {
            id: transaction.id,
            userId,
            amount: Math.abs(transaction.amount),
            type,
            reason,
            previousBalance: currentBalance.availableBalance,
            newBalance: currentBalance.availableBalance + adjustmentAmount,
            adjustedBy: adminId,
            createdAt: transaction.createdAt
          }
        },
        message: '포인트가 성공적으로 조정되었습니다.'
      });

    } catch (error) {
      logger.error('Error adjusting points', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'POINT_ADJUSTMENT_FAILED',
          message: '포인트 조정에 실패했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        }
      });
    }
  }
} 