/**
 * Timezone-Aware Refund Service
 * 
 * Comprehensive service for handling refund calculations and eligibility
 * with Korean timezone awareness and business rule enforcement
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { 
  calculateRefundEligibility, 
  getCurrentKoreanTime, 
  formatKoreanDateTime,
  calculateKoreanTimeDifferenceInHours,
  isKoreanBusinessHours,
  getNextKoreanBusinessDay,
  type RefundEligibilityResult 
} from '../utils/korean-timezone';

export interface RefundCalculationRequest {
  reservationId: string;
  userId: string;
  cancellationType: 'user_request' | 'shop_request' | 'no_show' | 'admin_force';
  reason?: string;
  refundPreference?: 'full_refund' | 'partial_refund' | 'no_refund';
}

export interface RefundCalculationResult {
  isEligible: boolean;
  refundAmount: number;
  refundPercentage: number;
  processingTime: string;
  cancellationWindow: string;
  reason: string;
  koreanTimeInfo: {
    currentTime: string;
    reservationTime: string;
    timeZone: string;
  };
  businessRules: {
    appliedPolicies: string[];
    exceptions: string[];
    notes: string[];
  };
  auditTrail: {
    calculatedAt: string;
    calculatedBy: string;
    reservationId: string;
    cancellationType: string;
  };
}

export interface RefundProcessingResult {
  success: boolean;
  refundAmount: number;
  processingTime: number;
  refundStatus: string;
  transactionId?: string;
  error?: string;
}

export class TimezoneRefundService {
  private supabase = getSupabaseClient();

  /**
   * Calculate refund amount with Korean timezone awareness
   */
  async calculateRefundAmount(request: RefundCalculationRequest): Promise<RefundCalculationResult> {
    try {
      logger.info('Calculating refund amount with timezone awareness', {
        reservationId: request.reservationId,
        userId: request.userId,
        cancellationType: request.cancellationType
      });

      // Get reservation details
      const reservation = await this.getReservationDetails(request.reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Verify user ownership
      if (reservation.user_id !== request.userId) {
        throw new Error('User does not own this reservation');
      }

      // Calculate refund eligibility using Korean timezone
      const eligibilityResult = calculateRefundEligibility(
        new Date(reservation.reservation_date),
        reservation.reservation_time,
        getCurrentKoreanTime()
      );

      // Apply business rules based on cancellation type
      const businessRules = this.applyBusinessRules(
        eligibilityResult,
        request.cancellationType,
        request.refundPreference
      );

      // Calculate final refund amount
      const baseRefundAmount = reservation.total_amount || 0;
      const finalRefundPercentage = this.calculateFinalRefundPercentage(
        eligibilityResult.refundPercentage,
        businessRules
      );
      
      const refundAmount = Math.round((baseRefundAmount * finalRefundPercentage) / 100);

      // Determine processing time
      const processingTime = this.calculateProcessingTime(
        eligibilityResult.hoursUntilReservation,
        request.cancellationType
      );

      const result: RefundCalculationResult = {
        isEligible: eligibilityResult.isEligible && finalRefundPercentage > 0,
        refundAmount,
        refundPercentage: finalRefundPercentage,
        processingTime,
        cancellationWindow: eligibilityResult.cancellationWindow,
        reason: this.generateRefundReason(eligibilityResult, businessRules),
        koreanTimeInfo: eligibilityResult.koreanTimeInfo,
        businessRules: {
          appliedPolicies: businessRules.appliedPolicies,
          exceptions: businessRules.exceptions,
          notes: businessRules.notes
        },
        auditTrail: {
          calculatedAt: formatKoreanDateTime(getCurrentKoreanTime()),
          calculatedBy: request.userId,
          reservationId: request.reservationId,
          cancellationType: request.cancellationType
        }
      };

      logger.info('Refund calculation completed', {
        reservationId: request.reservationId,
        refundAmount: result.refundAmount,
        refundPercentage: result.refundPercentage,
        isEligible: result.isEligible
      });

      return result;

    } catch (error) {
      logger.error('Error calculating refund amount', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: request.reservationId,
        userId: request.userId
      });
      throw error;
    }
  }

  /**
   * Process refund with Korean timezone-aware business rules
   */
  async processRefund(request: RefundCalculationRequest): Promise<RefundProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Processing refund with timezone awareness', {
        reservationId: request.reservationId,
        userId: request.userId,
        cancellationType: request.cancellationType
      });

      // Calculate refund amount
      const refundCalculation = await this.calculateRefundAmount(request);

      if (!refundCalculation.isEligible || refundCalculation.refundAmount <= 0) {
        return {
          success: false,
          refundAmount: 0,
          processingTime: Date.now() - startTime,
          refundStatus: 'not_eligible',
          error: refundCalculation.reason
        };
      }

      // Process the actual refund via TossPayments
      let transactionId: string | undefined;
      let refundStatus = 'processed';

      try {
        const { portOneService } = await import('./portone.service');
        
        // Get payments for the reservation
        const { data: payments } = await this.supabase
          .from('payments')
          .select('*')
          .eq('reservation_id', request.reservationId)
          .in('payment_status', ['deposit_paid', 'final_payment_paid', 'fully_paid']);

        if (payments && payments.length > 0) {
          // Process refunds for all payments
          for (const payment of payments) {
            await portOneService.cancelPayment(
              payment.id,
              request.reason || `Cancellation: ${request.cancellationType}`,
              Math.round((payment.amount * refundCalculation.refundPercentage) / 100)
            );
          }
          
          transactionId = `refund_${request.reservationId}_${Date.now()}`;
        }

      } catch (refundError) {
        logger.error('Failed to process payment refund', {
          error: refundError instanceof Error ? refundError.message : 'Unknown error',
          reservationId: request.reservationId
        });
        refundStatus = 'payment_failed';
      }

      // Create refund audit record
      await this.createRefundAuditRecord({
        reservationId: request.reservationId,
        userId: request.userId,
        refundAmount: refundCalculation.refundAmount,
        refundPercentage: refundCalculation.refundPercentage,
        cancellationType: request.cancellationType,
        reason: request.reason,
        transactionId,
        refundStatus,
        koreanTimeInfo: refundCalculation.koreanTimeInfo
      });

      const processingTime = Date.now() - startTime;

      logger.info('Refund processing completed', {
        reservationId: request.reservationId,
        refundAmount: refundCalculation.refundAmount,
        processingTime,
        refundStatus
      });

      return {
        success: refundStatus === 'processed',
        refundAmount: refundCalculation.refundAmount,
        processingTime,
        refundStatus,
        transactionId
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error processing refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: request.reservationId,
        processingTime
      });

      return {
        success: false,
        refundAmount: 0,
        processingTime,
        refundStatus: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get reservation details for refund calculation
   */
  private async getReservationDetails(reservationId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch reservation: ${error.message}`);
    }

    return data;
  }

  /**
   * Apply business rules based on cancellation type and preferences
   */
  private applyBusinessRules(
    eligibilityResult: RefundEligibilityResult,
    cancellationType: string,
    refundPreference?: string
  ): {
    appliedPolicies: string[];
    exceptions: string[];
    notes: string[];
    adjustmentPercentage: number;
  } {
    const appliedPolicies: string[] = [];
    const exceptions: string[] = [];
    const notes: string[] = [];
    let adjustmentPercentage = 0;

    // Apply cancellation type specific rules
    switch (cancellationType) {
      case 'user_request':
        appliedPolicies.push('Standard user cancellation policy');
        break;
      case 'shop_request':
        appliedPolicies.push('Shop-initiated cancellation - full refund policy');
        adjustmentPercentage = 20; // 20% bonus for shop cancellations
        notes.push('Shop-initiated cancellations receive enhanced refund rates');
        break;
      case 'no_show':
        appliedPolicies.push('No-show policy - reduced refund');
        adjustmentPercentage = -50; // 50% penalty for no-show
        exceptions.push('No-show penalty applied');
        break;
      case 'admin_force':
        appliedPolicies.push('Admin override - full refund policy');
        adjustmentPercentage = 0; // No adjustment for admin overrides
        notes.push('Admin override allows full refund regardless of timing');
        break;
    }

    // Apply refund preference rules
    if (refundPreference) {
      switch (refundPreference) {
        case 'full_refund':
          if (eligibilityResult.refundPercentage < 100) {
            appliedPolicies.push('Customer requested full refund');
            notes.push('Customer preference noted - may require manual review');
          }
          break;
        case 'partial_refund':
          appliedPolicies.push('Customer accepts partial refund');
          break;
        case 'no_refund':
          appliedPolicies.push('Customer waives refund');
          adjustmentPercentage = -100; // No refund
          break;
      }
    }

    // Apply Korean business hours consideration
    const currentTime = new Date();
    if (isKoreanBusinessHours(currentTime)) {
      notes.push('Refund processed during Korean business hours');
    } else {
      notes.push('Refund processed outside Korean business hours');
    }

    return {
      appliedPolicies,
      exceptions,
      notes,
      adjustmentPercentage
    };
  }

  /**
   * Calculate final refund percentage after applying business rules
   */
  private calculateFinalRefundPercentage(
    basePercentage: number,
    businessRules: {
      adjustmentPercentage: number;
      appliedPolicies: string[];
      exceptions: string[];
      notes: string[];
    }
  ): number {
    let finalPercentage = basePercentage + businessRules.adjustmentPercentage;
    
    // Ensure percentage is within valid range
    finalPercentage = Math.max(0, Math.min(100, finalPercentage));
    
    return finalPercentage;
  }

  /**
   * Calculate processing time based on cancellation timing and type
   */
  private calculateProcessingTime(
    hoursUntilReservation: number,
    cancellationType: string
  ): string {
    if (cancellationType === 'admin_force') {
      return 'Immediate (Admin Override)';
    }
    
    if (hoursUntilReservation >= 48) {
      return '1-2 business days';
    } else if (hoursUntilReservation >= 24) {
      return '2-3 business days';
    } else if (hoursUntilReservation >= 12) {
      return '3-5 business days';
    } else {
      return '5-7 business days';
    }
  }

  /**
   * Generate comprehensive refund reason
   */
  private generateRefundReason(
    eligibilityResult: RefundEligibilityResult,
    businessRules: {
      appliedPolicies: string[];
      exceptions: string[];
      notes: string[];
    }
  ): string {
    let reason = eligibilityResult.reason;
    
    if (businessRules.exceptions.length > 0) {
      reason += ` Exceptions: ${businessRules.exceptions.join(', ')}.`;
    }
    
    if (businessRules.notes.length > 0) {
      reason += ` Notes: ${businessRules.notes.join(', ')}.`;
    }
    
    return reason;
  }

  /**
   * Create refund audit record
   */
  private async createRefundAuditRecord(params: {
    reservationId: string;
    userId: string;
    refundAmount: number;
    refundPercentage: number;
    cancellationType: string;
    reason?: string;
    transactionId?: string;
    refundStatus: string;
    koreanTimeInfo: {
      currentTime: string;
      reservationTime: string;
      timeZone: string;
    };
  }): Promise<void> {
    try {
      await this.supabase
        .from('refund_audit_log')
        .insert({
          reservation_id: params.reservationId,
          user_id: params.userId,
          refund_amount: params.refundAmount,
          refund_percentage: params.refundPercentage,
          cancellation_type: params.cancellationType,
          reason: params.reason,
          transaction_id: params.transactionId,
          refund_status: params.refundStatus,
          korean_current_time: params.koreanTimeInfo.currentTime,
          korean_reservation_time: params.koreanTimeInfo.reservationTime,
          timezone: params.koreanTimeInfo.timeZone,
          created_at: formatKoreanDateTime(getCurrentKoreanTime())
        });

      logger.info('Refund audit record created', {
        reservationId: params.reservationId,
        refundAmount: params.refundAmount,
        refundStatus: params.refundStatus
      });

    } catch (error) {
      logger.error('Failed to create refund audit record', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservationId
      });
      // Don't throw - audit failure shouldn't break refund processing
    }
  }

  /**
   * Get refund history for a reservation
   */
  async getRefundHistory(reservationId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('refund_audit_log')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch refund history: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      logger.error('Error fetching refund history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId
      });
      throw error;
    }
  }

  /**
   * Validate refund eligibility for a reservation
   */
  async validateRefundEligibility(
    reservationId: string,
    userId: string,
    cancellationType: string
  ): Promise<RefundEligibilityResult> {
    try {
      const reservation = await this.getReservationDetails(reservationId);
      
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.user_id !== userId) {
        throw new Error('User does not own this reservation');
      }

      return calculateRefundEligibility(
        new Date(reservation.reservation_date),
        reservation.reservation_time,
        getCurrentKoreanTime()
      );

    } catch (error) {
      logger.error('Error validating refund eligibility', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        userId
      });
      throw error;
    }
  }
}

// Export singleton instance
export const timezoneRefundService = new TimezoneRefundService();
