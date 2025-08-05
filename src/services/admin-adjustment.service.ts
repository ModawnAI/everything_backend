/**
 * Admin Adjustment Service
 * 
 * Comprehensive admin point adjustment system with:
 * - Point adjustment capabilities (add/subtract/expire)
 * - Comprehensive audit logging
 * - Approval workflows for large adjustments
 * - Multi-level authorization
 * - Adjustment reason categorization and validation
 * - Audit trail viewing and filtering
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { 
  AdminActionType, 
  PointTransactionType, 
  PointStatus,
  User 
} from '../types/database.types';

export interface PointAdjustmentRequest {
  userId: string;
  amount: number;
  reason: string;
  adjustmentType: 'add' | 'subtract' | 'expire';
  category: PointAdjustmentCategory;
  adminId: string;
  requiresApproval?: boolean | undefined;
  approvalLevel?: number | undefined;
  notes?: string | undefined;
}

export interface PointAdjustmentResponse {
  id: string;
  userId: string;
  amount: number;
  adjustmentType: 'add' | 'subtract' | 'expire';
  reason: string;
  category: PointAdjustmentCategory;
  previousBalance: number;
  newBalance: number;
  adjustedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approvalLevel?: number;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  transactionId?: string;
  auditLogId: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  actionType: AdminActionType;
  targetType: string;
  targetId: string;
  reason: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AuditLogFilter {
  adminId?: string | undefined;
  actionType?: AdminActionType | undefined;
  targetType?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  reason?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  totalCount: number;
  hasMore: boolean;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type PointAdjustmentCategory = 
  | 'customer_service' 
  | 'system_error' 
  | 'fraud_prevention' 
  | 'promotional' 
  | 'compensation' 
  | 'technical_issue' 
  | 'other';

export interface ApprovalWorkflow {
  threshold: number;
  requiredLevel: number;
  autoApproval: boolean;
  notificationRecipients: string[];
}

export class AdminAdjustmentService {
  private supabase = getSupabaseClient();

  // Approval thresholds for different adjustment amounts
  private readonly approvalThresholds: ApprovalWorkflow[] = [
    { threshold: 10000, requiredLevel: 1, autoApproval: true, notificationRecipients: [] },
    { threshold: 50000, requiredLevel: 2, autoApproval: false, notificationRecipients: ['admin'] },
    { threshold: 100000, requiredLevel: 3, autoApproval: false, notificationRecipients: ['admin', 'super_admin'] },
    { threshold: Infinity, requiredLevel: 4, autoApproval: false, notificationRecipients: ['admin', 'super_admin', 'finance'] }
  ];

  /**
   * Adjust user points with comprehensive audit logging
   */
  async adjustUserPoints(request: PointAdjustmentRequest): Promise<PointAdjustmentResponse> {
    try {
      logger.info('Starting point adjustment', {
        userId: request.userId,
        amount: request.amount,
        adjustmentType: request.adjustmentType,
        adminId: request.adminId
      });

      // Validate request
      this.validateAdjustmentRequest(request);

      // Get user information
      const user = await this.getUser(request.userId);
      if (!user) {
        throw new Error(`User not found: ${request.userId}`);
      }

      // Get current balance
      const currentBalance = await this.getUserCurrentBalance(request.userId);

      // Determine if approval is required
      const approvalRequired = this.determineApprovalRequired(request.amount, request.requiresApproval);
      const approvalLevel = approvalRequired ? this.getRequiredApprovalLevel(request.amount) : undefined;

      // Create audit log entry
      const auditLog = await this.createAuditLogEntry({
        adminId: request.adminId,
        actionType: 'points_adjusted',
        targetType: 'user',
        targetId: request.userId,
        reason: request.reason,
        metadata: {
          amount: request.amount,
          adjustmentType: request.adjustmentType,
          category: request.category,
          previousBalance: currentBalance,
          approvalRequired,
          approvalLevel,
          notes: request.notes
        }
      });

      // Create adjustment record
      const adjustment = await this.createAdjustmentRecord({
        userId: request.userId,
        amount: request.amount,
        adjustmentType: request.adjustmentType,
        reason: request.reason,
        category: request.category,
        adminId: request.adminId,
        previousBalance: currentBalance,
        approvalRequired,
        approvalLevel: approvalLevel || undefined,
        notes: request.notes,
        auditLogId: auditLog.id
      });

      // If auto-approval is enabled, process immediately
      if (!approvalRequired || this.isAutoApproved(request.amount)) {
        return await this.processApprovedAdjustment(adjustment.id, request.adminId);
      }

      // Send approval notifications
      await this.sendApprovalNotifications(adjustment, approvalLevel);

      logger.info('Point adjustment created successfully', {
        adjustmentId: adjustment.id,
        approvalRequired,
        approvalLevel
      });

      return adjustment;

    } catch (error) {
      logger.error('Error adjusting user points', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Approve a pending adjustment
   */
  async approveAdjustment(
    adjustmentId: string, 
    approverId: string, 
    approverLevel: number,
    notes?: string
  ): Promise<PointAdjustmentResponse> {
    try {
      logger.info('Approving point adjustment', {
        adjustmentId,
        approverId,
        approverLevel
      });

      // Get adjustment record
      const adjustment = await this.getAdjustmentRecord(adjustmentId);
      if (!adjustment) {
        throw new Error(`Adjustment not found: ${adjustmentId}`);
      }

      if (adjustment.status !== 'pending') {
        throw new Error(`Adjustment is not pending: ${adjustment.status}`);
      }

      if (approverLevel < (adjustment.approvalLevel || 1)) {
        throw new Error(`Insufficient approval level. Required: ${adjustment.approvalLevel}, Provided: ${approverLevel}`);
      }

      // Process the approved adjustment
      const result = await this.processApprovedAdjustment(adjustmentId, approverId, notes);

      logger.info('Point adjustment approved successfully', {
        adjustmentId,
        approverId,
        approverLevel
      });

      return result;

    } catch (error) {
      logger.error('Error approving adjustment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adjustmentId,
        approverId
      });
      throw error;
    }
  }

  /**
   * Reject a pending adjustment
   */
  async rejectAdjustment(
    adjustmentId: string, 
    rejectorId: string, 
    reason: string
  ): Promise<PointAdjustmentResponse> {
    try {
      logger.info('Rejecting point adjustment', {
        adjustmentId,
        rejectorId,
        reason
      });

      // Get adjustment record
      const adjustment = await this.getAdjustmentRecord(adjustmentId);
      if (!adjustment) {
        throw new Error(`Adjustment not found: ${adjustmentId}`);
      }

      if (adjustment.status !== 'pending') {
        throw new Error(`Adjustment is not pending: ${adjustment.status}`);
      }

      // Update adjustment status
      const { data: updatedAdjustment, error } = await this.supabase
        .from('point_adjustments')
        .update({
          status: 'rejected',
          rejected_by: rejectorId,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', adjustmentId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to reject adjustment: ${error.message}`);
      }

      // Create audit log for rejection
      await this.createAuditLogEntry({
        adminId: rejectorId,
        actionType: 'points_adjusted',
        targetType: 'user',
        targetId: adjustment.user_id,
        reason: `Adjustment rejected: ${reason}`,
        metadata: {
          originalAdjustmentId: adjustmentId,
          originalAmount: adjustment.amount,
          rejectionReason: reason
        }
      });

      logger.info('Point adjustment rejected successfully', {
        adjustmentId,
        rejectorId,
        reason
      });

      return this.mapAdjustmentToResponse(updatedAdjustment);

    } catch (error) {
      logger.error('Error rejecting adjustment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adjustmentId,
        rejectorId
      });
      throw error;
    }
  }

  /**
   * Get audit log entries with filtering and pagination
   */
  async getAuditLogs(filter: AuditLogFilter): Promise<AuditLogResponse> {
    try {
      logger.info('Getting audit logs', { filter });

      let query = this.supabase
        .from('admin_actions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filter.adminId) {
        query = query.eq('admin_id', filter.adminId);
      }

      if (filter.actionType) {
        query = query.eq('action_type', filter.actionType);
      }

      if (filter.targetType) {
        query = query.eq('target_type', filter.targetType);
      }

      if (filter.startDate) {
        query = query.gte('created_at', filter.startDate);
      }

      if (filter.endDate) {
        query = query.lte('created_at', filter.endDate);
      }

      if (filter.reason) {
        query = query.ilike('reason', `%${filter.reason}%`);
      }

      // Apply pagination
      const page = filter.page || 1;
      const limit = filter.limit || 20;
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: entries, error, count } = await query;

      if (error) {
        throw new Error(`Failed to get audit logs: ${error.message}`);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      logger.info('Audit logs retrieved successfully', {
        entryCount: entries?.length || 0,
        totalCount,
        totalPages
      });

      return {
        entries: entries?.map(this.mapAuditLogToResponse) || [],
        totalCount,
        hasMore: page < totalPages,
        pagination: {
          page,
          limit,
          totalPages
        }
      };

    } catch (error) {
      logger.error('Error getting audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filter
      });
      throw error;
    }
  }

  /**
   * Get adjustment statistics
   */
  async getAdjustmentStats(startDate?: string, endDate?: string): Promise<{
    totalAdjustments: number;
    totalAmount: number;
    pendingAdjustments: number;
    approvedAdjustments: number;
    rejectedAdjustments: number;
    averageAmount: number;
    categoryBreakdown: Record<PointAdjustmentCategory, { count: number; amount: number }>;
  }> {
    try {
      logger.info('Getting adjustment statistics', { startDate, endDate });

      let query = this.supabase
        .from('point_adjustments')
        .select('*');

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: adjustments, error } = await query;

      if (error) {
        throw new Error(`Failed to get adjustment statistics: ${error.message}`);
      }

      const stats = {
        totalAdjustments: adjustments?.length || 0,
        totalAmount: 0,
        pendingAdjustments: 0,
        approvedAdjustments: 0,
        rejectedAdjustments: 0,
        averageAmount: 0,
        categoryBreakdown: {} as Record<PointAdjustmentCategory, { count: number; amount: number }>
      };

      // Initialize category breakdown
      const categories: PointAdjustmentCategory[] = [
        'customer_service', 'system_error', 'fraud_prevention', 
        'promotional', 'compensation', 'technical_issue', 'other'
      ];

      categories.forEach(category => {
        stats.categoryBreakdown[category] = { count: 0, amount: 0 };
      });

      // Calculate statistics
      for (const adjustment of adjustments || []) {
        stats.totalAmount += Math.abs(adjustment.amount);

        switch (adjustment.status) {
          case 'pending':
            stats.pendingAdjustments++;
            break;
          case 'approved':
          case 'completed':
            stats.approvedAdjustments++;
            break;
          case 'rejected':
            stats.rejectedAdjustments++;
            break;
        }

        const category = adjustment.category as PointAdjustmentCategory;
        if (stats.categoryBreakdown[category]) {
          stats.categoryBreakdown[category].count++;
          stats.categoryBreakdown[category].amount += Math.abs(adjustment.amount);
        }
      }

      stats.averageAmount = stats.totalAdjustments > 0 ? stats.totalAmount / stats.totalAdjustments : 0;

      logger.info('Adjustment statistics calculated', stats);

      return stats;

    } catch (error) {
      logger.error('Error getting adjustment statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Validate adjustment request
   */
  private validateAdjustmentRequest(request: PointAdjustmentRequest): void {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    if (!request.amount || request.amount === 0) {
      throw new Error('Amount must be non-zero');
    }

    if (!request.reason || request.reason.trim().length === 0) {
      throw new Error('Reason is required');
    }

    if (!request.category) {
      throw new Error('Category is required');
    }

    if (!request.adminId) {
      throw new Error('Admin ID is required');
    }

    // Validate amount based on adjustment type
    if (request.adjustmentType === 'add' && request.amount <= 0) {
      throw new Error('Add adjustments must have positive amount');
    }

    if (request.adjustmentType === 'subtract' && request.amount <= 0) {
      throw new Error('Subtract adjustments must have positive amount');
    }

    if (request.adjustmentType === 'expire' && request.amount <= 0) {
      throw new Error('Expire adjustments must have positive amount');
    }
  }

  /**
   * Determine if approval is required
   */
  private determineApprovalRequired(amount: number, requiresApproval?: boolean): boolean {
    if (requiresApproval !== undefined) {
      return requiresApproval;
    }

    const threshold = this.approvalThresholds.find(t => Math.abs(amount) <= t.threshold);
    return threshold ? !threshold.autoApproval : true;
  }

  /**
   * Get required approval level
   */
  private getRequiredApprovalLevel(amount: number): number {
    const threshold = this.approvalThresholds.find(t => Math.abs(amount) <= t.threshold);
    return threshold ? threshold.requiredLevel : 4;
  }

  /**
   * Check if adjustment is auto-approved
   */
  private isAutoApproved(amount: number): boolean {
    const threshold = this.approvalThresholds.find(t => Math.abs(amount) <= t.threshold);
    return threshold ? threshold.autoApproval : false;
  }

  /**
   * Create audit log entry
   */
  private async createAuditLogEntry(data: {
    adminId: string;
    actionType: AdminActionType;
    targetType: string;
    targetId: string;
    reason: string;
    metadata: Record<string, any>;
  }): Promise<AuditLogEntry> {
    const { data: auditLog, error } = await this.supabase
      .from('admin_actions')
      .insert({
        admin_id: data.adminId,
        action_type: data.actionType,
        target_type: data.targetType,
        target_id: data.targetId,
        reason: data.reason,
        metadata: data.metadata
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create audit log: ${error.message}`);
    }

    return this.mapAuditLogToResponse(auditLog);
  }

  /**
   * Create adjustment record
   */
  private async createAdjustmentRecord(data: {
    userId: string;
    amount: number;
    adjustmentType: 'add' | 'subtract' | 'expire';
    reason: string;
    category: PointAdjustmentCategory;
    adminId: string;
    previousBalance: number;
    approvalRequired: boolean;
    approvalLevel?: number | undefined;
    notes?: string | undefined;
    auditLogId: string;
  }): Promise<PointAdjustmentResponse> {
    const { data: adjustment, error } = await this.supabase
      .from('point_adjustments')
      .insert({
        user_id: data.userId,
        amount: data.amount,
        adjustment_type: data.adjustmentType,
        reason: data.reason,
        category: data.category,
        adjusted_by: data.adminId,
        previous_balance: data.previousBalance,
        status: data.approvalRequired ? 'pending' : 'completed',
        approval_level: data.approvalLevel,
        notes: data.notes,
        audit_log_id: data.auditLogId
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create adjustment record: ${error.message}`);
    }

    return this.mapAdjustmentToResponse(adjustment);
  }

  /**
   * Process approved adjustment
   */
  private async processApprovedAdjustment(
    adjustmentId: string, 
    approverId: string, 
    notes?: string
  ): Promise<PointAdjustmentResponse> {
    // Get adjustment record
    const adjustment = await this.getAdjustmentRecord(adjustmentId);
    if (!adjustment) {
      throw new Error(`Adjustment not found: ${adjustmentId}`);
    }

    // Calculate new balance
    let newBalance = adjustment.previous_balance;
    switch (adjustment.adjustment_type) {
      case 'add':
        newBalance += adjustment.amount;
        break;
      case 'subtract':
        newBalance -= adjustment.amount;
        break;
      case 'expire':
        // For expire, we don't change the balance but mark points as expired
        break;
    }

    // Create point transaction
    const transactionType: PointTransactionType = 'adjusted';
    const transactionAmount = adjustment.adjustment_type === 'add' ? adjustment.amount : -adjustment.amount;

    const { data: transaction, error: transactionError } = await this.supabase
      .from('point_transactions')
      .insert({
        user_id: adjustment.user_id,
        transaction_type: transactionType,
        amount: transactionAmount,
        description: `관리자 조정: ${adjustment.reason}`,
        status: 'available' as PointStatus,
        metadata: {
          adjustment_id: adjustmentId,
          adjusted_by: adjustment.adjusted_by,
          approved_by: approverId,
          category: adjustment.category,
          notes: notes
        }
      })
      .select()
      .single();

    if (transactionError) {
      throw new Error(`Failed to create point transaction: ${transactionError.message}`);
    }

    // Update user balance
    const { error: balanceError } = await this.supabase
      .from('users')
      .update({
        available_points: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', adjustment.user_id);

    if (balanceError) {
      throw new Error(`Failed to update user balance: ${balanceError.message}`);
    }

    // Update adjustment status
    const { data: updatedAdjustment, error: updateError } = await this.supabase
      .from('point_adjustments')
      .update({
        status: 'completed',
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        new_balance: newBalance,
        transaction_id: transaction.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', adjustmentId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update adjustment status: ${updateError.message}`);
    }

    return this.mapAdjustmentToResponse(updatedAdjustment);
  }

  /**
   * Get user current balance
   */
  private async getUserCurrentBalance(userId: string): Promise<number> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('available_points')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to get user balance: ${error.message}`);
    }

    return user?.available_points || 0;
  }

  /**
   * Get user information
   */
  private async getUser(userId: string): Promise<User | null> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to get user', {
        error: error.message,
        userId
      });
      return null;
    }

    return user;
  }

  /**
   * Get adjustment record
   */
  private async getAdjustmentRecord(adjustmentId: string): Promise<any> {
    const { data: adjustment, error } = await this.supabase
      .from('point_adjustments')
      .select('*')
      .eq('id', adjustmentId)
      .single();

    if (error) {
      throw new Error(`Failed to get adjustment record: ${error.message}`);
    }

    return adjustment;
  }

  /**
   * Send approval notifications
   */
  private async sendApprovalNotifications(adjustment: PointAdjustmentResponse, approvalLevel?: number): Promise<void> {
    // This would integrate with the notification system
    // For now, we'll just log the notification
    logger.info('Sending approval notifications', {
      adjustmentId: adjustment.id,
      approvalLevel,
      amount: adjustment.amount
    });
  }

  /**
   * Map database adjustment to response format
   */
  private mapAdjustmentToResponse(adjustment: any): PointAdjustmentResponse {
    return {
      id: adjustment.id,
      userId: adjustment.user_id,
      amount: adjustment.amount,
      adjustmentType: adjustment.adjustment_type,
      reason: adjustment.reason,
      category: adjustment.category,
      previousBalance: adjustment.previous_balance,
      newBalance: adjustment.new_balance || adjustment.previous_balance,
      adjustedBy: adjustment.adjusted_by,
      status: adjustment.status,
      approvalLevel: adjustment.approval_level,
      approvedBy: adjustment.approved_by,
      approvedAt: adjustment.approved_at,
      notes: adjustment.notes,
      createdAt: adjustment.created_at,
      transactionId: adjustment.transaction_id,
      auditLogId: adjustment.audit_log_id
    };
  }

  /**
   * Map database audit log to response format
   */
  private mapAuditLogToResponse(auditLog: any): AuditLogEntry {
    return {
      id: auditLog.id,
      adminId: auditLog.admin_id,
      actionType: auditLog.action_type,
      targetType: auditLog.target_type,
      targetId: auditLog.target_id,
      reason: auditLog.reason,
      metadata: auditLog.metadata,
      createdAt: auditLog.created_at
    };
  }
}

// Export singleton instance
export const adminAdjustmentService = new AdminAdjustmentService(); 