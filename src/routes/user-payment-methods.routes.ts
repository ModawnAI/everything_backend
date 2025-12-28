/**
 * @swagger
 * tags:
 *   - name: User Payment Methods
 *     description: User payment method management (billing keys)
 *
 *       사용자 결제 수단 관리 API입니다. 빌링키를 이용한 간편 결제를 위한 카드 등록 및 관리 기능을 제공합니다.
 *
 *       ---
 *
 */

/**
 * User Payment Methods Routes
 *
 * API endpoints for user payment method management:
 * - Register payment methods (save billing keys from PortOne)
 * - List saved payment methods
 * - Set default payment method
 * - Delete payment methods
 * - Update payment method settings
 */

import { Router } from 'express';
import { UserPaymentMethodsController } from '../controllers/user-payment-methods.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

const router = Router();
const controller = new UserPaymentMethodsController();

// Rate limiting configuration
const paymentMethodsRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Max 20 requests per 15 minutes
    strategy: 'fixed_window',
  },
});

const registrationRateLimit = rateLimit({
  config: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Max 5 payment method registrations per hour
    strategy: 'fixed_window',
  },
});

/**
 * @swagger
 * /api/user/payment-methods:
 *   post:
 *     summary: Register new payment method
 *     description: Save a billing key from PortOne as a payment method for quick checkout
 *
 *       사용자가 PortOne에서 발급받은 빌링키를 저장하여 간편 결제에 사용할 수 있도록 등록합니다.
 *
 *       ---
 *
 *     tags: [User Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - billingKey
 *             properties:
 *               billingKey:
 *                 type: string
 *                 description: Billing key from PortOne.requestIssueBillingKey()
 *                 example: "billing_key_xxxxxxxxxxxxx"
 *               nickname:
 *                 type: string
 *                 maxLength: 50
 *                 description: Custom nickname for this payment method
 *                 example: "내 신한카드"
 *               setAsDefault:
 *                 type: boolean
 *                 default: false
 *                 description: Set this as the default payment method
 *     responses:
 *       201:
 *         description: Payment method registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentMethod:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         nickname:
 *                           type: string
 *                         cardCompany:
 *                           type: string
 *                         cardNumberMasked:
 *                           type: string
 *                         cardNumberLast4:
 *                           type: string
 *                         isDefault:
 *                           type: boolean
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Registration failed
 */
router.post(
  '/',
  authenticateJWT,
  registrationRateLimit,
  async (req, res) => {
    try {
      await controller.registerPaymentMethod(req, res);
    } catch (error) {
      logger.error('Error in payment method registration route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '결제 수단 등록 중 오류가 발생했습니다.',
        },
      });
    }
  }
);

/**
 * @swagger
 * /api/user/payment-methods:
 *   get:
 *     summary: Get all saved payment methods
 *     description: Retrieve all active payment methods for the authenticated user
 *
 *       사용자가 등록한 모든 결제 수단을 조회합니다.
 *
 *       ---
 *
 *     tags: [User Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment methods retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentMethods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           nickname:
 *                             type: string
 *                           cardCompany:
 *                             type: string
 *                           cardNumberMasked:
 *                             type: string
 *                           cardNumberLast4:
 *                             type: string
 *                           isDefault:
 *                             type: boolean
 *                           lastUsedAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Authentication required
 */
router.get(
  '/',
  authenticateJWT,
  paymentMethodsRateLimit,
  async (req, res) => {
    try {
      await controller.getPaymentMethods(req, res);
    } catch (error) {
      logger.error('Error in get payment methods route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '결제 수단 조회 중 오류가 발생했습니다.',
        },
      });
    }
  }
);

/**
 * @swagger
 * /api/user/payment-methods/default:
 *   get:
 *     summary: Get default payment method
 *     description: Get the user's default payment method
 *
 *       사용자의 기본 결제 수단을 조회합니다.
 *
 *       ---
 *
 *     tags: [User Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default payment method retrieved
 *       404:
 *         description: No default payment method set
 *       401:
 *         description: Authentication required
 */
router.get(
  '/default',
  authenticateJWT,
  paymentMethodsRateLimit,
  async (req, res) => {
    try {
      await controller.getDefaultPaymentMethod(req, res);
    } catch (error) {
      logger.error('Error in get default payment method route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '기본 결제 수단 조회 중 오류가 발생했습니다.',
        },
      });
    }
  }
);

/**
 * @swagger
 * /api/user/payment-methods/{id}/default:
 *   patch:
 *     summary: Set payment method as default
 *     description: Set a specific payment method as the user's default
 *
 *       특정 결제 수단을 기본 결제 수단으로 설정합니다.
 *
 *       ---
 *
 *     tags: [User Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment method ID
 *     responses:
 *       200:
 *         description: Default payment method updated
 *       404:
 *         description: Payment method not found
 *       401:
 *         description: Authentication required
 */
router.patch(
  '/:id/default',
  authenticateJWT,
  paymentMethodsRateLimit,
  async (req, res) => {
    try {
      await controller.setDefaultPaymentMethod(req, res);
    } catch (error) {
      logger.error('Error in set default payment method route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        paymentMethodId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '기본 결제 수단 설정 중 오류가 발생했습니다.',
        },
      });
    }
  }
);

/**
 * @swagger
 * /api/user/payment-methods/{id}/nickname:
 *   patch:
 *     summary: Update payment method nickname
 *     description: Update the custom nickname for a payment method
 *
 *       결제 수단의 별칭을 변경합니다.
 *
 *       ---
 *
 *     tags: [User Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment method ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nickname
 *             properties:
 *               nickname:
 *                 type: string
 *                 maxLength: 50
 *                 description: New nickname
 *                 example: "주 카드"
 *     responses:
 *       200:
 *         description: Nickname updated successfully
 *       400:
 *         description: Invalid nickname
 *       404:
 *         description: Payment method not found
 *       401:
 *         description: Authentication required
 */
router.patch(
  '/:id/nickname',
  authenticateJWT,
  paymentMethodsRateLimit,
  async (req, res) => {
    try {
      await controller.updateNickname(req, res);
    } catch (error) {
      logger.error('Error in update nickname route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        paymentMethodId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '별칭 변경 중 오류가 발생했습니다.',
        },
      });
    }
  }
);

/**
 * @swagger
 * /api/user/payment-methods/{id}:
 *   delete:
 *     summary: Delete payment method
 *     description: Delete a saved payment method (soft delete)
 *
 *       저장된 결제 수단을 삭제합니다. PortOne에서도 함께 삭제할 수 있습니다.
 *
 *       ---
 *
 *     tags: [User Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment method ID
 *       - in: query
 *         name: deleteFromPortOne
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Also delete billing key from PortOne
 *     responses:
 *       200:
 *         description: Payment method deleted successfully
 *       404:
 *         description: Payment method not found
 *       401:
 *         description: Authentication required
 */
router.delete(
  '/:id',
  authenticateJWT,
  paymentMethodsRateLimit,
  async (req, res) => {
    try {
      await controller.deletePaymentMethod(req, res);
    } catch (error) {
      logger.error('Error in delete payment method route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        paymentMethodId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '결제 수단 삭제 중 오류가 발생했습니다.',
        },
      });
    }
  }
);

// Error handling middleware for payment methods routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in user payment methods routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '결제 수단 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.',
    },
  });
});

export default router;
