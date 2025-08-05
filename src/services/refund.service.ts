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
}

// Export singleton instance
export const refundService = new RefundService(); 