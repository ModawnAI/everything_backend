/**
 * Split Payment Controller
 * 
 * Handles split payment-related API endpoints including:
 * - Split payment plan creation
 * - Split payment processing
 * - Payment status and history retrieval
 * - Payment reminder management
 */

import { Request, Response } from 'express';
import { splitPaymentService, CreateSplitPaymentPlanRequest, ProcessSplitPaymentRequest } from '../services/split-payment.service';
import { tossPaymentsService, PaymentInitiationRequest } from '../services/toss-payments.service';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class SplitPaymentController {
  private supabase = getSupabaseClient();

  /**
   * POST /api/split-payments/create-plan
   * Create a new split payment plan for a reservation
   */
  async createSplitPaymentPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        reservationId,
        totalAmount,
        depositAmount,
        remainingDueDate,
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
      if (!reservationId || !totalAmount || !depositAmount || !remainingDueDate) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'reservationId, totalAmount, depositAmount, remainingDueDate는 필수입니다.'
          }
        });
        return;
      }

      // Validate amounts
      if (totalAmount <= 0 || depositAmount <= 0) {
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

      if (depositAmount >= totalAmount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DEPOSIT_AMOUNT',
            message: '유효하지 않은 보증금 금액입니다.',
            details: '보증금은 총 금액보다 작아야 합니다.'
          }
        });
        return;
      }

      // Validate due date
      const dueDate = new Date(remainingDueDate);
      const now = new Date();
      if (dueDate <= now) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DUE_DATE',
            message: '유효하지 않은 만기일입니다.',
            details: '만기일은 현재 시간보다 이후여야 합니다.'
          }
        });
        return;
      }

      // Get reservation details and validate ownership
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

      // Validate total amount matches reservation
      if (totalAmount !== reservation.total_amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'AMOUNT_MISMATCH',
            message: '금액이 일치하지 않습니다.',
            details: '총 금액이 예약 금액과 일치하지 않습니다.'
          }
        });
        return;
      }

      // Create split payment plan
      const createRequest: CreateSplitPaymentPlanRequest = {
        reservationId,
        userId,
        totalAmount,
        depositAmount,
        remainingDueDate
      };

      const splitPlan = await splitPaymentService.createSplitPaymentPlan(createRequest);

      // Initialize deposit payment
      const paymentRequest: PaymentInitiationRequest = {
        reservationId,
        userId,
        amount: depositAmount,
        isDeposit: true,
        customerName: reservation.users.name,
        customerEmail: reservation.users.email,
        customerPhone: reservation.users.phone_number,
        successUrl: successUrl || `${process.env.FRONTEND_URL}/payments/success`,
        failUrl: failUrl || `${process.env.FRONTEND_URL}/payments/fail`
      };

      const paymentResponse = await tossPaymentsService.initializePayment(paymentRequest);

      res.status(201).json({
        success: true,
        data: {
          splitPaymentPlan: splitPlan,
          depositPayment: {
            paymentKey: paymentResponse.paymentKey,
            orderId: paymentResponse.orderId,
            checkoutUrl: paymentResponse.checkoutUrl,
            paymentId: paymentResponse.paymentId
          }
        },
        message: '분할 결제 계획이 성공적으로 생성되었습니다.'
      });

    } catch (error) {
      logger.error('Error creating split payment plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        reservationId: req.body.reservationId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '분할 결제 계획 생성 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * POST /api/split-payments/process
   * Process a payment for a specific installment
   */
  async processSplitPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        planId,
        installmentId,
        paymentKey,
        orderId,
        amount
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
      if (!planId || !installmentId || !paymentKey || !orderId || !amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'planId, installmentId, paymentKey, orderId, amount는 필수입니다.'
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

      // Process split payment
      const processRequest: ProcessSplitPaymentRequest = {
        planId,
        installmentId,
        paymentKey,
        orderId,
        amount,
        userId
      };

      const result = await splitPaymentService.processSplitPayment(processRequest);

      res.status(200).json({
        success: true,
        data: result,
        message: '분할 결제가 성공적으로 처리되었습니다.'
      });

    } catch (error) {
      logger.error('Error processing split payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        planId: req.body.planId,
        installmentId: req.body.installmentId
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: '결제 정보를 찾을 수 없습니다.',
              details: error.message
            }
          });
          return;
        }

        if (error.message.includes('Unauthorized')) {
          res.status(403).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: '접근 권한이 없습니다.',
              details: '해당 결제에 대한 접근 권한이 없습니다.'
            }
          });
          return;
        }

        if (error.message.includes('already paid')) {
          res.status(400).json({
            success: false,
            error: {
              code: 'ALREADY_PAID',
              message: '이미 결제된 항목입니다.',
              details: '해당 할부는 이미 결제되었습니다.'
            }
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '분할 결제 처리 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * GET /api/split-payments/status/:reservationId
   * Get split payment status for a reservation
   */
  async getSplitPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;
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

      const status = await splitPaymentService.getSplitPaymentStatus(reservationId, userId);

      res.status(200).json({
        success: true,
        data: status,
        message: '분할 결제 상태를 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error getting split payment status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        reservationId: req.params.reservationId
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '분할 결제 정보를 찾을 수 없습니다.',
            details: '해당 예약의 분할 결제 정보가 존재하지 않습니다.'
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '분할 결제 상태 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * POST /api/split-payments/initialize-remaining
   * Initialize payment for remaining balance
   */
  async initializeRemainingPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        planId,
        installmentId,
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
      if (!planId || !installmentId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'planId와 installmentId는 필수입니다.'
          }
        });
        return;
      }

      // Get installment details
      const { data: installment, error: installmentError } = await this.supabase
        .from('payment_installments')
        .select(`
          *,
          split_payment_plans!inner(
            reservation_id,
            user_id,
            reservations!inner(
              users!inner(name, email, phone_number)
            )
          )
        `)
        .eq('id', installmentId)
        .eq('split_payment_plans.user_id', userId)
        .single();

      if (installmentError || !installment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTALLMENT_NOT_FOUND',
            message: '할부 정보를 찾을 수 없습니다.',
            details: '해당 할부가 존재하지 않거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      // Check if installment is already paid
      if (installment.status === 'paid') {
        res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_PAID',
            message: '이미 결제된 항목입니다.',
            details: '해당 할부는 이미 결제되었습니다.'
          }
        });
        return;
      }

      // Initialize payment
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: installment.split_payment_plans.reservation_id,
        userId,
        amount: installment.amount,
        isDeposit: false,
        customerName: installment.split_payment_plans.reservations.users.name,
        customerEmail: installment.split_payment_plans.reservations.users.email,
        customerPhone: installment.split_payment_plans.reservations.users.phone_number,
        successUrl: successUrl || `${process.env.FRONTEND_URL}/payments/success`,
        failUrl: failUrl || `${process.env.FRONTEND_URL}/payments/fail`
      };

      const paymentResponse = await tossPaymentsService.initializePayment(paymentRequest);

      res.status(200).json({
        success: true,
        data: {
          paymentKey: paymentResponse.paymentKey,
          orderId: paymentResponse.orderId,
          checkoutUrl: paymentResponse.checkoutUrl,
          paymentId: paymentResponse.paymentId,
          amount: installment.amount,
          dueDate: installment.due_date
        },
        message: '잔액 결제가 초기화되었습니다.'
      });

    } catch (error) {
      logger.error('Error initializing remaining payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        planId: req.body.planId,
        installmentId: req.body.installmentId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잔액 결제 초기화 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * GET /api/split-payments/overdue
   * Get overdue installments (admin only)
   */
  async getOverdueInstallments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
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

      // Check if user is admin
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('user_role')
        .eq('id', userId)
        .single();

      if (userError || !user || user.user_role !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '접근 권한이 없습니다.',
            details: '관리자 권한이 필요합니다.'
          }
        });
        return;
      }

      const overdueInstallments = await splitPaymentService.getOverdueInstallments();

      res.status(200).json({
        success: true,
        data: {
          overdueInstallments,
          count: overdueInstallments.length
        },
        message: '연체 할부 목록을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error getting overdue installments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '연체 할부 목록 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }
} 