/**
 * Automated Refund Service
 * 
 * Comprehensive refund automation system with:
 * - Automated refund processing for TossPayments with proper API integration
 * - Point adjustment logic for refunds (reverse earned points, restore used points)
 * - Partial refund capabilities with proportional point adjustments
 * - Refund business rules validation (time limits, cancellation policies)
 * - Automated refund triggers for no-show cases
 * - Comprehensive refund audit trail and logging
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { tossPaymentsService } from './toss-payments.service';
import { pointService } from './point.service';
import { fifoPointUsageService } from './fifo-point-usage.service';
import { POINT_POLICY_V32, POINT_CALCULATIONS } from '../constants/point-policies';

export interface AutomatedRefundRequest {
  reservationId: string;
  userId: string;
  refundType: 'full' | 'partial' | 'no_show' | 'cancellation';
  refundReason: string;
  refundAmount?: number; // For partial refunds
  triggeredBy: 'user' | 'system' | 'admin';
  triggerReason?: string;
  adminId?: string;
  businessRuleOverride?: boolean;
}

export interface RefundPointAdjustment {
  userId: string;
  reservationId: string;
  earnedPointsToReverse: number;
  usedPointsToRestore: number;
  adjustmentReason: string;
  proportionalFactor: number; // For partial refunds
  transactions: Array<{
    transactionId: string;
    originalAmount: number;
    adjustedAmount: number;
    adjustmentType: 'reverse_earned' | 'restore_used';
  }>;
}

export interface RefundBusinessRuleValidation {
  isValid: boolean;
  canRefund: boolean;
  refundPercentage: number;
  maxRefundAmount: number;
  timeBasedRestrictions: {
    hoursUntilReservation: number;
    hoursSincePayment: number;
    withinCancellationWindow: boolean;
    penaltyApplied: boolean;
  };
  policyViolations: string[];
  appliedRules: Array<{
    ruleName: string;
    ruleType: 'time_based' | 'amount_based' | 'status_based';
    impact: string;
  }>;
}

export interface AutomatedRefundResult {
  success: boolean;
  refundId: string;
  originalAmount: number;
  refundedAmount: number;
  pointAdjustments: RefundPointAdjustment;
  businessRuleValidation: RefundBusinessRuleValidation;
  tossPaymentsRefundId?: string;
  processingTime: number;
  auditTrail: RefundAuditEntry[];
  error?: string;
}

export interface RefundAuditEntry {
  timestamp: string;
  action: string;
  actor: 'system' | 'user' | 'admin';
  actorId?: string;
  details: Record<string, any>;
  result: 'success' | 'failure' | 'warning';
}

export interface NoShowRefundTrigger {
  reservationId: string;
  userId: string;
  shopId: string;
  scheduledTime: string;
  gracePeridMinutes: number;
  autoRefundEnabled: boolean;
  refundPolicy: {
    noShowRefundPercentage: number;
    processingDelayHours: number;
    requiresConfirmation: boolean;
  };
}

export class AutomatedRefundService {
  private supabase = getSupabaseClient();
  
  // Business rule constants
  private readonly CANCELLATION_POLICIES = {
    FULL_REFUND_HOURS: 48, // 48 hours before reservation
    PARTIAL_REFUND_HOURS: 24, // 24 hours before reservation
    NO_REFUND_HOURS: 2, // 2 hours before reservation
    PARTIAL_REFUND_PERCENTAGE: 50,
    NO_SHOW_REFUND_PERCENTAGE: 0,
    DEPOSIT_REFUND_GRACE_HOURS: 72
  };

  private readonly NO_SHOW_SETTINGS = {
    GRACE_PERIOD_MINUTES: 30,
    AUTO_PROCESS_DELAY_HOURS: 2,
    DEFAULT_NO_SHOW_REFUND_PERCENTAGE: 0
  };

  /**
   * Process automated refund with comprehensive business rule validation
   */
  async processAutomatedRefund(request: AutomatedRefundRequest): Promise<AutomatedRefundResult> {
    const startTime = Date.now();
    const auditTrail: RefundAuditEntry[] = [];

    try {
      logger.info('Starting automated refund processing', {
        reservationId: request.reservationId,
        refundType: request.refundType,
        triggeredBy: request.triggeredBy
      });

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'refund_initiated',
        actor: request.triggeredBy,
        actorId: request.adminId || request.userId,
        details: { request },
        result: 'success'
      });

      // 1. Get reservation and payment details
      const reservationData = await this.getReservationWithPayments(request.reservationId);
      if (!reservationData) {
        throw new Error('Reservation not found');
      }

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'reservation_data_retrieved',
        actor: 'system',
        details: { 
          reservationId: request.reservationId,
          totalAmount: reservationData.total_amount,
          paymentCount: reservationData.payments?.length || 0
        },
        result: 'success'
      });

      // 2. Validate business rules
      const businessRuleValidation = await this.validateRefundBusinessRules(
        reservationData,
        request,
        auditTrail
      );

      if (!businessRuleValidation.canRefund && !request.businessRuleOverride) {
        throw new Error(`Refund not allowed: ${businessRuleValidation.policyViolations.join(', ')}`);
      }

      // 3. Calculate refund amount
      const refundAmount = this.calculateRefundAmount(
        reservationData,
        request,
        businessRuleValidation
      );

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'refund_amount_calculated',
        actor: 'system',
        details: { 
          originalAmount: reservationData.total_amount,
          calculatedRefund: refundAmount,
          refundPercentage: businessRuleValidation.refundPercentage
        },
        result: 'success'
      });

      // 4. Process point adjustments
      const pointAdjustments = await this.processPointAdjustments(
        reservationData,
        refundAmount,
        request,
        auditTrail
      );

      // 5. Process TossPayments refund
      let tossPaymentsRefundId: string | undefined;
      if (reservationData.payments && reservationData.payments.length > 0) {
        tossPaymentsRefundId = await this.processTossPaymentsRefunds(
          reservationData.payments,
          refundAmount,
          request.refundReason,
          auditTrail
        );
      }

      // 6. Create refund record
      const refundId = await this.createRefundRecord(
        reservationData,
        request,
        refundAmount,
        pointAdjustments,
        tossPaymentsRefundId,
        auditTrail
      );

      // 7. Update reservation status
      await this.updateReservationStatus(
        request.reservationId,
        request.refundType,
        auditTrail
      );

      const processingTime = Date.now() - startTime;

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'refund_completed',
        actor: 'system',
        details: { 
          refundId,
          processingTime,
          success: true
        },
        result: 'success'
      });

      logger.info('Automated refund processed successfully', {
        reservationId: request.reservationId,
        refundId,
        refundedAmount: refundAmount,
        processingTime
      });

      return {
        success: true,
        refundId,
        originalAmount: reservationData.total_amount,
        refundedAmount: refundAmount,
        pointAdjustments,
        businessRuleValidation,
        tossPaymentsRefundId,
        processingTime,
        auditTrail
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'refund_failed',
        actor: 'system',
        details: { error: errorMessage, processingTime },
        result: 'failure'
      });

      logger.error('Automated refund processing failed', {
        error: errorMessage,
        reservationId: request.reservationId,
        processingTime
      });

      return {
        success: false,
        refundId: '',
        originalAmount: 0,
        refundedAmount: 0,
        pointAdjustments: {
          userId: request.userId,
          reservationId: request.reservationId,
          earnedPointsToReverse: 0,
          usedPointsToRestore: 0,
          adjustmentReason: 'Refund failed',
          proportionalFactor: 0,
          transactions: []
        },
        businessRuleValidation: {
          isValid: false,
          canRefund: false,
          refundPercentage: 0,
          maxRefundAmount: 0,
          timeBasedRestrictions: {
            hoursUntilReservation: 0,
            hoursSincePayment: 0,
            withinCancellationWindow: false,
            penaltyApplied: false
          },
          policyViolations: [errorMessage],
          appliedRules: []
        },
        processingTime,
        auditTrail,
        error: errorMessage
      };
    }
  }

  /**
   * Process point adjustments for refunds (reverse earned points, restore used points)
   */
  private async processPointAdjustments(
    reservationData: any,
    refundAmount: number,
    request: AutomatedRefundRequest,
    auditTrail: RefundAuditEntry[]
  ): Promise<RefundPointAdjustment> {
    try {
      logger.info('Processing point adjustments for refund', {
        reservationId: request.reservationId,
        userId: request.userId,
        refundAmount
      });

      const proportionalFactor = refundAmount / reservationData.total_amount;
      const adjustmentTransactions: Array<{
        transactionId: string;
        originalAmount: number;
        adjustedAmount: number;
        adjustmentType: 'reverse_earned' | 'restore_used';
      }> = [];

      let earnedPointsToReverse = 0;
      let usedPointsToRestore = 0;

      // 1. Find and reverse earned points from this reservation
      const { data: earnedTransactions, error: earnedError } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('reservation_id', request.reservationId)
        .eq('user_id', request.userId)
        .in('transaction_type', ['earned_service', 'earned_referral'])
        .neq('status', 'cancelled');

      if (earnedError) {
        throw new Error(`Failed to fetch earned point transactions: ${earnedError.message}`);
      }

      if (earnedTransactions && earnedTransactions.length > 0) {
        for (const transaction of earnedTransactions) {
          const reversalAmount = Math.floor(transaction.amount * proportionalFactor);
          if (reversalAmount > 0) {
            // Create reversal transaction
            await pointService.deductPoints(
              request.userId,
              -reversalAmount, // Make it negative to subtract points
              'spent',
              'system',
              `환불로 인한 적립 포인트 차감: ${reversalAmount}포인트`
            );

            earnedPointsToReverse += reversalAmount;
            adjustmentTransactions.push({
              transactionId: transaction.id,
              originalAmount: transaction.amount,
              adjustedAmount: reversalAmount,
              adjustmentType: 'reverse_earned'
            });
          }
        }
      }

      // 2. Find and restore used points for this reservation
      const { data: usedTransactions, error: usedError } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('reservation_id', request.reservationId)
        .eq('user_id', request.userId)
        .eq('transaction_type', 'used_service')
        .eq('status', 'used');

      if (usedError) {
        throw new Error(`Failed to fetch used point transactions: ${usedError.message}`);
      }

      if (usedTransactions && usedTransactions.length > 0) {
        for (const transaction of usedTransactions) {
          const restorationAmount = Math.floor(Math.abs(transaction.amount) * proportionalFactor);
          if (restorationAmount > 0) {
            // Create restoration transaction
            await pointService.addPoints(
              request.userId,
              restorationAmount,
              'earned',
              'system',
              `환불로 인한 사용 포인트 복원: ${restorationAmount}포인트`
            );

            usedPointsToRestore += restorationAmount;
            adjustmentTransactions.push({
              transactionId: transaction.id,
              originalAmount: Math.abs(transaction.amount),
              adjustedAmount: restorationAmount,
              adjustmentType: 'restore_used'
            });
          }
        }
      }

      const pointAdjustments: RefundPointAdjustment = {
        userId: request.userId,
        reservationId: request.reservationId,
        earnedPointsToReverse,
        usedPointsToRestore,
        adjustmentReason: `Refund processing: ${request.refundReason}`,
        proportionalFactor,
        transactions: adjustmentTransactions
      };

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'point_adjustments_processed',
        actor: 'system',
        details: {
          earnedPointsReversed: earnedPointsToReverse,
          usedPointsRestored: usedPointsToRestore,
          transactionCount: adjustmentTransactions.length,
          proportionalFactor
        },
        result: 'success'
      });

      logger.info('Point adjustments processed successfully', {
        reservationId: request.reservationId,
        earnedPointsToReverse,
        usedPointsToRestore,
        proportionalFactor
      });

      return pointAdjustments;

    } catch (error) {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'point_adjustments_failed',
        actor: 'system',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        result: 'failure'
      });

      logger.error('Failed to process point adjustments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: request.reservationId
      });

      throw error;
    }
  }

  /**
   * Validate refund business rules (time limits, cancellation policies)
   */
  private async validateRefundBusinessRules(
    reservationData: any,
    request: AutomatedRefundRequest,
    auditTrail: RefundAuditEntry[]
  ): Promise<RefundBusinessRuleValidation> {
    try {
      const now = new Date();
      const reservationDate = new Date(reservationData.reservation_date);
      const paymentDate = new Date(reservationData.payments?.[0]?.paid_at || reservationData.created_at);

      const hoursUntilReservation = Math.max(0, Math.floor((reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
      const hoursSincePayment = Math.floor((now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60));

      const appliedRules: Array<{
        ruleName: string;
        ruleType: 'time_based' | 'amount_based' | 'status_based';
        impact: string;
      }> = [];

      const policyViolations: string[] = [];
      let refundPercentage = 100;
      let canRefund = true;

      // 1. Time-based validation
      let withinCancellationWindow = true;
      let penaltyApplied = false;

      if (request.refundType === 'cancellation') {
        if (hoursUntilReservation >= this.CANCELLATION_POLICIES.FULL_REFUND_HOURS) {
          refundPercentage = 100;
          appliedRules.push({
            ruleName: 'full_refund_window',
            ruleType: 'time_based',
            impact: '100% refund allowed'
          });
        } else if (hoursUntilReservation >= this.CANCELLATION_POLICIES.PARTIAL_REFUND_HOURS) {
          refundPercentage = this.CANCELLATION_POLICIES.PARTIAL_REFUND_PERCENTAGE;
          penaltyApplied = true;
          appliedRules.push({
            ruleName: 'partial_refund_window',
            ruleType: 'time_based',
            impact: `${refundPercentage}% refund with penalty`
          });
        } else if (hoursUntilReservation >= this.CANCELLATION_POLICIES.NO_REFUND_HOURS) {
          refundPercentage = 25; // Minimal refund for very late cancellation
          penaltyApplied = true;
          appliedRules.push({
            ruleName: 'late_cancellation_window',
            ruleType: 'time_based',
            impact: '25% refund with heavy penalty'
          });
        } else {
          refundPercentage = 0;
          canRefund = false;
          withinCancellationWindow = false;
          policyViolations.push('Cancellation too close to reservation time');
          appliedRules.push({
            ruleName: 'no_refund_window',
            ruleType: 'time_based',
            impact: 'No refund allowed'
          });
        }
      }

      // 2. Status-based validation
      if (reservationData.status === 'completed') {
        if (request.refundType !== 'no_show') {
          refundPercentage = Math.min(refundPercentage, 50); // Max 50% after completion
          appliedRules.push({
            ruleName: 'completed_service_penalty',
            ruleType: 'status_based',
            impact: 'Reduced refund for completed service'
          });
        }
      }

      if (reservationData.status === 'cancelled') {
        canRefund = false;
        policyViolations.push('Reservation already cancelled');
        appliedRules.push({
          ruleName: 'already_cancelled',
          ruleType: 'status_based',
          impact: 'No refund for already cancelled reservation'
        });
      }

      // 3. No-show specific rules
      if (request.refundType === 'no_show') {
        refundPercentage = this.NO_SHOW_SETTINGS.DEFAULT_NO_SHOW_REFUND_PERCENTAGE;
        appliedRules.push({
          ruleName: 'no_show_policy',
          ruleType: 'status_based',
          impact: 'No refund for no-show'
        });
      }

      // 4. Amount-based validation
      const maxRefundAmount = Math.floor(reservationData.total_amount * (refundPercentage / 100));

      if (request.refundAmount && request.refundAmount > maxRefundAmount) {
        policyViolations.push(`Requested amount exceeds maximum allowed refund of ${maxRefundAmount}`);
        appliedRules.push({
          ruleName: 'amount_limit_exceeded',
          ruleType: 'amount_based',
          impact: 'Refund amount capped at policy maximum'
        });
      }

      const validation: RefundBusinessRuleValidation = {
        isValid: policyViolations.length === 0,
        canRefund,
        refundPercentage,
        maxRefundAmount,
        timeBasedRestrictions: {
          hoursUntilReservation,
          hoursSincePayment,
          withinCancellationWindow,
          penaltyApplied
        },
        policyViolations,
        appliedRules
      };

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'business_rules_validated',
        actor: 'system',
        details: {
          validation,
          rulesApplied: appliedRules.length,
          violations: policyViolations.length
        },
        result: validation.isValid ? 'success' : 'warning'
      });

      return validation;

    } catch (error) {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'business_rule_validation_failed',
        actor: 'system',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        result: 'failure'
      });

      throw error;
    }
  }

  /**
   * Process automated refund triggers for no-show cases
   */
  async processNoShowRefunds(): Promise<void> {
    try {
      logger.info('Processing automated no-show refunds');

      const now = new Date();
      const cutoffTime = new Date(now.getTime() - (this.NO_SHOW_SETTINGS.AUTO_PROCESS_DELAY_HOURS * 60 * 60 * 1000));

      // Find reservations that are past their scheduled time + grace period + processing delay
      const { data: noShowReservations, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          payments!inner(*),
          shops!inner(no_show_refund_percentage, auto_refund_enabled)
        `)
        .eq('status', 'confirmed')
        .lt('reservation_date', cutoffTime.toISOString())
        .eq('shops.auto_refund_enabled', true);

      if (error) {
        throw new Error(`Failed to fetch no-show reservations: ${error.message}`);
      }

      if (!noShowReservations || noShowReservations.length === 0) {
        logger.info('No no-show reservations found for automated processing');
        return;
      }

      logger.info(`Found ${noShowReservations.length} no-show reservations for automated processing`);

      for (const reservation of noShowReservations) {
        try {
          await this.processAutomatedRefund({
            reservationId: reservation.id,
            userId: reservation.user_id,
            refundType: 'no_show',
            refundReason: 'Automated no-show refund processing',
            triggeredBy: 'system',
            triggerReason: 'No-show detected after grace period'
          });

          logger.info('No-show refund processed successfully', {
            reservationId: reservation.id,
            userId: reservation.user_id
          });

        } catch (refundError) {
          logger.error('Failed to process no-show refund', {
            error: refundError instanceof Error ? refundError.message : 'Unknown error',
            reservationId: reservation.id
          });
        }
      }

    } catch (error) {
      logger.error('Failed to process no-show refunds', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Private helper methods
   */

  private async getReservationWithPayments(reservationId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select(`
        *,
        payments(*),
        shops(refund_policy, no_show_refund_percentage, auto_refund_enabled)
      `)
      .eq('id', reservationId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch reservation: ${error.message}`);
    }

    return data;
  }

  private calculateRefundAmount(
    reservationData: any,
    request: AutomatedRefundRequest,
    businessRuleValidation: RefundBusinessRuleValidation
  ): number {
    if (request.refundAmount) {
      return Math.min(request.refundAmount, businessRuleValidation.maxRefundAmount);
    }

    return businessRuleValidation.maxRefundAmount;
  }

  private async processTossPaymentsRefunds(
    payments: any[],
    refundAmount: number,
    reason: string,
    auditTrail: RefundAuditEntry[]
  ): Promise<string> {
    try {
      let totalRefunded = 0;
      let lastRefundId = '';

      for (const payment of payments) {
        if (totalRefunded >= refundAmount) break;

        const paymentRefundAmount = Math.min(
          payment.amount,
          refundAmount - totalRefunded
        );

        if (paymentRefundAmount > 0) {
          const refundResult = await tossPaymentsService.cancelPayment(
            payment.id,
            reason,
            paymentRefundAmount
          );

          totalRefunded += paymentRefundAmount;
          lastRefundId = payment.id;

          auditTrail.push({
            timestamp: new Date().toISOString(),
            action: 'toss_payments_refund_processed',
            actor: 'system',
            details: {
              paymentId: payment.id,
              refundAmount: paymentRefundAmount,
              tossRefundId: lastRefundId
            },
            result: 'success'
          });
        }
      }

      return lastRefundId;

    } catch (error) {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'toss_payments_refund_failed',
        actor: 'system',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        result: 'failure'
      });

      throw error;
    }
  }

  private async createRefundRecord(
    reservationData: any,
    request: AutomatedRefundRequest,
    refundAmount: number,
    pointAdjustments: RefundPointAdjustment,
    tossPaymentsRefundId: string | undefined,
    auditTrail: RefundAuditEntry[]
  ): Promise<string> {
    const refundRecord = {
      id: crypto.randomUUID(),
      reservation_id: request.reservationId,
      user_id: request.userId,
      payment_id: reservationData.payments?.[0]?.id,
      refund_type: request.refundType,
      refund_reason: request.refundReason,
      requested_amount: reservationData.total_amount,
      approved_amount: refundAmount,
      refunded_amount: refundAmount,
      refund_status: 'completed',
      refund_method: 'original_payment',
      triggered_by: request.triggeredBy,
      admin_id: request.adminId,
      provider_refund_id: tossPaymentsRefundId,
      point_adjustments: pointAdjustments,
      audit_trail: auditTrail,
      created_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('refunds')
      .insert(refundRecord);

    if (error) {
      throw new Error(`Failed to create refund record: ${error.message}`);
    }

    return refundRecord.id;
  }

  private async updateReservationStatus(
    reservationId: string,
    refundType: string,
    auditTrail: RefundAuditEntry[]
  ): Promise<void> {
    let newStatus = 'cancelled';

    if (refundType === 'no_show') {
      newStatus = 'no_show';
    } else if (refundType === 'partial') {
      newStatus = 'partially_refunded';
    }

    const { error } = await this.supabase
      .from('reservations')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (error) {
      throw new Error(`Failed to update reservation status: ${error.message}`);
    }

    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'reservation_status_updated',
      actor: 'system',
      details: { reservationId, newStatus },
      result: 'success'
    });
  }
}

export const automatedRefundService = new AutomatedRefundService();

