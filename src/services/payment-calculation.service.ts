/**
 * Payment Calculation Service
 * 
 * Comprehensive service for handling all payment amount calculations including:
 * - Deposit amount calculations based on service types and policies
 * - Remaining amount calculations for final payments
 * - Payment validation and overpayment prevention
 * - Partial payment tracking and refund calculations
 * - Split payment calculations and installment planning
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

// Payment calculation interfaces
export interface PaymentCalculationRequest {
  reservationId: string;
  services: Array<{
    serviceId: string;
    quantity: number;
  }>;
  pointsToUse?: number;
  appliedDiscounts?: Array<{
    type: 'points' | 'promotion' | 'coupon';
    amount: number;
    description?: string;
  }>;
}

export interface PaymentCalculationResponse {
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  depositRequired: boolean;
  calculationDetails: {
    serviceBreakdown: Array<{
      serviceId: string;
      serviceName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      depositAmount: number;
      depositPercentage?: number;
      depositType: 'fixed' | 'percentage' | 'default';
    }>;
    appliedDiscounts: Array<{
      type: 'points' | 'promotion' | 'coupon';
      amount: number;
      description?: string;
    }>;
    finalCalculation: {
      subtotal: number;
      totalDiscounts: number;
      amountAfterDiscounts: number;
      totalDeposit: number;
      remainingAmount: number;
    };
  };
}

export interface FinalPaymentCalculationRequest {
  reservationId: string;
  finalAmount?: number; // Optional override for service completion adjustments
}

export interface FinalPaymentCalculationResponse {
  originalTotalAmount: number;
  adjustedFinalAmount: number;
  totalPaidAmount: number;
  remainingAmount: number;
  overpaymentAmount: number;
  paymentBreakdown: {
    depositPaid: number;
    finalPaymentsPaid: number;
    cashPayments: number;
    refundsIssued: number;
  };
}

export interface RefundCalculationRequest {
  paymentId: string;
  refundAmount?: number; // Optional specific amount, otherwise calculate based on policy
  refundReason: string;
}

export interface RefundCalculationResponse {
  originalAmount: number;
  refundableAmount: number;
  calculatedRefund: number;
  refundPolicy: {
    percentage: number;
    timeLimitHours?: number;
    maxRefundAmount?: number;
    isActive: boolean;
  };
  refundBreakdown: {
    policyRefund: number;
    timeAdjustment: number;
    maxLimitAdjustment: number;
    finalRefund: number;
  };
}

export interface PartialPaymentTrackingRequest {
  reservationId: string;
  newPaymentAmount: number;
  paymentStage: 'deposit' | 'final' | 'partial';
}

export interface PartialPaymentTrackingResponse {
  totalAmount: number;
  totalPaid: number;
  remainingAmount: number;
  paymentHistory: Array<{
    paymentId: string;
    amount: number;
    stage: string;
    status: string;
    paidAt?: string;
  }>;
  nextPaymentRequired: boolean;
  nextPaymentAmount: number;
  nextPaymentStage: 'final' | 'complete' | 'none';
}

// Business rules constants
const PAYMENT_BUSINESS_RULES = {
  DEFAULT_DEPOSIT_PERCENTAGE: 25, // 25% default deposit
  MIN_DEPOSIT_PERCENTAGE: 20,     // Minimum 20% deposit
  MAX_DEPOSIT_PERCENTAGE: 30,     // Maximum 30% deposit
  MIN_DEPOSIT_AMOUNT: 10000,      // Minimum 10,000 won deposit
  MAX_DEPOSIT_AMOUNT: 100000,     // Maximum 100,000 won deposit
  MIN_PAYMENT_AMOUNT: 1000,       // Minimum payment amount
  MAX_OVERPAYMENT_THRESHOLD: 50000, // Max overpayment before refund
  DEFAULT_REFUND_PERCENTAGE: 100, // Default refund percentage
  REFUND_TIME_LIMIT_HOURS: 24,    // Default refund time limit
};

export class PaymentCalculationService {
  private supabase = getSupabaseClient();

  /**
   * Calculate comprehensive payment amounts including deposit and remaining balance
   */
  async calculatePaymentAmounts(request: PaymentCalculationRequest): Promise<PaymentCalculationResponse> {
    try {
      logger.info('Calculating payment amounts', {
        reservationId: request.reservationId,
        servicesCount: request.services.length,
        pointsToUse: request.pointsToUse || 0
      });

      // Calculate service breakdown and deposits
      const serviceBreakdown = await this.calculateServiceBreakdown(request.services);
      
      // Calculate total amounts
      const subtotal = serviceBreakdown.reduce((sum, service) => sum + service.totalPrice, 0);
      const totalServiceDeposit = serviceBreakdown.reduce((sum, service) => sum + service.depositAmount, 0);
      
      // Apply discounts
      const appliedDiscounts = request.appliedDiscounts || [];
      if (request.pointsToUse && request.pointsToUse > 0) {
        appliedDiscounts.push({
          type: 'points',
          amount: Math.min(request.pointsToUse, subtotal),
          description: '포인트 사용'
        });
      }
      
      const totalDiscounts = appliedDiscounts.reduce((sum, discount) => sum + discount.amount, 0);
      const amountAfterDiscounts = Math.max(0, subtotal - totalDiscounts);
      
      // Calculate final amounts
      const depositAmount = Math.min(totalServiceDeposit, amountAfterDiscounts);
      const remainingAmount = amountAfterDiscounts - depositAmount;
      const depositRequired = depositAmount > 0;

      const response: PaymentCalculationResponse = {
        totalAmount: amountAfterDiscounts,
        depositAmount,
        remainingAmount,
        depositRequired,
        calculationDetails: {
          serviceBreakdown,
          appliedDiscounts,
          finalCalculation: {
            subtotal,
            totalDiscounts,
            amountAfterDiscounts,
            totalDeposit: depositAmount,
            remainingAmount
          }
        }
      };

      logger.info('Payment calculation completed', {
        reservationId: request.reservationId,
        totalAmount: response.totalAmount,
        depositAmount: response.depositAmount,
        remainingAmount: response.remainingAmount,
        depositRequired: response.depositRequired
      });

      return response;

    } catch (error) {
      logger.error('Failed to calculate payment amounts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: request.reservationId
      });
      throw error;
    }
  }

  /**
   * Calculate final payment amounts for service completion
   */
  async calculateFinalPaymentAmounts(request: FinalPaymentCalculationRequest): Promise<FinalPaymentCalculationResponse> {
    try {
      logger.info('Calculating final payment amounts', {
        reservationId: request.reservationId,
        finalAmountOverride: request.finalAmount
      });

      // Get reservation details
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('total_price, deposit_amount, status')
        .eq('id', request.reservationId)
        .single();

      if (reservationError || !reservation) {
        throw new Error(`Reservation not found: ${request.reservationId}`);
      }

      // Get all payments for this reservation
      const { data: payments, error: paymentsError } = await this.supabase
        .from('payments')
        .select('id, amount, payment_stage, payment_status, paid_at, refund_amount')
        .eq('reservation_id', request.reservationId);

      if (paymentsError) {
        throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
      }

      // Calculate payment breakdown
      const paymentBreakdown = {
        depositPaid: 0,
        finalPaymentsPaid: 0,
        cashPayments: 0,
        refundsIssued: 0
      };

      let totalPaidAmount = 0;

      payments?.forEach(payment => {
        const netAmount = payment.amount - (payment.refund_amount || 0);
        
        if (payment.payment_status === 'deposit_paid' && payment.payment_stage === 'deposit') {
          paymentBreakdown.depositPaid += netAmount;
        } else if (payment.payment_status === 'final_payment_paid' && payment.payment_stage === 'final') {
          paymentBreakdown.finalPaymentsPaid += netAmount;
        } else if ((payment as any).payment_method === 'cash') {
          paymentBreakdown.cashPayments += netAmount;
        }
        
        if (payment.refund_amount && payment.refund_amount > 0) {
          paymentBreakdown.refundsIssued += payment.refund_amount;
        }
        
        totalPaidAmount += netAmount;
      });

      // Determine final amount
      const originalTotalAmount = reservation.total_price;
      const adjustedFinalAmount = request.finalAmount || originalTotalAmount;
      const remainingAmount = Math.max(0, adjustedFinalAmount - totalPaidAmount);
      const overpaymentAmount = Math.max(0, totalPaidAmount - adjustedFinalAmount);

      const response: FinalPaymentCalculationResponse = {
        originalTotalAmount,
        adjustedFinalAmount,
        totalPaidAmount,
        remainingAmount,
        overpaymentAmount,
        paymentBreakdown
      };

      logger.info('Final payment calculation completed', {
        reservationId: request.reservationId,
        originalTotal: originalTotalAmount,
        adjustedFinal: adjustedFinalAmount,
        totalPaid: totalPaidAmount,
        remaining: remainingAmount,
        overpayment: overpaymentAmount
      });

      return response;

    } catch (error) {
      logger.error('Failed to calculate final payment amounts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: request.reservationId
      });
      throw error;
    }
  }

  /**
   * Calculate refund amounts based on policies and timing
   */
  async calculateRefundAmount(request: RefundCalculationRequest): Promise<RefundCalculationResponse> {
    try {
      logger.info('Calculating refund amount', {
        paymentId: request.paymentId,
        requestedAmount: request.refundAmount,
        refundReason: request.refundReason
      });

      // Get payment details
      const { data: payment, error: paymentError } = await this.supabase
        .from('payments')
        .select(`
          *,
          reservations!inner(
            id,
            shop_id,
            total_price
          )
        `)
        .eq('id', request.paymentId)
        .single();

      if (paymentError || !payment) {
        throw new Error(`Payment not found: ${request.paymentId}`);
      }

      // Get refund policy
      const refundPolicy = await this.getRefundPolicy(payment.reservations.shop_id);
      
      // Calculate time-based adjustments
      const hoursSincePayment = this.calculateHoursSincePayment(payment.paid_at || payment.created_at);
      const timeAdjustment = refundPolicy.timeLimitHours && hoursSincePayment > refundPolicy.timeLimitHours ? 0 : 1;

      // Calculate refund amount
      let policyRefund = (payment.amount * refundPolicy.percentage) / 100;
      let maxLimitAdjustment = 1;

      if (refundPolicy.maxRefundAmount && policyRefund > refundPolicy.maxRefundAmount) {
        policyRefund = refundPolicy.maxRefundAmount;
        maxLimitAdjustment = refundPolicy.maxRefundAmount / ((payment.amount * refundPolicy.percentage) / 100);
      }

      const calculatedRefund = policyRefund * timeAdjustment;
      const finalRefund = request.refundAmount ? Math.min(request.refundAmount, calculatedRefund) : calculatedRefund;

      const response: RefundCalculationResponse = {
        originalAmount: payment.amount,
        refundableAmount: payment.amount - (payment.refund_amount || 0),
        calculatedRefund: finalRefund,
        refundPolicy,
        refundBreakdown: {
          policyRefund,
          timeAdjustment,
          maxLimitAdjustment,
          finalRefund
        }
      };

      logger.info('Refund calculation completed', {
        paymentId: request.paymentId,
        originalAmount: response.originalAmount,
        calculatedRefund: response.calculatedRefund,
        refundPolicy: refundPolicy.percentage
      });

      return response;

    } catch (error) {
      logger.error('Failed to calculate refund amount', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: request.paymentId
      });
      throw error;
    }
  }

  /**
   * Track partial payments and determine next payment requirements
   */
  async trackPartialPayments(request: PartialPaymentTrackingRequest): Promise<PartialPaymentTrackingResponse> {
    try {
      logger.info('Tracking partial payments', {
        reservationId: request.reservationId,
        newPaymentAmount: request.newPaymentAmount,
        paymentStage: request.paymentStage
      });

      // Get reservation and payment history
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('total_price, deposit_amount')
        .eq('id', request.reservationId)
        .single();

      if (reservationError || !reservation) {
        throw new Error(`Reservation not found: ${request.reservationId}`);
      }

      const { data: payments, error: paymentsError } = await this.supabase
        .from('payments')
        .select('id, amount, payment_stage, payment_status, paid_at')
        .eq('reservation_id', request.reservationId)
        .order('created_at', { ascending: true });

      if (paymentsError) {
        throw new Error(`Failed to fetch payment history: ${paymentsError.message}`);
      }

      // Calculate payment history and totals
      const paymentHistory = payments?.map(payment => ({
        paymentId: payment.id,
        amount: payment.amount,
        stage: payment.payment_stage || 'unknown',
        status: payment.payment_status,
        paidAt: payment.paid_at
      })) || [];

      const totalPaid = payments?.reduce((sum, payment) => {
        if (payment.payment_status === 'deposit_paid' || payment.payment_status === 'final_payment_paid') {
          return sum + payment.amount;
        }
        return sum;
      }, 0) || 0;

      const remainingAmount = Math.max(0, reservation.total_price - totalPaid);

      // Determine next payment requirements
      let nextPaymentRequired = false;
      let nextPaymentAmount = 0;
      let nextPaymentStage: 'final' | 'complete' | 'none' = 'none';

      if (remainingAmount > 0) {
        nextPaymentRequired = true;
        nextPaymentAmount = remainingAmount;
        nextPaymentStage = 'final';
      } else if (totalPaid >= reservation.total_price) {
        nextPaymentStage = 'complete';
      }

      const response: PartialPaymentTrackingResponse = {
        totalAmount: reservation.total_price,
        totalPaid,
        remainingAmount,
        paymentHistory,
        nextPaymentRequired,
        nextPaymentAmount,
        nextPaymentStage
      };

      logger.info('Partial payment tracking completed', {
        reservationId: request.reservationId,
        totalAmount: response.totalAmount,
        totalPaid: response.totalPaid,
        remainingAmount: response.remainingAmount,
        nextPaymentRequired: response.nextPaymentRequired
      });

      return response;

    } catch (error) {
      logger.error('Failed to track partial payments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: request.reservationId
      });
      throw error;
    }
  }

  /**
   * Validate payment amounts and prevent overpayment scenarios
   */
  async validatePaymentAmounts(
    reservationId: string,
    paymentAmount: number,
    paymentStage: 'deposit' | 'final' | 'single'
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get reservation details
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('total_price, deposit_amount')
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        errors.push(`Reservation not found: ${reservationId}`);
        return { isValid: false, errors, warnings };
      }

      // Basic amount validation
      if (paymentAmount < PAYMENT_BUSINESS_RULES.MIN_PAYMENT_AMOUNT) {
        errors.push(`Payment amount must be at least ${PAYMENT_BUSINESS_RULES.MIN_PAYMENT_AMOUNT} won`);
      }

      if (paymentAmount > reservation.total_price * 1.5) {
        warnings.push('Payment amount exceeds 150% of total reservation amount');
      }

      // Stage-specific validation
      if (paymentStage === 'deposit') {
        if (paymentAmount > reservation.deposit_amount * 1.1) {
          warnings.push('Deposit payment exceeds expected deposit amount by more than 10%');
        }
      } else if (paymentStage === 'final') {
        // Get existing payments
        const { data: existingPayments } = await this.supabase
          .from('payments')
          .select('amount')
          .eq('reservation_id', reservationId)
          .in('payment_status', ['deposit_paid', 'final_payment_paid']);

        const totalPaid = existingPayments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
        const expectedRemaining = reservation.total_price - totalPaid;

        if (paymentAmount > expectedRemaining * 1.1) {
          warnings.push('Final payment exceeds expected remaining amount by more than 10%');
        }
      }

      // Overpayment threshold check
      if (paymentAmount > PAYMENT_BUSINESS_RULES.MAX_OVERPAYMENT_THRESHOLD) {
        warnings.push('Large payment amount detected - may require refund processing');
      }

      const isValid = errors.length === 0;

      logger.info('Payment amount validation completed', {
        reservationId,
        paymentAmount,
        paymentStage,
        isValid,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return { isValid, errors, warnings };

    } catch (error) {
      logger.error('Failed to validate payment amounts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        paymentAmount,
        paymentStage
      });
      return { isValid: false, errors: ['Validation failed due to system error'], warnings: [] };
    }
  }

  // Private helper methods

  /**
   * Calculate service breakdown with deposit calculations
   */
  private async calculateServiceBreakdown(services: Array<{ serviceId: string; quantity: number }>) {
    const serviceBreakdown = [];

    for (const service of services) {
      const { data: serviceData, error } = await this.supabase
        .from('shop_services')
        .select('price_min, name, deposit_amount, deposit_percentage')
        .eq('id', service.serviceId)
        .single();

      if (error || !serviceData) {
        throw new Error(`Service with ID ${service.serviceId} not found`);
      }

      const unitPrice = serviceData.price_min;
      const totalPrice = unitPrice * service.quantity;

      // Calculate service-specific deposit
      let serviceDepositAmount = 0;
      let depositType: 'fixed' | 'percentage' | 'default' = 'default';
      let depositPercentage: number | undefined;

      if (serviceData.deposit_amount !== null && serviceData.deposit_amount > 0) {
        serviceDepositAmount = serviceData.deposit_amount * service.quantity;
        depositType = 'fixed';
      } else if (serviceData.deposit_percentage !== null && serviceData.deposit_percentage > 0) {
        depositPercentage = Number(serviceData.deposit_percentage);
        serviceDepositAmount = Math.round((totalPrice * depositPercentage) / 100);
        depositType = 'percentage';
      } else {
        depositPercentage = PAYMENT_BUSINESS_RULES.DEFAULT_DEPOSIT_PERCENTAGE;
        serviceDepositAmount = Math.round((totalPrice * depositPercentage) / 100);
        depositType = 'default';
      }

      // Apply business rules constraints
      serviceDepositAmount = Math.max(
        PAYMENT_BUSINESS_RULES.MIN_DEPOSIT_AMOUNT,
        Math.min(serviceDepositAmount, PAYMENT_BUSINESS_RULES.MAX_DEPOSIT_AMOUNT)
      );

      // Ensure deposit doesn't exceed service total
      serviceDepositAmount = Math.min(serviceDepositAmount, totalPrice);

      serviceBreakdown.push({
        serviceId: service.serviceId,
        serviceName: serviceData.name,
        quantity: service.quantity,
        unitPrice,
        totalPrice,
        depositAmount: serviceDepositAmount,
        depositPercentage,
        depositType
      });
    }

    return serviceBreakdown;
  }

  /**
   * Get refund policy for a shop
   */
  private async getRefundPolicy(shopId: string) {
    // For now, return default policy - can be enhanced to fetch shop-specific policies
    return {
      percentage: PAYMENT_BUSINESS_RULES.DEFAULT_REFUND_PERCENTAGE,
      timeLimitHours: PAYMENT_BUSINESS_RULES.REFUND_TIME_LIMIT_HOURS,
      maxRefundAmount: null,
      isActive: true
    };
  }

  /**
   * Calculate hours since payment
   */
  private calculateHoursSincePayment(paidAt: string): number {
    const now = new Date();
    const paymentDate = new Date(paidAt);
    return Math.floor((now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60));
  }
}

// Export singleton instance
export const paymentCalculationService = new PaymentCalculationService();
