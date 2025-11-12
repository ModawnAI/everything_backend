/**
 * User Payment Methods Controller
 *
 * Handles HTTP requests for user payment method management:
 * - Register new payment methods (billing keys)
 * - List saved payment methods
 * - Update payment method settings
 * - Delete payment methods
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { userPaymentMethodsService } from '../services/user-payment-methods.service';
import { logger } from '../utils/logger';

export class UserPaymentMethodsController {
  /**
   * POST /api/user/payment-methods
   * Register a new payment method (save billing key from PortOne)
   *
   * Request body:
   * {
   *   billingKey: string,      // From PortOne.requestIssueBillingKey()
   *   nickname?: string,       // Optional custom name
   *   setAsDefault?: boolean   // Set as default payment method
   * }
   */
  async registerPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { billingKey, nickname, setAsDefault } = req.body;

      // Validate required fields
      if (!billingKey || typeof billingKey !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_BILLING_KEY',
            message: '빌링키가 필요합니다.',
            details: 'PortOne에서 발급받은 billingKey를 전달해주세요.',
          },
        });
        return;
      }

      // Validate billing key format (basic check)
      if (billingKey.length < 10) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_BILLING_KEY',
            message: '유효하지 않은 빌링키 형식입니다.',
          },
        });
        return;
      }

      // Register payment method
      const paymentMethod = await userPaymentMethodsService.registerPaymentMethod({
        userId,
        billingKey,
        nickname,
        setAsDefault: setAsDefault || false,
      });

      logger.info('Payment method registered via API', {
        userId,
        paymentMethodId: paymentMethod.id,
        isDefault: paymentMethod.isDefault,
      });

      res.status(201).json({
        success: true,
        data: {
          paymentMethod: {
            id: paymentMethod.id,
            nickname: paymentMethod.nickname,
            cardCompany: paymentMethod.cardCompany,
            cardType: paymentMethod.cardType,
            cardNumberMasked: paymentMethod.cardNumberMasked,
            cardNumberLast4: paymentMethod.cardNumberLast4,
            isDefault: paymentMethod.isDefault,
            issuedAt: paymentMethod.issuedAt,
            expiresAt: paymentMethod.expiresAt,
            createdAt: paymentMethod.createdAt,
          },
        },
        message: '결제 수단이 성공적으로 등록되었습니다.',
      });

    } catch (error) {
      logger.error('Error in registerPaymentMethod controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        body: req.body,
      });

      const errorMessage = error instanceof Error ? error.message : '결제 수단 등록에 실패했습니다.';

      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_METHOD_REGISTRATION_FAILED',
          message: errorMessage,
        },
      });
    }
  }

  /**
   * GET /api/user/payment-methods
   * Get all saved payment methods for the authenticated user
   */
  async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const paymentMethods = await userPaymentMethodsService.getUserPaymentMethods(userId);

      logger.info('Payment methods fetched', {
        userId,
        count: paymentMethods.length,
      });

      res.status(200).json({
        success: true,
        data: {
          paymentMethods: paymentMethods.map(pm => ({
            id: pm.id,
            nickname: pm.nickname,
            paymentMethodType: pm.paymentMethodType,
            cardCompany: pm.cardCompany,
            cardType: pm.cardType,
            cardNumberMasked: pm.cardNumberMasked,
            cardNumberLast4: pm.cardNumberLast4,
            cardBrand: pm.cardBrand,
            isDefault: pm.isDefault,
            isActive: pm.isActive,
            lastUsedAt: pm.lastUsedAt,
            usageCount: pm.usageCount,
            expiresAt: pm.expiresAt,
            createdAt: pm.createdAt,
            // DO NOT expose billing_key to frontend for security
          })),
        },
      });

    } catch (error) {
      logger.error('Error in getPaymentMethods controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_PAYMENT_METHODS_FAILED',
          message: '결제 수단 조회에 실패했습니다.',
        },
      });
    }
  }

  /**
   * PATCH /api/user/payment-methods/:id/default
   * Set a payment method as the default
   */
  async setDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PAYMENT_METHOD_ID',
            message: '결제 수단 ID가 필요합니다.',
          },
        });
        return;
      }

      const paymentMethod = await userPaymentMethodsService.setDefaultPaymentMethod(id, userId);

      logger.info('Default payment method set via API', {
        userId,
        paymentMethodId: id,
      });

      res.status(200).json({
        success: true,
        data: {
          paymentMethod: {
            id: paymentMethod.id,
            nickname: paymentMethod.nickname,
            isDefault: paymentMethod.isDefault,
          },
        },
        message: '기본 결제 수단이 변경되었습니다.',
      });

    } catch (error) {
      logger.error('Error in setDefaultPaymentMethod controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        paymentMethodId: req.params.id,
      });

      const statusCode = error instanceof Error && error.message.includes('찾을 수 없습니다') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        error: {
          code: 'SET_DEFAULT_FAILED',
          message: error instanceof Error ? error.message : '기본 결제 수단 설정에 실패했습니다.',
        },
      });
    }
  }

  /**
   * DELETE /api/user/payment-methods/:id
   * Delete a payment method (soft delete)
   *
   * Query params:
   * - deleteFromPortOne: boolean (default: true) - Also delete from PortOne
   */
  async deletePaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { deleteFromPortOne = 'true' } = req.query;

      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PAYMENT_METHOD_ID',
            message: '결제 수단 ID가 필요합니다.',
          },
        });
        return;
      }

      const shouldDeleteFromPortOne = deleteFromPortOne === 'true' || deleteFromPortOne === true;

      await userPaymentMethodsService.deletePaymentMethod(id, userId, shouldDeleteFromPortOne);

      logger.info('Payment method deleted via API', {
        userId,
        paymentMethodId: id,
        deletedFromPortOne: shouldDeleteFromPortOne,
      });

      res.status(200).json({
        success: true,
        message: '결제 수단이 삭제되었습니다.',
      });

    } catch (error) {
      logger.error('Error in deletePaymentMethod controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        paymentMethodId: req.params.id,
      });

      const statusCode = error instanceof Error && error.message.includes('찾을 수 없습니다') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        error: {
          code: 'DELETE_PAYMENT_METHOD_FAILED',
          message: error instanceof Error ? error.message : '결제 수단 삭제에 실패했습니다.',
        },
      });
    }
  }

  /**
   * PATCH /api/user/payment-methods/:id/nickname
   * Update payment method nickname
   */
  async updateNickname(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { nickname } = req.body;

      if (!id || !nickname) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '결제 수단 ID와 별칭이 필요합니다.',
          },
        });
        return;
      }

      if (nickname.length > 50) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NICKNAME_TOO_LONG',
            message: '별칭은 50자 이내로 입력해주세요.',
          },
        });
        return;
      }

      const paymentMethod = await userPaymentMethodsService.updatePaymentMethodNickname(id, userId, nickname);

      res.status(200).json({
        success: true,
        data: {
          paymentMethod: {
            id: paymentMethod.id,
            nickname: paymentMethod.nickname,
          },
        },
        message: '결제 수단 별칭이 변경되었습니다.',
      });

    } catch (error) {
      logger.error('Error in updateNickname controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        paymentMethodId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_NICKNAME_FAILED',
          message: '별칭 변경에 실패했습니다.',
        },
      });
    }
  }

  /**
   * GET /api/user/payment-methods/default
   * Get user's default payment method
   */
  async getDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const paymentMethod = await userPaymentMethodsService.getDefaultPaymentMethod(userId);

      if (!paymentMethod) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_DEFAULT_PAYMENT_METHOD',
            message: '기본 결제 수단이 설정되지 않았습니다.',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          paymentMethod: {
            id: paymentMethod.id,
            nickname: paymentMethod.nickname,
            cardCompany: paymentMethod.cardCompany,
            cardNumberMasked: paymentMethod.cardNumberMasked,
            cardNumberLast4: paymentMethod.cardNumberLast4,
            isDefault: paymentMethod.isDefault,
          },
        },
      });

    } catch (error) {
      logger.error('Error in getDefaultPaymentMethod controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_DEFAULT_FAILED',
          message: '기본 결제 수단 조회에 실패했습니다.',
        },
      });
    }
  }
}
