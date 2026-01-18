/**
 * Payment Controller
 *
 * Handles payment-related API endpoints including:
 * - PortOne payment initialization
 * - Payment confirmation and verification
 * - Webhook handling for status updates
 * - Payment history and status tracking
 */

import { Request, Response } from 'express';
import { portOneService, PaymentInitiationRequest, PaymentConfirmationRequest } from '../services/portone.service';
import { paymentConfirmationService, EnhancedPaymentConfirmationRequest } from '../services/payment-confirmation.service';
import { twoStagePaymentService, DepositPaymentRequest, FinalPaymentRequest } from '../services/two-stage-payment.service';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SecureWebhookRequest } from '../middleware/webhook-security.middleware';

export class PaymentController {
  private supabase = getSupabaseClient();

  /**
   * @swagger
   * /api/payments/portone/prepare:
   *   post:
   *     summary: Initialize payment with PortOne
   *     description: Prepare a payment transaction with PortOne for reservation deposit or full payment
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reservationId
   *               - amount
   *             properties:
   *               reservationId:
   *                 type: string
   *                 format: uuid
   *                 description: ID of the reservation to pay for
   *                 example: "123e4567-e89b-12d3-a456-426614174000"
   *               amount:
   *                 type: number
   *                 minimum: 100
   *                 description: Payment amount in KRW (minimum 100원)
   *                 example: 50000
   *               isDeposit:
   *                 type: boolean
   *                 default: true
   *                 description: Whether this is a deposit payment (true) or full payment (false)
   *                 example: true
   *               successUrl:
   *                 type: string
   *                 format: uri
   *                 description: URL to redirect to after successful payment
   *                 example: "https://app.reviewthing.com/payment/success"
   *               failUrl:
   *                 type: string
   *                 format: uri
   *                 description: URL to redirect to after failed payment
   *                 example: "https://app.reviewthing.com/payment/fail"
   *     responses:
   *       200:
   *         description: Payment preparation successful
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
   *                     paymentId:
   *                       type: string
   *                       format: uuid
   *                       description: Internal payment ID
   *                       example: "pay_123e4567-e89b-12d3-a456-426614174000"
   *                     orderId:
   *                       type: string
   *                       description: PortOne order ID
   *                       example: "order_20240115_123456"
   *                     amount:
   *                       type: number
   *                       description: Payment amount
   *                       example: 50000
   *                     customerName:
   *                       type: string
   *                       description: Customer name
   *                       example: "홍길동"
   *                     successUrl:
   *                       type: string
   *                       description: Success redirect URL
   *                     failUrl:
   *                       type: string
   *                       description: Failure redirect URL
   *       400:
   *         description: Bad request - Invalid input data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: object
   *                   properties:
   *                     code:
   *                       type: string
   *                       example: "INVALID_AMOUNT"
   *                     message:
   *                       type: string
   *                       example: "결제 금액이 유효하지 않습니다."
   *                     details:
   *                       type: string
   *                       example: "최소 결제 금액은 100원입니다."
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         description: Reservation not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: object
   *                   properties:
   *                     code:
   *                       type: string
   *                       example: "RESERVATION_NOT_FOUND"
   *                     message:
   *                       type: string
   *                       example: "예약을 찾을 수 없습니다."
   *       409:
   *         description: Payment already exists
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: object
   *                   properties:
   *                     code:
   *                       type: string
   *                       example: "PAYMENT_ALREADY_EXISTS"
   *                     message:
   *                       type: string
   *                       example: "이미 진행 중인 결제가 있습니다."
   *       429:
   *         $ref: '#/components/responses/TooManyRequests'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: object
   *                   properties:
   *                     code:
   *                       type: string
   *                       example: "PAYMENT_INITIALIZATION_FAILED"
   *                     message:
   *                       type: string
   *                       example: "결제 초기화에 실패했습니다."
   */
  async preparePayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        reservationId,
        amount,
        isDeposit = true,
        successUrl,
        failUrl
      } = req.body;

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
      if (!reservationId || !amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'reservationId와 amount는 필수입니다.'
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
            message: '유효하지 않은 금액입니다.',
            details: '금액은 0보다 커야 합니다.'
          }
        });
        return;
      }

      // Get reservation details
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          users!inner(name, email, phone_number),
          shops!inner(name)
        `)
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

      // Validate payment amount against reservation
      if (isDeposit && amount > reservation.total_amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DEPOSIT_AMOUNT',
            message: '예약금이 총 금액을 초과할 수 없습니다.',
            details: `총 금액: ${reservation.total_amount}원, 요청 금액: ${amount}원`
          }
        });
        return;
      }

      // Determine payment stage based on isDeposit flag and reservation status
      const paymentStage = isDeposit ? 'deposit' : 'final';
      
      // For final payments, validate that service is completed
      if (!isDeposit && reservation.status !== 'completed') {
        res.status(409).json({
          success: false,
          error: {
            code: 'SERVICE_NOT_COMPLETED',
            message: '서비스가 아직 완료되지 않았습니다.',
            details: `현재 상태: ${reservation.status}. 서비스 완료 후 최종 결제가 가능합니다.`
          }
        });
        return;
      }

      // Check if payment already exists for the same stage
      const { data: existingPayment } = await this.supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)
        .eq('payment_stage', paymentStage)
        .eq('payment_status', 'pending')
        .single();

      if (existingPayment) {
        res.status(409).json({
          success: false,
          error: {
            code: 'PAYMENT_ALREADY_EXISTS',
            message: '이미 진행 중인 결제가 있습니다.',
            details: '동일한 예약에 대한 결제가 이미 초기화되었습니다.'
          }
        });
        return;
      }

      // Prepare payment initiation request with enhanced stage information
      const paymentRequest: PaymentInitiationRequest = {
        reservationId,
        userId,
        amount,
        isDeposit,
        customerName: reservation.users.name,
        customerEmail: reservation.users.email,
        customerPhone: reservation.users.phone_number,
        successUrl,
        failUrl,
        paymentStage: paymentStage
      };

      // Initialize payment with PortOne
      const paymentResponse = await portOneService.initializePayment(paymentRequest);

      logger.info('Payment preparation successful', {
        paymentId: paymentResponse.paymentId,
        orderId: paymentResponse.orderId,
        userId,
        reservationId,
        amount,
        isDeposit
      });

      res.status(200).json({
        success: true,
        data: {
          paymentKey: paymentResponse.paymentKey,
          orderId: paymentResponse.orderId,
          checkoutUrl: paymentResponse.checkoutUrl,
          paymentId: paymentResponse.paymentId,
          amount,
          isDeposit,
          paymentStage,
          reservationId,
          reservationStatus: reservation.status
        }
      });

    } catch (error) {
      logger.error('Error in preparePayment:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_INITIALIZATION_FAILED',
          message: '결제 초기화에 실패했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/payments/deposit/prepare:
   *   post:
   *     summary: Prepare deposit payment (20-30% of total amount)
   *     description: Initialize deposit payment for reservation confirmation
   *     tags: [Two-Stage Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reservationId
   *               - depositAmount
   *             properties:
   *               reservationId:
   *                 type: string
   *                 format: uuid
   *                 description: ID of the reservation
   *               depositAmount:
   *                 type: number
   *                 minimum: 1000
   *                 description: Deposit amount (20-30% of total)
   *               successUrl:
   *                 type: string
   *                 format: uri
   *               failUrl:
   *                 type: string
   *                 format: uri
   *     responses:
   *       200:
   *         description: Deposit payment prepared successfully
   *       400:
   *         description: Invalid deposit amount or request
   *       409:
   *         description: Payment already exists
   */
  async prepareDepositPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationId, depositAmount, successUrl, failUrl } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      // Validate required fields
      if (!reservationId || !depositAmount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'reservationId와 depositAmount는 필수입니다.'
          }
        });
        return;
      }

      // Get user information for payment
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('name, email, phone_number')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '사용자 정보를 찾을 수 없습니다.'
          }
        });
        return;
      }

      // Prepare deposit payment request
      const depositRequest: DepositPaymentRequest = {
        reservationId,
        userId,
        depositAmount,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone_number,
        successUrl,
        failUrl
      };

      // Use two-stage payment service
      const result = await twoStagePaymentService.prepareDepositPayment(depositRequest);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in prepareDepositPayment:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'DEPOSIT_PAYMENT_PREPARATION_FAILED',
          message: error instanceof Error ? error.message : '예약금 결제 준비에 실패했습니다.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/payments/final/prepare:
   *   post:
   *     summary: Prepare final payment (remaining amount after service completion)
   *     description: Initialize final payment after service is completed
   *     tags: [Two-Stage Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reservationId
   *             properties:
   *               reservationId:
   *                 type: string
   *                 format: uuid
   *                 description: ID of the completed reservation
   *               successUrl:
   *                 type: string
   *                 format: uri
   *               failUrl:
   *                 type: string
   *                 format: uri
   *     responses:
   *       200:
   *         description: Final payment prepared successfully
   *       400:
   *         description: Service not completed or invalid request
   *       409:
   *         description: Payment already exists
   */
  async prepareFinalPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationId, successUrl, failUrl } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      // Validate required fields
      if (!reservationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'reservationId는 필수입니다.'
          }
        });
        return;
      }

      // Get user information for payment
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('name, email, phone_number')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '사용자 정보를 찾을 수 없습니다.'
          }
        });
        return;
      }

      // Prepare final payment request
      const finalRequest: FinalPaymentRequest = {
        reservationId,
        userId,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone_number,
        successUrl,
        failUrl
      };

      // Use two-stage payment service
      const result = await twoStagePaymentService.prepareFinalPayment(finalRequest);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in prepareFinalPayment:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'FINAL_PAYMENT_PREPARATION_FAILED',
          message: error instanceof Error ? error.message : '잔금 결제 준비에 실패했습니다.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/payments/status/{reservationId}:
   *   get:
   *     summary: Get comprehensive payment status for a reservation
   *     description: Returns detailed payment status including deposit and final payment information
   *     tags: [Two-Stage Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: reservationId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Reservation ID
   *     responses:
   *       200:
   *         description: Payment status retrieved successfully
   *       404:
   *         description: Reservation not found
   */
  async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      // Verify user has access to this reservation
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('id')
        .eq('id', reservationId)
        .eq('user_id', userId)
        .single();

      if (reservationError || !reservation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESERVATION_NOT_FOUND',
            message: '예약을 찾을 수 없습니다.'
          }
        });
        return;
      }

      // Get payment status summary
      const statusSummary = await twoStagePaymentService.getPaymentStatusSummary(reservationId);

      res.status(200).json({
        success: true,
        data: statusSummary
      });

    } catch (error) {
      logger.error('Error in getPaymentStatus:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_STATUS_RETRIEVAL_FAILED',
          message: '결제 상태 조회에 실패했습니다.'
        }
      });
    }
  }

  /**
   * POST /api/payments/toss/confirm
   * Confirm payment with PortOne
   */
  async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentKey, orderId, amount } = req.body;

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
      if (!paymentKey || !orderId || !amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'paymentKey, orderId, amount는 필수입니다.'
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
            message: '유효하지 않은 금액입니다.',
            details: '금액은 0보다 커야 합니다.'
          }
        });
        return;
      }

      // Get payment record to verify ownership
      const { data: payment, error: paymentError } = await this.supabase
        .from('payments')
        .select(`
          *,
          reservations!inner(*)
        `)
        .eq('provider_order_id', orderId)
        .eq('user_id', userId)
        .single();

      if (paymentError || !payment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: '결제 정보를 찾을 수 없습니다.',
            details: '해당 결제가 존재하지 않거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      // Verify amount matches
      if (payment.amount !== amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'AMOUNT_MISMATCH',
            message: '금액이 일치하지 않습니다.',
            details: `예상 금액: ${payment.amount}원, 실제 금액: ${amount}원`
          }
        });
        return;
      }

      // Validate payment stage and reservation status
      if (payment.payment_stage === 'final' && payment.reservations.status !== 'completed') {
        res.status(409).json({
          success: false,
          error: {
            code: 'SERVICE_NOT_COMPLETED',
            message: '서비스가 아직 완료되지 않았습니다.',
            details: `최종 결제는 서비스 완료 후에만 가능합니다. 현재 상태: ${payment.reservations.status}`
          }
        });
        return;
      }

      // For final payments, ensure deposit was paid
      if (payment.payment_stage === 'final') {
        const { data: depositPayment } = await this.supabase
          .from('payments')
          .select('*')
          .eq('reservation_id', payment.reservation_id)
          .eq('payment_stage', 'deposit')
          .eq('payment_status', 'deposit_paid')
          .single();

        if (!depositPayment) {
          res.status(409).json({
            success: false,
            error: {
              code: 'DEPOSIT_NOT_PAID',
              message: '예약금이 결제되지 않았습니다.',
              details: '예약금 결제 후 최종 결제가 가능합니다.'
            }
          });
          return;
        }
      }

      // Enhanced payment confirmation with verification and processing
      const enhancedConfirmRequest: EnhancedPaymentConfirmationRequest = {
        paymentKey,
        orderId,
        amount,
        userId,
        sendNotification: true,
        generateReceipt: true
      };

      const confirmResponse = await paymentConfirmationService.confirmPaymentWithVerification(enhancedConfirmRequest);

      logger.info('Payment confirmation successful', {
        success: confirmResponse.success,
        payment: confirmResponse.payment,
        userId,
        orderId
      });

      res.status(200).json({
        success: true,
        data: {
          paymentId: confirmResponse.payment?.paymentId || paymentKey,
          status: confirmResponse.payment?.status || 'success',
          transactionId: confirmResponse.payment?.transactionId,
          approvedAt: confirmResponse.payment?.approvedAt || new Date().toISOString(),
          receiptUrl: confirmResponse.payment?.receiptUrl,
          amount,
          orderId,
          reservationStatus: confirmResponse.reservationStatus,
          notificationSent: confirmResponse.notificationSent,
          receiptGenerated: confirmResponse.receiptGenerated,
          auditLogId: confirmResponse.auditLogId,
          paymentStage: payment.payment_stage,
          isDeposit: payment.is_deposit
        }
      });

    } catch (error) {
      logger.error('Error in confirmPayment:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
        userId: req.user?.id
      });

      // Handle specific PortOne errors
      if (error instanceof Error) {
        if (error.message.includes('Amount mismatch')) {
          res.status(400).json({
            success: false,
            error: {
              code: 'AMOUNT_MISMATCH',
              message: '결제 금액이 일치하지 않습니다.',
              details: '결제 금액을 다시 확인해주세요.'
            }
          });
          return;
        }

        if (error.message.includes('Payment record not found')) {
          res.status(404).json({
            success: false,
            error: {
              code: 'PAYMENT_NOT_FOUND',
              message: '결제 정보를 찾을 수 없습니다.',
              details: '결제 정보가 존재하지 않습니다.'
            }
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_CONFIRMATION_FAILED',
          message: '결제 확인에 실패했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/webhooks/portone
   * Handle webhooks from PortOne using official SDK verification
   * Note: Uses official PortOne SDK for webhook signature verification
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const body = JSON.stringify(req.body);
      const headers = req.headers as Record<string, string>;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('PortOne webhook received', {
        webhookId,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString()
      });

      // Process webhook asynchronously with SDK verification
      setImmediate(async () => {
        const processingStartTime = Date.now();
        try {
          // Use official PortOne SDK for webhook processing (includes verification)
          await portOneService.processWebhook(body, headers);

          const processingDuration = Date.now() - processingStartTime;
          logger.info('Webhook processed successfully via SDK', {
            webhookId,
            processingDuration
          });

        } catch (error) {
          const processingDuration = Date.now() - processingStartTime;
          logger.error('Error processing webhook via SDK:', {
            webhookId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            processingDuration
          });

          // Log failed webhook for retry analysis
          await this.logFailedWebhook(req.body, error, webhookId);
        }
      });

      // Respond immediately to PortOne
      const duration = Date.now() - startTime;
      logger.info('Webhook response sent', {
        webhookId,
        statusCode: 200,
        duration
      });

      res.status(200).json({
        success: true,
        webhookId,
        timestamp: new Date().toISOString(),
        verified: true
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error in handleWebhook:', {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        duration
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'WEBHOOK_PROCESSING_FAILED',
          message: '웹훅 처리에 실패했습니다.',
          webhookId
        }
      });
    }
  }

  /**
   * Validate webhook source IP
   */
  private isValidWebhookSource(ipAddress: string): boolean {
    // Get allowed IPs from environment (PortOne IP ranges)
    const allowedIPs = process.env.TOSS_PAYMENTS_ALLOWED_IPS?.split(',') || [];
    
    if (allowedIPs.length === 0) {
      // If no IPs configured, allow all (for development)
      return true;
    }

    return allowedIPs.some(allowedIP => {
      // Simple IP matching (can be enhanced with CIDR notation)
      return ipAddress === allowedIP.trim();
    });
  }

  /**
   * Log failed webhook for analysis
   */
  private async logFailedWebhook(payload: any, error: any, webhookId: string): Promise<void> {
    try {
      await this.supabase
        .from('webhook_failures')
        .insert({
          webhook_id: webhookId,
          payment_key: payload.paymentKey,
          order_id: payload.orderId,
          status: payload.status,
          payload: payload,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          error_stack: error instanceof Error ? error.stack : undefined,
          failed_at: new Date().toISOString(),
          retry_count: 0
        });
    } catch (logError) {
      logger.error('Failed to log webhook failure', {
        webhookId,
        error: logError instanceof Error ? logError.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/payments/:paymentId
   * Get payment details
   */
  async getPaymentDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
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

      // Get payment details
      const { data: payment, error: paymentError } = await this.supabase
        .from('payments')
        .select(`
          *,
          reservations!inner(
            id,
            reservation_date,
            reservation_time,
            total_amount,
            deposit_amount,
            status,
            shops!inner(name, address)
          )
        `)
        .eq('id', paymentId)
        .eq('user_id', userId)
        .single();

      if (paymentError || !payment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: '결제 정보를 찾을 수 없습니다.',
            details: '해당 결제가 존재하지 않거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          payment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.payment_method,
            paymentStatus: payment.payment_status,
            isDeposit: payment.is_deposit,
            paidAt: payment.paid_at,
            refundedAt: payment.refunded_at,
            refundAmount: payment.refund_amount,
            failureReason: payment.failure_reason,
            metadata: payment.metadata,
            createdAt: payment.created_at,
            updatedAt: payment.updated_at
          },
          reservation: {
            id: payment.reservations.id,
            date: payment.reservations.reservation_date,
            time: payment.reservations.reservation_time,
            totalAmount: payment.reservations.total_amount,
            depositAmount: payment.reservations.deposit_amount,
            status: payment.reservations.status,
            shop: {
              name: payment.reservations.shops.name,
              address: payment.reservations.shops.address
            }
          }
        }
      });

    } catch (error) {
      logger.error('Error in getPaymentDetails:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: req.params.paymentId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_DETAILS_FETCH_FAILED',
          message: '결제 정보 조회에 실패했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/payments/user/:userId
   * Get user's payment history
   */
  async getUserPaymentHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    logger.info('[getUserPaymentHistory] 📥 Request started', {
      userId: req.params.userId,
      query: req.query
    });

    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user?.id;

      if (!authenticatedUserId) {
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

      // Users can only view their own payment history
      if (authenticatedUserId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '접근 권한이 없습니다.',
            details: '자신의 결제 내역만 조회할 수 있습니다.'
          }
        });
        return;
      }

      const { page = 1, limit = 10, status } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      // Build query - include points_used and points_earned from reservations
      // LEFT JOIN으로 변경 - !inner 제거하여 reservations/shops가 없는 결제도 조회
      let query = this.supabase
        .from('payments')
        .select(`
          *,
          reservations(
            id,
            reservation_date,
            reservation_time,
            total_amount,
            deposit_amount,
            status,
            points_used,
            points_earned,
            shops(name, address)
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      // Add status filter if provided
      if (status) {
        query = query.eq('payment_status', status);
      }

      const { data: payments, error: paymentsError, count } = await query;

      logger.info('[getUserPaymentHistory] 📊 Query completed', {
        duration: Date.now() - startTime,
        paymentCount: payments?.length || 0,
        totalCount: count
      });

      if (paymentsError) {
        throw paymentsError;
      }

      const responseData = {
        success: true,
        data: {
          payments: payments?.map(payment => ({
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.payment_method,
            paymentStatus: payment.payment_status,
            isDeposit: payment.is_deposit,
            paidAt: payment.paid_at,
            refundedAt: payment.refunded_at,
            refundAmount: payment.refund_amount,
            failureReason: payment.failure_reason,
            createdAt: payment.created_at,
            // reservation이 null일 수 있음 (LEFT JOIN)
            reservation: payment.reservations ? {
              id: payment.reservations.id,
              date: payment.reservations.reservation_date,
              time: payment.reservations.reservation_time,
              totalAmount: payment.reservations.total_amount,
              depositAmount: payment.reservations.deposit_amount,
              status: payment.reservations.status,
              pointsUsed: payment.reservations.points_used || 0,
              pointsEarned: payment.reservations.points_earned || 0,
              // shop도 null일 수 있음 (LEFT JOIN)
              shop: payment.reservations.shops ? {
                name: payment.reservations.shops.name,
                address: payment.reservations.shops.address
              } : null
            } : null
          })) || [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: count || 0,
            totalPages: Math.ceil((count || 0) / Number(limit))
          }
        }
      };

      logger.info('[getUserPaymentHistory] 📤 Sending response', {
        totalDuration: Date.now() - startTime,
        paymentCount: responseData.data.payments.length
      });

      // 🔍 DEBUG: Log full response data
      console.log('=============== PAYMENT HISTORY RESPONSE ===============');
      console.log(JSON.stringify(responseData, null, 2));
      console.log('========================================================');

      res.status(200).json(responseData);

    } catch (error) {
      logger.error('Error in getUserPaymentHistory:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        authenticatedUserId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_HISTORY_FETCH_FAILED',
          message: '결제 내역 조회에 실패했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/payments/success
   * Handle successful payment redirect
   */
  async handlePaymentSuccess(req: Request, res: Response): Promise<void> {
    try {
      const { paymentKey, orderId, amount } = req.query;

      logger.info('Payment success redirect received', {
        paymentKey,
        orderId,
        amount
      });

      // Redirect to frontend with success parameters
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?paymentKey=${paymentKey}&orderId=${orderId}&amount=${amount}`;
      
      res.redirect(redirectUrl);

    } catch (error) {
      logger.error('Error in handlePaymentSuccess:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      // Redirect to error page
      const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error?message=redirect_failed`;
      res.redirect(errorUrl);
    }
  }

  /**
   * POST /api/payments/fail
   * Handle failed payment redirect
   */
  async handlePaymentFail(req: Request, res: Response): Promise<void> {
    try {
      const { paymentKey, orderId, code, message } = req.query;

      logger.info('Payment fail redirect received', {
        paymentKey,
        orderId,
        code,
        message
      });

      // Redirect to frontend with error parameters
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/fail?paymentKey=${paymentKey}&orderId=${orderId}&code=${code}&message=${message}`;
      
      res.redirect(redirectUrl);

    } catch (error) {
      logger.error('Error in handlePaymentFail:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      // Redirect to error page
      const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error?message=redirect_failed`;
      res.redirect(errorUrl);
    }
  }

  /**
   * POST /api/payments/toss/confirm
   * Confirm payment with PortOne
   */

  /**
   * @swagger
   * /api/payments/final/confirm:
   *   post:
   *     summary: Confirm final payment after service completion
   *     description: Confirm final payment processing for two-stage payment system
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - paymentKey
   *               - orderId
   *               - amount
   *             properties:
   *               paymentKey:
   *                 type: string
   *                 description: PortOne payment key
   *               orderId:
   *                 type: string
   *                 description: PortOne order ID
   *               amount:
   *                 type: number
   *                 description: Final payment amount
   *     responses:
   *       200:
   *         description: Final payment confirmation successful
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
   *                     paymentId:
   *                       type: string
   *                       description: Internal payment ID
   *                     status:
   *                       type: string
   *                       description: Payment status
   *                     transactionId:
   *                       type: string
   *                       description: PortOne transaction ID
   *                     approvedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Payment approval timestamp
   *       400:
   *         description: Bad request - Invalid payment data
   *       404:
   *         description: Payment not found
   *       500:
   *         description: Internal server error
   */
  async confirmFinalPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentKey, orderId, amount } = req.body;

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
      if (!paymentKey || !orderId || !amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'paymentKey, orderId, amount는 필수입니다.'
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
            message: '유효하지 않은 금액입니다.',
            details: '금액은 0보다 커야 합니다.'
          }
        });
        return;
      }

      // Get final payment record to verify ownership and stage
      const { data: payment, error: paymentError } = await this.supabase
        .from('payments')
        .select(`
          *,
          reservations!inner(*)
        `)
        .eq('provider_order_id', orderId)
        .eq('user_id', userId)
        .eq('payment_stage', 'final')
        .single();

      if (paymentError || !payment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FINAL_PAYMENT_NOT_FOUND',
            message: '최종 결제 정보를 찾을 수 없습니다.',
            details: '해당 최종 결제가 존재하지 않거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      // Verify amount matches
      if (payment.amount !== amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'AMOUNT_MISMATCH',
            message: '금액이 일치하지 않습니다.',
            details: `예상 금액: ${payment.amount}원, 실제 금액: ${amount}원`
          }
        });
        return;
      }

      // Enhanced final payment confirmation with verification
      const enhancedConfirmRequest: EnhancedPaymentConfirmationRequest = {
        paymentKey,
        orderId,
        amount,
        userId,
        sendNotification: true,
        generateReceipt: true
      };

      const confirmResponse = await paymentConfirmationService.confirmPaymentWithVerification(enhancedConfirmRequest);

      logger.info('Final payment confirmation successful', {
        success: confirmResponse.success,
        payment: confirmResponse.payment,
        userId,
        orderId,
        reservationId: payment.reservations.id
      });

      res.status(200).json({
        success: true,
        data: {
          paymentId: confirmResponse.payment?.paymentId || paymentKey,
          status: confirmResponse.payment?.status || 'success',
          transactionId: confirmResponse.payment?.transactionId,
          approvedAt: confirmResponse.payment?.approvedAt || new Date().toISOString(),
          receiptUrl: confirmResponse.payment?.receiptUrl,
          amount,
          orderId,
          reservationStatus: confirmResponse.reservationStatus,
          notificationSent: confirmResponse.notificationSent,
          receiptGenerated: confirmResponse.receiptGenerated,
          auditLogId: confirmResponse.auditLogId,
          isFinalPayment: true,
          paymentStage: 'final'
        }
      });

    } catch (error) {
      logger.error('Error in confirmFinalPayment:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
        userId: req.user?.id
      });

      // Handle specific PortOne errors
      if (error instanceof Error) {
        if (error.message.includes('Amount mismatch')) {
          res.status(400).json({
            success: false,
            error: {
              code: 'AMOUNT_MISMATCH',
              message: '결제 금액이 일치하지 않습니다.',
              details: '결제 금액을 다시 확인해주세요.'
            }
          });
          return;
        }

        if (error.message.includes('Payment record not found')) {
          res.status(404).json({
            success: false,
            error: {
              code: 'FINAL_PAYMENT_NOT_FOUND',
              message: '최종 결제 정보를 찾을 수 없습니다.',
              details: '최종 결제 정보가 존재하지 않습니다.'
            }
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'FINAL_PAYMENT_CONFIRMATION_FAILED',
          message: '최종 결제 확인에 실패했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/payments/billing-key
   * Pay with saved billing key (instant payment without payment window)
   */
  async payWithBillingKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { reservationId, paymentMethodId, amount, paymentType = 'deposit', orderName } = req.body;

      // Validate required fields
      if (!reservationId || !paymentMethodId || !amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'reservationId, paymentMethodId, amount를 모두 제공해주세요.',
          },
        });
        return;
      }

      // Validate amount
      if (amount < 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: '결제 금액이 유효하지 않습니다.',
            details: '최소 결제 금액은 100원입니다.',
          },
        });
        return;
      }

      logger.info('Processing billing key payment', {
        userId,
        reservationId,
        paymentMethodId,
        amount,
        paymentType,
      });

      // 1. Get reservation
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('id, user_id, shop_id, total_price, status')
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESERVATION_NOT_FOUND',
            message: '예약을 찾을 수 없습니다.',
          },
        });
        return;
      }

      // Verify ownership
      if (reservation.user_id !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: '해당 예약에 대한 권한이 없습니다.',
          },
        });
        return;
      }

      // 2. Get user's saved payment method
      const { userPaymentMethodsService } = await import('../services/user-payment-methods.service');
      const paymentMethod = await userPaymentMethodsService.getPaymentMethod(paymentMethodId, userId);

      if (!paymentMethod) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PAYMENT_METHOD_NOT_FOUND',
            message: '결제 수단을 찾을 수 없습니다.',
          },
        });
        return;
      }

      // 3. Generate unique payment ID
      const timestamp = Date.now();
      const portonePaymentId = `pay_${reservationId.substring(0, 8)}_${paymentType}_${timestamp}`;

      // 4. Call PortOne billing key payment API
      const { PortOneClient } = await import('@portone/server-sdk');
      const { config } = await import('../config/environment');

      const apiSecret = config.payments?.portone?.v2?.apiSecret;
      if (!apiSecret) {
        logger.warn('PortOne API secret not configured - simulating payment success for development');

        // Development mode: simulate payment success
        const { data: simulatedPayment } = await this.supabase
          .from('payments')
          .insert({
            reservation_id: reservationId,
            user_id: userId,
            payment_method: 'card',
            payment_status: 'fully_paid',
            amount,
            currency: 'KRW',
            payment_provider: 'portone',
            provider_order_id: portonePaymentId,
            provider_transaction_id: `dev_txn_${timestamp}`,
            is_deposit: paymentType === 'deposit',
            payment_stage: paymentType,
            paid_at: new Date().toISOString(),
            metadata: {
              dev_mode: true,
              paymentMethodId,
              billingKey: paymentMethod.billingKey,
              orderName: orderName || `에뷰리띵 ${paymentType === 'deposit' ? '예약금' : '최종'} 결제`,
            },
          })
          .select()
          .single();

        logger.info('DEV MODE: Simulated billing key payment success', {
          paymentId: simulatedPayment.id,
          reservationId,
          amount,
        });

        res.status(200).json({
          success: true,
          data: {
            paymentId: simulatedPayment.id,
            transactionId: simulatedPayment.provider_transaction_id,
            status: 'PAID',
            paidAt: simulatedPayment.paid_at,
            receiptUrl: null,
          },
          message: '결제가 완료되었습니다 (개발 모드).',
        });
        return;
      }

      // Production mode: Call PortOne API
      const portoneClient = PortOneClient({ secret: apiSecret });

      const paymentResponse = await portoneClient.payment.payWithBillingKey({
        paymentId: portonePaymentId,
        billingKey: paymentMethod.billingKey,
        orderName: orderName || `에뷰리띵 ${paymentType === 'deposit' ? '예약금' : '최종'} 결제`,
        customer: {
          id: userId,
        },
        amount: {
          total: amount,
        },
        currency: 'KRW',
      } as any);

      // Check payment status
      if ((paymentResponse as any).status !== 'PAID') {
        logger.error('Billing key payment not completed', {
          paymentId: portonePaymentId,
          status: (paymentResponse as any).status,
        });

        res.status(402).json({
          success: false,
          error: {
            code: 'PAYMENT_FAILED',
            message: '결제에 실패했습니다.',
            details: (paymentResponse as any).failureReason || '결제 처리 중 문제가 발생했습니다.',
          },
        });
        return;
      }

      // 5. Save payment record
      const { data: payment, error: paymentInsertError } = await this.supabase
        .from('payments')
        .insert({
          reservation_id: reservationId,
          user_id: userId,
          payment_method: 'card',
          payment_status: 'fully_paid',
          amount,
          currency: 'KRW',
          payment_provider: 'portone',
          provider_order_id: portonePaymentId,
          provider_transaction_id: (paymentResponse as any).transactionId,
          is_deposit: paymentType === 'deposit',
          payment_stage: paymentType,
          paid_at: (paymentResponse as any).paidAt || new Date().toISOString(),
          metadata: {
            paymentMethodId,
            billingKey: paymentMethod.billingKey,
            orderName: (paymentResponse as any).orderName,
            portoneResponse: paymentResponse,
          },
        })
        .select()
        .single();

      if (paymentInsertError) {
        logger.error('Failed to save payment record after successful billing key payment', {
          error: paymentInsertError.message,
          portonePaymentId,
        });
        throw paymentInsertError;
      }

      // 6. Update payment method usage
      await userPaymentMethodsService.recordPaymentMethodUsage(paymentMethodId);

      // 7. Update reservation status based on payment type
      if (paymentType === 'deposit') {
        await this.supabase
          .from('reservations')
          .update({
            status: 'deposit_paid',
            deposit_amount: amount,
            deposit_paid_at: new Date().toISOString(),
          })
          .eq('id', reservationId);
      } else if (paymentType === 'final' || paymentType === 'single') {
        await this.supabase
          .from('reservations')
          .update({
            status: 'fully_paid',
            payment_completed_at: new Date().toISOString(),
          })
          .eq('id', reservationId);
      }

      logger.info('Billing key payment completed successfully', {
        paymentId: payment.id,
        reservationId,
        transactionId: payment.provider_transaction_id,
        amount,
        paymentType,
      });

      res.status(200).json({
        success: true,
        data: {
          paymentId: payment.id,
          transactionId: payment.provider_transaction_id,
          status: 'PAID',
          paidAt: payment.paid_at,
          receiptUrl: (paymentResponse as any).receiptUrl || null,
        },
        message: '결제가 완료되었습니다.',
      });

    } catch (error) {
      logger.error('Error in payWithBillingKey', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'BILLING_KEY_PAYMENT_FAILED',
          message: '빌링키 결제에 실패했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      });
    }
  }
} 