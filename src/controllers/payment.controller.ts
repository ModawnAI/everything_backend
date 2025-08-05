/**
 * Payment Controller
 * 
 * Handles payment-related API endpoints including:
 * - TossPayments payment initialization
 * - Payment confirmation and verification
 * - Webhook handling for status updates
 * - Payment history and status tracking
 */

import { Request, Response } from 'express';
import { tossPaymentsService, PaymentInitiationRequest, PaymentConfirmationRequest } from '../services/toss-payments.service';
import { paymentConfirmationService, EnhancedPaymentConfirmationRequest } from '../services/payment-confirmation.service';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class PaymentController {
  private supabase = getSupabaseClient();

  /**
   * POST /api/payments/toss/prepare
   * Initialize payment with TossPayments
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

      // Check if payment already exists
      const { data: existingPayment } = await this.supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)
        .eq('is_deposit', isDeposit)
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

      // Prepare payment initiation request
      const paymentRequest: PaymentInitiationRequest = {
        reservationId,
        userId,
        amount,
        isDeposit,
        customerName: reservation.users.name,
        customerEmail: reservation.users.email,
        customerPhone: reservation.users.phone_number,
        successUrl,
        failUrl
      };

      // Initialize payment with TossPayments
      const paymentResponse = await tossPaymentsService.initializePayment(paymentRequest);

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
          reservationId
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
   * POST /api/payments/toss/confirm
   * Confirm payment with TossPayments
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
        .select('*')
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
        paymentId: confirmResponse.paymentId,
        transactionId: confirmResponse.transactionId,
        status: confirmResponse.status,
        userId,
        orderId
      });

      res.status(200).json({
        success: true,
        data: {
          paymentId: confirmResponse.paymentId,
          status: confirmResponse.status,
          transactionId: confirmResponse.transactionId,
          approvedAt: confirmResponse.approvedAt,
          receiptUrl: confirmResponse.receiptUrl,
          amount,
          orderId,
          reservationStatus: confirmResponse.reservationStatus,
          notificationSent: confirmResponse.notificationSent,
          receiptGenerated: confirmResponse.receiptGenerated,
          auditLogId: confirmResponse.auditLogId
        }
      });

    } catch (error) {
      logger.error('Error in confirmPayment:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
        userId: req.user?.id
      });

      // Handle specific TossPayments errors
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
   * POST /api/webhooks/toss-payments
   * Handle webhooks from TossPayments
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const payload = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('TossPayments webhook received', {
        webhookId,
        paymentKey: payload.paymentKey,
        orderId: payload.orderId,
        status: payload.status,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString()
      });

      // Validate webhook payload
      if (!payload.paymentKey || !payload.orderId || !payload.status) {
        logger.warn('Invalid webhook payload received', { 
          webhookId,
          payload,
          ipAddress 
        });
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_WEBHOOK_PAYLOAD',
            message: '유효하지 않은 웹훅 데이터입니다.',
            details: '필수 필드가 누락되었습니다.'
          }
        });
        return;
      }

      // Validate webhook source (optional IP whitelist)
      if (!this.isValidWebhookSource(ipAddress)) {
        logger.warn('Webhook from unauthorized source', {
          webhookId,
          ipAddress,
          userAgent
        });
        res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED_WEBHOOK_SOURCE',
            message: '인증되지 않은 웹훅 소스입니다.'
          }
        });
        return;
      }

      // Process webhook asynchronously with enhanced error handling
      setImmediate(async () => {
        try {
          await tossPaymentsService.processWebhook(payload);
          
          const duration = Date.now() - startTime;
          logger.info('Webhook processed successfully', {
            webhookId,
            paymentKey: payload.paymentKey,
            orderId: payload.orderId,
            status: payload.status,
            duration
          });

        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error('Error processing webhook:', {
            webhookId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            payload,
            duration
          });

          // Log failed webhook for retry analysis
          await this.logFailedWebhook(payload, error, webhookId);
        }
      });

      // Respond immediately to TossPayments
      const duration = Date.now() - startTime;
      logger.info('Webhook response sent', {
        webhookId,
        statusCode: 200,
        duration
      });

      res.status(200).json({ 
        success: true,
        webhookId,
        timestamp: new Date().toISOString()
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
    // Get allowed IPs from environment (TossPayments IP ranges)
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

      // Build query
      let query = this.supabase
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
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      // Add status filter if provided
      if (status) {
        query = query.eq('payment_status', status);
      }

      const { data: payments, error: paymentsError, count } = await query;

      if (paymentsError) {
        throw paymentsError;
      }

      res.status(200).json({
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
          })) || [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: count || 0,
            totalPages: Math.ceil((count || 0) / Number(limit))
          }
        }
      });

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
} 