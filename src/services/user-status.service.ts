/**
 * User Status Management Service
 * 
 * Handles comprehensive user status management including:
 * - Status transition workflows
 * - Automated status change triggers
 * - Admin status management operations
 * - User notification system
 * - Status change audit logging
 */

import { getSupabaseClient } from '../config/database';
import { User, UserStatus } from '../types/database.types';
import { logger } from '../utils/logger';

// Status transition rules
export interface StatusTransitionRule {
  from: UserStatus;
  to: UserStatus[];
  requiresAdmin: boolean;
  requiresReason: boolean;
  autoTransition?: boolean;
  conditions?: {
    maxViolations?: number;
    timeThreshold?: number; // in days
    requiresApproval?: boolean;
  };
}

// Status change request
export interface StatusChangeRequest {
  userId: string;
  newStatus: UserStatus;
  reason: string;
  adminId?: string;
  effectiveDate?: string;
  notes?: string;
}

// Status change record
export interface StatusChangeRecord {
  id: string;
  user_id: string;
  previous_status: UserStatus;
  new_status: UserStatus;
  reason: string;
  admin_id?: string;
  effective_date: string;
  notes?: string;
  created_at: string;
}

// User violation record
export interface UserViolation {
  id: string;
  user_id: string;
  violation_type: 'spam' | 'inappropriate_content' | 'fraud' | 'harassment' | 'terms_violation' | 'payment_fraud';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence_url?: string;
  reported_by?: string;
  admin_id?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at?: string;
}

// Notification template
export interface StatusChangeNotification {
  userId: string;
  type: 'status_change' | 'violation_warning' | 'account_suspension' | 'account_restoration';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export class UserStatusService {
  private supabase = getSupabaseClient();

  // Status transition rules
  private readonly statusTransitions: StatusTransitionRule[] = [
    {
      from: 'active',
      to: ['inactive', 'suspended', 'deleted'],
      requiresAdmin: true,
      requiresReason: true
    },
    {
      from: 'inactive',
      to: ['active', 'suspended', 'deleted'],
      requiresAdmin: true,
      requiresReason: true
    },
    {
      from: 'suspended',
      to: ['active', 'deleted'],
      requiresAdmin: true,
      requiresReason: true
    },
    {
      from: 'deleted',
      to: ['active'],
      requiresAdmin: true,
      requiresReason: true,
      conditions: {
        requiresApproval: true
      }
    }
  ];

  // Auto-transition rules
  private readonly autoTransitionRules = [
    {
      trigger: 'multiple_violations',
      conditions: {
        violationCount: 3,
        timeWindow: 30, // days
        severity: 'medium'
      },
      action: {
        status: 'suspended' as UserStatus,
        duration: 7, // days
        reason: '자동 정지: 다중 위반으로 인한 계정 정지'
      }
    },
    {
      trigger: 'critical_violation',
      conditions: {
        severity: 'critical'
      },
      action: {
        status: 'suspended' as UserStatus,
        duration: 30, // days
        reason: '자동 정지: 심각한 위반으로 인한 계정 정지'
      }
    },
    {
      trigger: 'inactive_period',
      conditions: {
        inactiveDays: 365
      },
      action: {
        status: 'inactive' as UserStatus,
        reason: '자동 비활성화: 장기간 미사용으로 인한 계정 비활성화'
      }
    }
  ];

  /**
   * Change user status with workflow validation
   */
  async changeUserStatus(request: StatusChangeRequest): Promise<User> {
    try {
      // Get current user
      const currentUser = await this.getUserById(request.userId);
      if (!currentUser) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      // Validate status transition
      const isValidTransition = this.validateStatusTransition(
        currentUser.user_status,
        request.newStatus,
        request.adminId
      );

      if (!isValidTransition) {
        throw new Error(`상태 변경이 허용되지 않습니다: ${currentUser.user_status} → ${request.newStatus}`);
      }

      // Check if admin permission is required
      if (this.requiresAdminPermission(currentUser.user_status, request.newStatus) && !request.adminId) {
        throw new Error('관리자 권한이 필요한 상태 변경입니다.');
      }

      // Update user status
      const { data: updatedUser, error } = await this.supabase
        .from('users')
        .update({
          user_status: request.newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user status:', { request, error });
        throw new Error(`사용자 상태 업데이트 실패: ${error.message}`);
      }

      // Record status change
      await this.recordStatusChange({
        user_id: request.userId,
        previous_status: currentUser.user_status,
        new_status: request.newStatus,
        reason: request.reason,
        effective_date: request.effectiveDate || new Date().toISOString(),
        ...(request.adminId && { admin_id: request.adminId }),
        ...(request.notes && { notes: request.notes })
      });

      // Send notification
      await this.sendStatusChangeNotification(request.userId, currentUser.user_status, request.newStatus, request.reason);

      logger.info('User status changed successfully:', {
        userId: request.userId,
        from: currentUser.user_status,
        to: request.newStatus,
        reason: request.reason,
        adminId: request.adminId
      });

      return updatedUser;
    } catch (error) {
      logger.error('UserStatusService.changeUserStatus error:', { request, error });
      throw error;
    }
  }

  /**
   * Get user status history
   */
  async getUserStatusHistory(userId: string, limit: number = 20): Promise<StatusChangeRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_status_changes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching user status history:', { userId, error });
        throw new Error(`상태 변경 이력 조회 실패: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('UserStatusService.getUserStatusHistory error:', { userId, error });
      throw error;
    }
  }

  /**
   * Add user violation
   */
  async addUserViolation(violation: Omit<UserViolation, 'id' | 'created_at'>): Promise<UserViolation> {
    try {
      const { data, error } = await this.supabase
        .from('user_violations')
        .insert({
          ...violation,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding user violation:', { violation, error });
        throw new Error(`위반 기록 추가 실패: ${error.message}`);
      }

      // Check for auto-transition triggers
      await this.checkAutoTransitionTriggers(violation.user_id);

      logger.info('User violation added successfully:', { violation: data });
      return data;
    } catch (error) {
      logger.error('UserStatusService.addUserViolation error:', { violation, error });
      throw error;
    }
  }

  /**
   * Get user violations
   */
  async getUserViolations(userId: string, status?: string): Promise<UserViolation[]> {
    try {
      let query = this.supabase
        .from('user_violations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching user violations:', { userId, error });
        throw new Error(`위반 기록 조회 실패: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('UserStatusService.getUserViolations error:', { userId, error });
      throw error;
    }
  }

  /**
   * Resolve user violation
   */
  async resolveUserViolation(violationId: string, adminId: string, resolution: string): Promise<UserViolation> {
    try {
      const { data, error } = await this.supabase
        .from('user_violations')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', violationId)
        .select()
        .single();

      if (error) {
        logger.error('Error resolving user violation:', { violationId, error });
        throw new Error(`위반 해결 실패: ${error.message}`);
      }

      logger.info('User violation resolved successfully:', { violationId, adminId, resolution });
      return data;
    } catch (error) {
      logger.error('UserStatusService.resolveUserViolation error:', { violationId, error });
      throw error;
    }
  }

  /**
   * Get users by status
   */
  async getUsersByStatus(status: UserStatus, page: number = 1, limit: number = 20): Promise<{ users: User[]; total: number }> {
    try {
      const offset = (page - 1) * limit;

      const { data: users, error: usersError, count } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('user_status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (usersError) {
        logger.error('Error fetching users by status:', { status, error: usersError });
        throw new Error(`사용자 조회 실패: ${usersError.message}`);
      }

      return {
        users: users || [],
        total: count || 0
      };
    } catch (error) {
      logger.error('UserStatusService.getUsersByStatus error:', { status, error });
      throw error;
    }
  }

  /**
   * Bulk status change for admin
   */
  async bulkStatusChange(userIds: string[], newStatus: UserStatus, reason: string, adminId: string): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const userId of userIds) {
      try {
        await this.changeUserStatus({
          userId,
          newStatus,
          reason,
          adminId
        });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`User ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logger.info('Bulk status change completed:', { results, adminId });
    return results;
  }

  /**
   * Get status change statistics
   */
  async getStatusChangeStats(days: number = 30): Promise<Record<UserStatus, number>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('user_status_changes')
        .select('new_status')
        .gte('created_at', startDate.toISOString());

      if (error) {
        logger.error('Error fetching status change stats:', { error });
        throw new Error(`통계 조회 실패: ${error.message}`);
      }

      const stats: Record<UserStatus, number> = {
        active: 0,
        inactive: 0,
        suspended: 0,
        deleted: 0
      };

      data?.forEach(change => {
        stats[change.new_status as UserStatus]++;
      });

      return stats;
    } catch (error) {
      logger.error('UserStatusService.getStatusChangeStats error:', { error });
      throw error;
    }
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(from: UserStatus, to: UserStatus, adminId?: string): boolean {
    const transition = this.statusTransitions.find(t => t.from === from);
    if (!transition) {
      return false;
    }

    if (!transition.to.includes(to)) {
      return false;
    }

    if (transition.requiresAdmin && !adminId) {
      return false;
    }

    return true;
  }

  /**
   * Check if admin permission is required
   */
  private requiresAdminPermission(from: UserStatus, to: UserStatus): boolean {
    const transition = this.statusTransitions.find(t => t.from === from && t.to.includes(to));
    return transition?.requiresAdmin || false;
  }

  /**
   * Get user by ID
   */
  private async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user:', { userId, error });
      return null;
    }

    return data;
  }

  /**
   * Record status change
   */
  private async recordStatusChange(change: Omit<StatusChangeRecord, 'id' | 'created_at'>): Promise<void> {
    const { error } = await this.supabase
      .from('user_status_changes')
      .insert({
        ...change,
        created_at: new Date().toISOString()
      });

    if (error) {
      logger.error('Error recording status change:', { change, error });
      throw new Error(`상태 변경 기록 실패: ${error.message}`);
    }
  }

  /**
   * Check auto-transition triggers
   */
  private async checkAutoTransitionTriggers(userId: string): Promise<void> {
    try {
      const violations = await this.getUserViolations(userId);
      const user = await this.getUserById(userId);

      if (!user) return;

      // Check multiple violations rule
      const recentViolations = violations.filter(v => {
        const violationDate = new Date(v.created_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return violationDate > thirtyDaysAgo && v.severity === 'medium';
      });

      if (recentViolations.length >= 3) {
        await this.changeUserStatus({
          userId,
          newStatus: 'suspended',
          reason: '자동 정지: 다중 위반으로 인한 계정 정지',
          effectiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        });
        return;
      }

      // Check critical violation rule
      const criticalViolations = violations.filter(v => v.severity === 'critical' && v.status === 'reviewed');
      if (criticalViolations.length > 0) {
        await this.changeUserStatus({
          userId,
          newStatus: 'suspended',
          reason: '자동 정지: 심각한 위반으로 인한 계정 정지',
          effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        });
      }
    } catch (error) {
      logger.error('Error checking auto-transition triggers:', { userId, error });
    }
  }

  /**
   * Send status change notification
   */
  private async sendStatusChangeNotification(userId: string, fromStatus: UserStatus, toStatus: UserStatus, reason: string): Promise<void> {
    try {
      const notification: StatusChangeNotification = {
        userId,
        type: 'status_change',
        title: '계정 상태 변경 알림',
        message: `귀하의 계정 상태가 ${this.getStatusDisplayName(fromStatus)}에서 ${this.getStatusDisplayName(toStatus)}로 변경되었습니다.`,
        data: {
          fromStatus,
          toStatus,
          reason,
          timestamp: new Date().toISOString()
        },
        priority: toStatus === 'suspended' || toStatus === 'deleted' ? 'high' : 'medium'
      };

      // TODO: Integrate with notification service
      logger.info('Status change notification prepared:', { notification });
    } catch (error) {
      logger.error('Error sending status change notification:', { userId, error });
    }
  }

  /**
   * Get status display name
   */
  private getStatusDisplayName(status: UserStatus): string {
    const displayNames: Record<UserStatus, string> = {
      active: '활성',
      inactive: '비활성',
      suspended: '정지',
      deleted: '삭제'
    };
    return displayNames[status] || status;
  }
}

export const userStatusService = new UserStatusService(); 