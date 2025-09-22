/**
 * Refund Service
 * 
 * Comprehensive service for refund functionality including:
 * - Refund request creation and validation
 * - Automatic and manual refund processing
 * - Approval workflow management
 * - TossPayments refund integration
 * - Audit trail and reporting
 */

import { getSupabaseClient } from '../config/database';
import { tossPaymentsService } from './toss-payments.service';
import { logger } from '../utils/logger';
import { automatedRefundService } from './automated-refund.service';
import { 
  Refund, 
  RefundApproval, 
  RefundAuditLog,
  RefundPolicy,
  RefundType,
  RefundReason,
  RefundStatus,
  RefundMethod,
  ApprovalAction,
  AuditAction,
  RefundPolicyType
} from '../types/database.types';

export interface CreateRefundRequest {
  paymentId: string;
  userId: string;
  refundType: RefundType;
  refundReason: RefundReason;
  refundReasonDetails?: string;
  customerNotes?: string;
  refundMethod?: RefundMethod;
  bankCode?: string;
  accountNumber?: string;
  accountHolderName?: string;
}

export interface ProcessRefundRequest {
  refundId: string;
  adminId: string;
  approvedAmount?: number;
  adminNotes?: string;
  refundMethod?: RefundMethod;
  bankCode?: string;
  accountNumber?: string;
  accountHolderName?: string;
}

export interface RefundResponse {
  refundId: string;
  status: RefundStatus;
  requestedAmount: number;
  approvedAmount?: number | undefined;
  refundedAmount: number;
  refundMethod?: RefundMethod;
  providerRefundId?: string | undefined;
  message: string;
}

export interface RefundStatusResponse {
  refundId: string;
  paymentId: string;
  reservationId: string;
  userId: string;
  refundType: RefundType;
  refundReason: RefundReason;
  requestedAmount: number;
  approvedAmount?: number | undefined;
  refundedAmount: number;
  refundStatus: RefundStatus;
  refundMethod?: RefundMethod;
  requestedAt: string;
  approvedAt?: string | undefined;
  processedAt?: string | undefined;
  completedAt?: string | undefined;
  adminNotes?: string | undefined;
  customerNotes?: string | undefined;
  isEligibleForRefund: boolean;
  refundPolicy: RefundPolicy | null;
}

export interface RefundPolicyResponse {
  policyId: string;
  policyName: string;
  policyType: RefundPolicyType;
  refundPercentage: number;
  maxRefundAmount?: number | undefined;
  timeLimitHours?: number | undefined;
  requiresApproval: boolean;
  autoApproveForAdmin: boolean;
  isApplicable: boolean;
  calculatedAmount: number;
}

export interface DynamicRefundCalculationRequest {
  reservationId: string;
  userId: string;
  cancellationType: 'user_request' | 'shop_request' | 'no_show' | 'admin_force';
  cancellationReason?: string;
  refundPreference?: 'full_refund' | 'partial_refund' | 'no_refund';
  policyOverride?: {
    enabled: boolean;
    refundPercentage?: number;
    reason?: string;
    adminId?: string;
  };
}

export interface DynamicRefundCalculationResult {
  isEligible: boolean;
  refundAmount: number;
  refundPercentage: number;
  basePercentage: number;
  adjustmentPercentage: number;
  cancellationWindow: string;
  reason: string;
  policyApplied: string;
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
    policyOverride?: any;
  };
}

export class RefundService {
  private supabase = getSupabaseClient();

  /**
   * Create a new refund request
   */
  async createRefundRequest(request: CreateRefundRequest): Promise<RefundResponse> {
    const transactionId = `refund_create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Creating refund request', {
        transactionId,
        paymentId: request.paymentId,
        userId: request.userId,
        refundType: request.refundType,
        refundReason: request.refundReason
      });

      // Get payment details and validate ownership
      const payment = await this.getPaymentById(request.paymentId);
      if (!payment || payment.user_id !== request.userId) {
        throw new Error('Payment not found or unauthorized');
      }

      // Check if payment is eligible for refund
      const isEligible = await this.checkRefundEligibility(request.paymentId, request.refundType);
      if (!isEligible.eligible) {
        throw new Error(`Payment is not eligible for refund: ${isEligible.reason}`);
      }

      // Calculate refund amount based on policy
      const refundAmount = await this.calculateRefundAmount(request.paymentId, request.refundType);

      // Check if refund already exists for this payment
      const existingRefund = await this.getRefundByPaymentId(request.paymentId);
      if (existingRefund) {
        throw new Error('Refund request already exists for this payment');
      }

      // Create refund record
      const { data: refund, error: refundError } = await this.supabase
        .from('refunds')
        .insert({
          payment_id: request.paymentId,
          reservation_id: payment.reservation_id,
          user_id: request.userId,
          refund_type: request.refundType,
          refund_reason: request.refundReason,
          requested_amount: refundAmount,
          refund_status: 'pending',
          refund_reason_details: request.refundReasonDetails,
          customer_notes: request.customerNotes,
          refund_method: request.refundMethod,
          bank_code: request.bankCode,
          account_number: request.accountNumber,
          account_holder_name: request.accountHolderName
        })
        .select()
        .single();

      if (refundError) {
        throw new Error(`Failed to create refund: ${refundError.message}`);
      }

      // Check if automatic approval is possible
      const policy = await this.getApplicableRefundPolicy(request.paymentId, request.refundType);
      if (policy && !policy.requires_approval) {
        // Auto-approve the refund
        await this.approveRefund(refund.id, {
          adminId: 'system',
          approvedAmount: refundAmount,
          adminNotes: 'Automatic approval based on refund policy',
          refundMethod: request.refundMethod || 'automatic'
        });
      }

      logger.info('Refund request created successfully', {
        transactionId,
        refundId: refund.id,
        amount: refundAmount
      });

      return {
        refundId: refund.id,
        status: refund.refund_status,
        requestedAmount: refund.requested_amount,
        approvedAmount: refund.approved_amount,
        refundedAmount: refund.refunded_amount,
        refundMethod: refund.refund_method,
        message: 'Refund request created successfully'
      };

    } catch (error) {
      logger.error('Error creating refund request', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process refund approval/rejection
   */
  async processRefund(request: ProcessRefundRequest): Promise<RefundResponse> {
    const transactionId = `refund_process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Processing refund', {
        transactionId,
        refundId: request.refundId,
        adminId: request.adminId
      });

      // Get refund details
      const refund = await this.getRefundById(request.refundId);
      if (!refund) {
        throw new Error('Refund not found');
      }

      // Validate admin permissions
      const admin = await this.getUserById(request.adminId);
      if (!admin || admin.user_role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      // Validate refund status
      if (refund.refund_status !== 'pending') {
        throw new Error(`Refund cannot be processed in current status: ${refund.refund_status}`);
      }

      // Determine approved amount
      const approvedAmount = request.approvedAmount || refund.requested_amount;
      if (approvedAmount > refund.requested_amount) {
        throw new Error('Approved amount cannot exceed requested amount');
      }

      // Update refund with approval
      await this.approveRefund(refund.id, {
        adminId: request.adminId,
        approvedAmount,
        adminNotes: request.adminNotes,
        refundMethod: request.refundMethod,
        bankCode: request.bankCode,
        accountNumber: request.accountNumber,
        accountHolderName: request.accountHolderName
      });

      // Process the refund with TossPayments
      const refundResult = await this.processTossPaymentsRefund(refund.id);

      logger.info('Refund processed successfully', {
        transactionId,
        refundId: refund.id,
        approvedAmount,
        providerRefundId: refundResult.providerRefundId
      });

      return {
        refundId: refund.id,
        status: refundResult.status,
        requestedAmount: refund.requested_amount,
        approvedAmount,
        refundedAmount: refundResult.refundedAmount,
        refundMethod: refundResult.refundMethod,
        providerRefundId: refundResult.providerRefundId,
        message: 'Refund processed successfully'
      };

    } catch (error) {
      logger.error('Error processing refund', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get refund status and details
   */
  async getRefundStatus(refundId: string, userId: string): Promise<RefundStatusResponse> {
    try {
      const refund = await this.getRefundById(refundId);
      if (!refund || refund.user_id !== userId) {
        throw new Error('Refund not found or unauthorized');
      }

      const payment = await this.getPaymentById(refund.payment_id);
      const policy = await this.getApplicableRefundPolicy(refund.payment_id, refund.refund_type);
      const isEligible = await this.checkRefundEligibility(refund.payment_id, refund.refund_type);

      return {
        refundId: refund.id,
        paymentId: refund.payment_id,
        reservationId: refund.reservation_id,
        userId: refund.user_id,
        refundType: refund.refund_type,
        refundReason: refund.refund_reason,
        requestedAmount: refund.requested_amount,
        approvedAmount: refund.approved_amount,
        refundedAmount: refund.refunded_amount,
        refundStatus: refund.refund_status,
        refundMethod: refund.refund_method,
        requestedAt: refund.requested_at,
        approvedAt: refund.approved_at,
        processedAt: refund.processed_at,
        completedAt: refund.completed_at,
        adminNotes: refund.admin_notes,
        customerNotes: refund.customer_notes,
        isEligibleForRefund: isEligible.eligible,
        refundPolicy: policy
      };

    } catch (error) {
      logger.error('Error getting refund status', {
        refundId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get refund policy for a payment
   */
  async getRefundPolicy(paymentId: string, refundType: RefundType): Promise<RefundPolicyResponse> {
    try {
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      const policy = await this.getApplicableRefundPolicy(paymentId, refundType);
      if (!policy) {
        return {
          policyId: '',
          policyName: 'No Policy',
          policyType: refundType,
          refundPercentage: 0,
          requiresApproval: true,
          autoApproveForAdmin: false,
          isApplicable: false,
          calculatedAmount: 0
        };
      }

      const hoursSincePayment = this.calculateHoursSincePayment(payment.paid_at);
      const calculatedAmount = this.calculateRefundAmountFromPolicy(payment.amount, policy, hoursSincePayment);

      return {
        policyId: policy.id,
        policyName: policy.policy_name,
        policyType: policy.policy_type,
        refundPercentage: policy.refund_percentage,
        maxRefundAmount: policy.max_refund_amount,
        timeLimitHours: policy.time_limit_hours,
        requiresApproval: policy.requires_approval,
        autoApproveForAdmin: policy.auto_approve_for_admin,
        isApplicable: policy.is_active && (policy.time_limit_hours === null || hoursSincePayment <= policy.time_limit_hours),
        calculatedAmount
      };

    } catch (error) {
      logger.error('Error getting refund policy', {
        paymentId,
        refundType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get refund history for a user
   */
  async getUserRefundHistory(userId: string, limit: number = 20, offset: number = 0): Promise<Refund[]> {
    try {
      const { data, error } = await this.supabase
        .from('refunds')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get refund history: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting user refund history', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get pending refunds for admin approval
   */
  async getPendingRefunds(limit: number = 50, offset: number = 0): Promise<Refund[]> {
    try {
      const { data, error } = await this.supabase
        .from('refunds')
        .select(`
          *,
          payments!inner(amount, paid_at, payment_method),
          users!inner(name, email, phone_number),
          reservations!inner(reservation_datetime, total_amount)
        `)
        .eq('refund_status', 'pending')
        .order('requested_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get pending refunds: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting pending refunds', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private async getPaymentById(paymentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      throw new Error(`Failed to get payment: ${error.message}`);
    }

    return data;
  }

  private async getRefundById(refundId: string): Promise<Refund | null> {
    const { data, error } = await this.supabase
      .from('refunds')
      .select('*')
      .eq('id', refundId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get refund: ${error.message}`);
    }

    return data;
  }

  private async getRefundByPaymentId(paymentId: string): Promise<Refund | null> {
    const { data, error } = await this.supabase
      .from('refunds')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get refund: ${error.message}`);
    }

    return data;
  }

  private async getUserById(userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, user_role')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data;
  }

  private async checkRefundEligibility(paymentId: string, refundType: RefundType): Promise<{ eligible: boolean; reason?: string }> {
    try {
      const payment = await this.getPaymentById(paymentId);
      
      // Check if payment is paid
      if (payment.payment_status !== 'fully_paid') {
        return { eligible: false, reason: 'Payment is not fully paid' };
      }

      // Check if payment is within refund time limit
      const hoursSincePayment = this.calculateHoursSincePayment(payment.paid_at);
      const policy = await this.getApplicableRefundPolicy(paymentId, refundType);
      
      if (policy && policy.time_limit_hours && hoursSincePayment > policy.time_limit_hours) {
        return { eligible: false, reason: 'Payment is outside refund time limit' };
      }

      // Check if refund already exists
      const existingRefund = await this.getRefundByPaymentId(paymentId);
      if (existingRefund) {
        return { eligible: false, reason: 'Refund already exists for this payment' };
      }

      return { eligible: true };
    } catch (error) {
      return { eligible: false, reason: 'Error checking eligibility' };
    }
  }

  private async calculateRefundAmount(paymentId: string, refundType: RefundType): Promise<number> {
    const payment = await this.getPaymentById(paymentId);
    const policy = await this.getApplicableRefundPolicy(paymentId, refundType);
    
    if (!policy) {
      return 0;
    }

    const hoursSincePayment = this.calculateHoursSincePayment(payment.paid_at);
    return this.calculateRefundAmountFromPolicy(payment.amount, policy, hoursSincePayment);
  }

  private async getApplicableRefundPolicy(paymentId: string, refundType: RefundType): Promise<RefundPolicy | null> {
    const payment = await this.getPaymentById(paymentId);
    const hoursSincePayment = this.calculateHoursSincePayment(payment.paid_at);

    const { data, error } = await this.supabase
      .from('refund_policies')
      .select('*')
      .eq('policy_type', refundType)
      .eq('is_active', true)
      .or(`time_limit_hours.is.null,time_limit_hours.gte.${hoursSincePayment}`)
      .order('time_limit_hours', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get refund policy: ${error.message}`);
    }

    return data;
  }

  private calculateHoursSincePayment(paidAt: string): number {
    const paidDate = new Date(paidAt);
    const now = new Date();
    return (now.getTime() - paidDate.getTime()) / (1000 * 60 * 60);
  }

  private calculateRefundAmountFromPolicy(paymentAmount: number, policy: RefundPolicy, hoursSincePayment: number): number {
    if (!policy.is_active) {
      return 0;
    }

    if (policy.time_limit_hours && hoursSincePayment > policy.time_limit_hours) {
      return 0;
    }

    let refundAmount = (paymentAmount * policy.refund_percentage) / 100;

    if (policy.max_refund_amount && refundAmount > policy.max_refund_amount) {
      refundAmount = policy.max_refund_amount;
    }

    return Math.floor(refundAmount);
  }

  private async approveRefund(refundId: string, approval: {
    adminId: string;
    approvedAmount: number;
    adminNotes?: string;
    refundMethod?: RefundMethod;
    bankCode?: string;
    accountNumber?: string;
    accountHolderName?: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('refunds')
      .update({
        approved_amount: approval.approvedAmount,
        refund_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: approval.adminId,
        admin_notes: approval.adminNotes,
        refund_method: approval.refundMethod,
        bank_code: approval.bankCode,
        account_number: approval.accountNumber,
        account_holder_name: approval.accountHolderName,
        updated_at: new Date().toISOString()
      })
      .eq('id', refundId);

    if (error) {
      throw new Error(`Failed to approve refund: ${error.message}`);
    }

    // Create approval record
    await this.supabase
      .from('refund_approvals')
      .insert({
        refund_id: refundId,
        approver_id: approval.adminId,
        action: 'approved',
        amount: approval.approvedAmount,
        reason: 'Refund approved',
        notes: approval.adminNotes
      });
  }

  private async processTossPaymentsRefund(refundId: string): Promise<{
    status: RefundStatus;
    refundedAmount: number;
    refundMethod: RefundMethod;
    providerRefundId?: string;
  }> {
    const refund = await this.getRefundById(refundId);
    if (!refund) {
      throw new Error('Refund not found');
    }

    const payment = await this.getPaymentById(refund.payment_id);
    
    try {
      // Call TossPayments refund API
      const refundResult = await tossPaymentsService.cancelPayment(
        payment.provider_transaction_id,
        refund.refund_reason_details || 'Customer refund request',
        refund.approved_amount
      );

      // Update refund status
      await this.supabase
        .from('refunds')
        .update({
          refund_status: 'completed',
          refunded_amount: refund.approved_amount,
          processed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          provider_refund_id: `refund_${refundId}_${Date.now()}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', refundId);

      return {
        status: 'completed',
        refundedAmount: refund.approved_amount || 0,
        refundMethod: refund.refund_method || 'card_refund',
        providerRefundId: `refund_${refundId}_${Date.now()}`
      };

    } catch (error) {
      // Update refund status to failed
      await this.supabase
        .from('refunds')
        .update({
          refund_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', refundId);

      throw new Error(`TossPayments refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate dynamic refund amount with Korean timezone awareness and business rules
   */
  async calculateDynamicRefundAmount(request: DynamicRefundCalculationRequest): Promise<DynamicRefundCalculationResult> {
    try {
      logger.info('Calculating dynamic refund amount', {
        reservationId: request.reservationId,
        userId: request.userId,
        cancellationType: request.cancellationType,
        hasPolicyOverride: !!request.policyOverride?.enabled
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

      // Import Korean timezone utilities
      const { 
        calculateRefundEligibility, 
        getCurrentKoreanTime, 
        formatKoreanDateTime 
      } = await import('../utils/korean-timezone');

      // Calculate base refund eligibility using Korean timezone
      const eligibilityResult = calculateRefundEligibility(
        new Date(reservation.reservation_date),
        reservation.reservation_time,
        getCurrentKoreanTime()
      );

      // Apply business rules based on cancellation type
      const businessRules = this.applyDynamicBusinessRules(
        eligibilityResult,
        request.cancellationType,
        request.refundPreference,
        request.cancellationReason
      );

      // Handle policy override if enabled
      let finalRefundPercentage = this.calculateFinalRefundPercentage(
        eligibilityResult.refundPercentage,
        businessRules
      );

      let policyApplied = 'Standard Dynamic Policy';
      let adjustmentPercentage = businessRules.adjustmentPercentage;

      if (request.policyOverride?.enabled && request.policyOverride.refundPercentage !== undefined) {
        finalRefundPercentage = request.policyOverride.refundPercentage;
        policyApplied = 'Admin Override Policy';
        adjustmentPercentage = request.policyOverride.refundPercentage - eligibilityResult.refundPercentage;
        
        businessRules.appliedPolicies.push('Admin policy override applied');
        businessRules.notes.push(`Override reason: ${request.policyOverride.reason || 'Administrative override'}`);
        businessRules.notes.push(`Override by admin: ${request.policyOverride.adminId || 'Unknown'}`);
      }

      // Calculate final refund amount
      const baseRefundAmount = reservation.total_amount || 0;
      const refundAmount = Math.round((baseRefundAmount * finalRefundPercentage) / 100);

      const result: DynamicRefundCalculationResult = {
        isEligible: eligibilityResult.isEligible && finalRefundPercentage > 0,
        refundAmount,
        refundPercentage: finalRefundPercentage,
        basePercentage: eligibilityResult.refundPercentage,
        adjustmentPercentage,
        cancellationWindow: eligibilityResult.cancellationWindow,
        reason: this.generateDynamicRefundReason(eligibilityResult, businessRules, request.policyOverride),
        policyApplied,
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
          cancellationType: request.cancellationType,
          policyOverride: request.policyOverride
        }
      };

      logger.info('Dynamic refund calculation completed', {
        reservationId: request.reservationId,
        refundAmount: result.refundAmount,
        refundPercentage: result.refundPercentage,
        isEligible: result.isEligible,
        policyApplied: result.policyApplied
      });

      return result;

    } catch (error) {
      logger.error('Error calculating dynamic refund amount', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: request.reservationId,
        userId: request.userId
      });
      throw error;
    }
  }

  /**
   * Process dynamic refund with enhanced business rules and Korean timezone awareness
   */
  async processDynamicRefund(request: DynamicRefundCalculationRequest): Promise<RefundResponse> {
    try {
      logger.info('Processing dynamic refund', {
        reservationId: request.reservationId,
        userId: request.userId,
        cancellationType: request.cancellationType
      });

      // Calculate dynamic refund amount
      const refundCalculation = await this.calculateDynamicRefundAmount(request);

      if (!refundCalculation.isEligible || refundCalculation.refundAmount <= 0) {
        throw new Error(`Refund not eligible: ${refundCalculation.reason}`);
      }

      // Get payments for the reservation
      const { data: payments } = await this.supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', request.reservationId)
        .in('payment_status', ['deposit_paid', 'final_payment_paid', 'fully_paid']);

      if (!payments || payments.length === 0) {
        throw new Error('No paid payments found for this reservation');
      }

      // Process refunds for each payment
      const refundResults = [];
      for (const payment of payments) {
        try {
          // Create refund request for this payment
          const refundRequest: CreateRefundRequest = {
            paymentId: payment.id,
            userId: request.userId,
            refundType: this.mapCancellationTypeToRefundType(request.cancellationType),
            refundReason: this.mapCancellationReasonToRefundReason(request.cancellationReason),
            refundReasonDetails: request.cancellationReason || `Dynamic refund: ${request.cancellationType}`,
            customerNotes: `Dynamic refund calculation: ${refundCalculation.reason}`
          };

          // Create refund request
          const refundResponse = await this.createRefundRequest(refundRequest);
          refundResults.push(refundResponse);

          // If refund amount is calculated, update it with dynamic calculation
          if (refundCalculation.refundAmount > 0) {
            await this.supabase
              .from('refunds')
              .update({
                requested_amount: Math.round((payment.amount * refundCalculation.refundPercentage) / 100),
                refund_percentage: refundCalculation.refundPercentage,
                updated_at: new Date().toISOString()
              })
              .eq('id', refundResponse.refundId);
          }

        } catch (paymentRefundError) {
          logger.error('Failed to process refund for individual payment', {
            error: paymentRefundError instanceof Error ? paymentRefundError.message : 'Unknown error',
            paymentId: payment.id,
            reservationId: request.reservationId
          });
          // Continue with other payments
        }
      }

      // Create dynamic refund audit record
      await this.createDynamicRefundAuditRecord({
        reservationId: request.reservationId,
        userId: request.userId,
        refundCalculation,
        refundResults,
        cancellationType: request.cancellationType,
        cancellationReason: request.cancellationReason,
        policyOverride: request.policyOverride
      });

      logger.info('Dynamic refund processing completed', {
        reservationId: request.reservationId,
        refundAmount: refundCalculation.refundAmount,
        refundPercentage: refundCalculation.refundPercentage,
        refundsCreated: refundResults.length
      });

      return {
        refundId: refundResults[0]?.refundId || 'multiple',
        status: refundResults.length > 0 ? 'completed' : 'failed',
        requestedAmount: refundCalculation.refundAmount || 0,
        refundedAmount: refundResults.reduce((sum, r) => sum + (r.refundedAmount || 0), 0),
        message: refundResults.length > 0 ? 'Refund processed successfully' : 'Refund processing failed'
      };

    } catch (error) {
      logger.error('Error processing dynamic refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: request.reservationId,
        userId: request.userId
      });
      throw error;
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
   * Apply dynamic business rules based on cancellation type and preferences
   */
  private applyDynamicBusinessRules(
    eligibilityResult: any,
    cancellationType: string,
    refundPreference?: string,
    cancellationReason?: string
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
        
        // Apply reason-based adjustments
        if (cancellationReason?.toLowerCase().includes('emergency')) {
          adjustmentPercentage = 10; // 10% bonus for emergency cancellations
          notes.push('Emergency cancellation - enhanced refund rate applied');
        } else if (cancellationReason?.toLowerCase().includes('medical')) {
          adjustmentPercentage = 15; // 15% bonus for medical reasons
          notes.push('Medical cancellation - enhanced refund rate applied');
        }
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
        appliedPolicies.push('Admin override - configurable refund policy');
        adjustmentPercentage = 0; // No automatic adjustment for admin overrides
        notes.push('Admin override allows flexible refund policy');
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

    // Apply timing-based rules
    if (eligibilityResult.hoursUntilReservation >= 48) {
      notes.push('Early cancellation - maximum refund eligibility');
    } else if (eligibilityResult.hoursUntilReservation < 2) {
      exceptions.push('Last-minute cancellation - reduced refund eligibility');
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
    }
  ): number {
    let finalPercentage = basePercentage + businessRules.adjustmentPercentage;
    
    // Ensure percentage is within valid range
    finalPercentage = Math.max(0, Math.min(100, finalPercentage));
    
    return finalPercentage;
  }

  /**
   * Generate comprehensive refund reason
   */
  private generateDynamicRefundReason(
    eligibilityResult: any,
    businessRules: {
      appliedPolicies: string[];
      exceptions: string[];
      notes: string[];
    },
    policyOverride?: any
  ): string {
    let reason = eligibilityResult.reason;
    
    if (policyOverride?.enabled) {
      reason += ` Admin override applied: ${policyOverride.reason || 'Administrative decision'}.`;
    }
    
    if (businessRules.exceptions.length > 0) {
      reason += ` Exceptions: ${businessRules.exceptions.join(', ')}.`;
    }
    
    if (businessRules.notes.length > 0) {
      reason += ` Notes: ${businessRules.notes.join(', ')}.`;
    }
    
    return reason;
  }

  /**
   * Map cancellation type to refund type
   */
  private mapCancellationTypeToRefundType(cancellationType: string): RefundType {
    switch (cancellationType) {
      case 'user_request':
        return 'full';
      case 'shop_request':
        return 'full';
      case 'no_show':
        return 'partial';
      case 'admin_force':
        return 'full';
      default:
        return 'partial';
    }
  }

  /**
   * Map cancellation reason to refund reason
   */
  private mapCancellationReasonToRefundReason(cancellationReason?: string): RefundReason {
    if (!cancellationReason) {
      return 'customer_request';
    }

    const reason = cancellationReason.toLowerCase();
    
    if (reason.includes('emergency') || reason.includes('medical')) {
      return 'customer_request';
    } else if (reason.includes('schedule') || reason.includes('time')) {
      return 'customer_request';
    } else if (reason.includes('personal')) {
      return 'customer_request';
    } else if (reason.includes('shop') || reason.includes('business')) {
      return 'service_issue';
    } else {
      return 'customer_request';
    }
  }

  /**
   * Create dynamic refund audit record
   */
  private async createDynamicRefundAuditRecord(params: {
    reservationId: string;
    userId: string;
    refundCalculation: DynamicRefundCalculationResult;
    refundResults: RefundResponse[];
    cancellationType: string;
    cancellationReason?: string;
    policyOverride?: any;
  }): Promise<void> {
    try {
      const { formatKoreanDateTime, getCurrentKoreanTime } = await import('../utils/korean-timezone');
      
      await this.supabase
        .from('dynamic_refund_audit_log')
        .insert({
          reservation_id: params.reservationId,
          user_id: params.userId,
          refund_amount: params.refundCalculation.refundAmount,
          refund_percentage: params.refundCalculation.refundPercentage,
          base_percentage: params.refundCalculation.basePercentage,
          adjustment_percentage: params.refundCalculation.adjustmentPercentage,
          cancellation_type: params.cancellationType,
          cancellation_reason: params.cancellationReason,
          policy_applied: params.refundCalculation.policyApplied,
          policy_override: params.policyOverride,
          refund_window: params.refundCalculation.cancellationWindow,
          korean_current_time: params.refundCalculation.koreanTimeInfo.currentTime,
          korean_reservation_time: params.refundCalculation.koreanTimeInfo.reservationTime,
          timezone: params.refundCalculation.koreanTimeInfo.timeZone,
          business_rules: params.refundCalculation.businessRules,
          refund_ids: params.refundResults.map(r => r.refundId),
          created_at: formatKoreanDateTime(getCurrentKoreanTime())
        });

      logger.info('Dynamic refund audit record created', {
        reservationId: params.reservationId,
        refundAmount: params.refundCalculation.refundAmount,
        policyApplied: params.refundCalculation.policyApplied
      });

    } catch (error) {
      logger.error('Failed to create dynamic refund audit record', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservationId
      });
      // Don't throw - audit failure shouldn't break refund processing
    }
  }

  /**
   * Process automated refund with comprehensive business rule validation and point adjustments
   */
  async processAutomatedRefund(request: {
    reservationId: string;
    userId: string;
    refundType: 'full' | 'partial' | 'no_show' | 'cancellation';
    refundReason: string;
    refundAmount?: number;
    triggeredBy: 'user' | 'system' | 'admin';
    triggerReason?: string;
    adminId?: string;
    businessRuleOverride?: boolean;
  }) {
    return await automatedRefundService.processAutomatedRefund(request);
  }

  /**
   * Process automated no-show refunds for eligible reservations
   */
  async processNoShowRefunds() {
    return await automatedRefundService.processNoShowRefunds();
  }

  /**
   * Validate refund business rules for a reservation
   */
  async validateRefundBusinessRules(
    reservationId: string,
    refundType: 'full' | 'partial' | 'no_show' | 'cancellation',
    requestedAmount?: number
  ) {
    // Use database function for validation
    const { data: validation, error } = await this.supabase
      .rpc('validate_refund_business_rules', {
        p_reservation_id: reservationId,
        p_refund_type: refundType,
        p_requested_amount: requestedAmount
      });

    if (error) {
      throw new Error(`Failed to validate refund business rules: ${error.message}`);
    }

    return validation?.[0] || {
      can_refund: false,
      refund_percentage: 0,
      max_refund_amount: 0,
      policy_violations: ['Validation failed'],
      applied_rules: []
    };
  }

  /**
   * Process point adjustments for refunds using database function
   */
  async processRefundPointAdjustments(
    refundId: string,
    reservationId: string,
    userId: string,
    refundAmount: number,
    originalAmount: number
  ) {
    const { data: adjustments, error } = await this.supabase
      .rpc('process_refund_point_adjustments', {
        p_refund_id: refundId,
        p_reservation_id: reservationId,
        p_user_id: userId,
        p_refund_amount: refundAmount,
        p_original_amount: originalAmount
      });

    if (error) {
      throw new Error(`Failed to process point adjustments: ${error.message}`);
    }

    return adjustments?.[0] || {
      earned_points_reversed: 0,
      used_points_restored: 0,
      adjustment_count: 0
    };
  }

  /**
   * Queue reservation for no-show refund processing
   */
  async queueNoShowRefund(reservationId: string) {
    const { data: queued, error } = await this.supabase
      .rpc('queue_no_show_refund', {
        p_reservation_id: reservationId
      });

    if (error) {
      throw new Error(`Failed to queue no-show refund: ${error.message}`);
    }

    return queued || false;
  }

  /**
   * Get comprehensive refund audit trail
   */
  async getRefundAuditTrail(refundId: string) {
    const { data: auditLogs, error } = await this.supabase
      .from('refund_audit_logs')
      .select('*')
      .eq('refund_id', refundId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch refund audit trail: ${error.message}`);
    }

    return auditLogs || [];
  }

  /**
   * Get refund point adjustments summary
   */
  async getRefundPointAdjustments(refundId: string) {
    const { data: adjustments, error } = await this.supabase
      .from('refund_point_adjustments')
      .select('*')
      .eq('refund_id', refundId)
      .order('processed_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch refund point adjustments: ${error.message}`);
    }

    return adjustments || [];
  }

  /**
   * Get no-show refund queue status
   */
  async getNoShowRefundQueue(limit: number = 100) {
    const { data: queue, error } = await this.supabase
      .from('no_show_refund_queue')
      .select(`
        *,
        reservations!inner(
          reservation_date,
          total_amount,
          status,
          users!inner(name, email)
        )
      `)
      .in('processing_status', ['pending', 'processing'])
      .order('eligible_for_processing_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch no-show refund queue: ${error.message}`);
    }

    return queue || [];
  }
}

// Export singleton instance
export const refundService = new RefundService(); 