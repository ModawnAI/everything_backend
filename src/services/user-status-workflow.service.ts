/**
 * User Status Workflow Service
 * 
 * Handles automated user status workflow triggers including:
 * - Scheduled auto-transition processing
 * - Violation-based status changes
 * - Inactivity detection and processing
 * - Status change notifications
 */

import { getSupabaseClient } from '../config/database';
import { userStatusService } from './user-status.service';
import { logger } from '../utils/logger';
import { UserStatus } from '../types/database.types';

// Workflow trigger types
export interface WorkflowTrigger {
  id: string;
  type: 'violation_check' | 'inactivity_check' | 'suspension_expiry' | 'auto_restoration';
  userId: string;
  triggerDate: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: Record<string, any>;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

// Auto-transition rule
export interface AutoTransitionRule {
  id: string;
  name: string;
  description: string;
  trigger: 'violation_count' | 'inactivity_days' | 'suspension_expiry' | 'critical_violation';
  conditions: {
    violationCount?: number;
    inactivityDays?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    timeWindow?: number; // days
  };
  action: {
    newStatus: UserStatus;
    duration?: number; // days for temporary suspensions
    reason: string;
    notificationRequired: boolean;
  };
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserStatusWorkflowService {
  private supabase = getSupabaseClient();
  private isProcessing = false;

  // Default auto-transition rules
  private readonly defaultRules: AutoTransitionRule[] = [
    {
      id: 'multiple_violations',
      name: 'Multiple Violations Rule',
      description: 'Automatically suspend users with 3+ medium violations in 30 days',
      trigger: 'violation_count',
      conditions: {
        violationCount: 3,
        severity: 'medium',
        timeWindow: 30
      },
      action: {
        newStatus: 'suspended',
        duration: 7,
        reason: '자동 정지: 다중 위반으로 인한 계정 정지',
        notificationRequired: true
      },
      enabled: true,
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'critical_violation',
      name: 'Critical Violation Rule',
      description: 'Automatically suspend users with critical violations',
      trigger: 'critical_violation',
      conditions: {
        severity: 'critical'
      },
      action: {
        newStatus: 'suspended',
        duration: 30,
        reason: '자동 정지: 심각한 위반으로 인한 계정 정지',
        notificationRequired: true
      },
      enabled: true,
      priority: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'inactivity_check',
      name: 'Inactivity Check Rule',
      description: 'Mark users as inactive after 365 days of inactivity',
      trigger: 'inactivity_days',
      conditions: {
        inactivityDays: 365
      },
      action: {
        newStatus: 'inactive',
        reason: '자동 비활성화: 장기간 미사용으로 인한 계정 비활성화',
        notificationRequired: false
      },
      enabled: true,
      priority: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'suspension_expiry',
      name: 'Suspension Expiry Rule',
      description: 'Automatically restore users when suspension expires',
      trigger: 'suspension_expiry',
      conditions: {},
      action: {
        newStatus: 'active',
        reason: '자동 복구: 정지 기간 만료로 인한 계정 복구',
        notificationRequired: true
      },
      enabled: true,
      priority: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  /**
   * Process all pending workflow triggers
   */
  async processWorkflowTriggers(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Workflow processing already in progress, skipping');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      logger.info('Starting workflow trigger processing');

      // Process violation-based triggers
      await this.processViolationTriggers();

      // Process inactivity triggers
      await this.processInactivityTriggers();

      // Process suspension expiry triggers
      await this.processSuspensionExpiryTriggers();

      // Process auto-restoration triggers
      await this.processAutoRestorationTriggers();

      const processingTime = Date.now() - startTime;
      logger.info('Workflow trigger processing completed', {
        processingTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error processing workflow triggers:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process violation-based triggers
   */
  private async processViolationTriggers(): Promise<void> {
    try {
      // Get users with recent violations
      const { data: violations, error } = await this.supabase
        .from('user_violations')
        .select('user_id, violation_type, severity, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching violations for workflow processing:', error);
        return;
      }

      // Group violations by user
      const userViolations = new Map<string, any[]>();
      violations?.forEach(violation => {
        if (!userViolations.has(violation.user_id)) {
          userViolations.set(violation.user_id, []);
        }
        userViolations.get(violation.user_id)!.push(violation);
      });

      // Process each user's violations
      for (const [userId, userViolationsList] of userViolations) {
        await this.processUserViolations(userId, userViolationsList);
      }

    } catch (error) {
      logger.error('Error processing violation triggers:', error);
    }
  }

  /**
   * Process violations for a specific user
   */
  private async processUserViolations(userId: string, violations: any[]): Promise<void> {
    try {
      // Check for critical violations
      const criticalViolations = violations.filter(v => v.severity === 'critical');
      if (criticalViolations.length > 0) {
        await this.applyAutoTransition(userId, 'critical_violation');
        return;
      }

      // Check for multiple medium violations
      const mediumViolations = violations.filter(v => 
        v.severity === 'medium' && 
        new Date(v.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      if (mediumViolations.length >= 3) {
        await this.applyAutoTransition(userId, 'multiple_violations');
        return;
      }

    } catch (error) {
      logger.error('Error processing user violations:', { userId, error });
    }
  }

  /**
   * Process inactivity triggers
   */
  private async processInactivityTriggers(): Promise<void> {
    try {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      const { data: inactiveUsers, error } = await this.supabase
        .from('users')
        .select('id, last_login_at, user_status')
        .eq('user_status', 'active')
        .lt('last_login_at', oneYearAgo.toISOString());

      if (error) {
        logger.error('Error fetching inactive users:', error);
        return;
      }

      for (const user of inactiveUsers || []) {
        await this.applyAutoTransition(user.id, 'inactivity_check');
      }

    } catch (error) {
      logger.error('Error processing inactivity triggers:', error);
    }
  }

  /**
   * Process suspension expiry triggers
   */
  private async processSuspensionExpiryTriggers(): Promise<void> {
    try {
      const now = new Date();

      const { data: expiredSuspensions, error } = await this.supabase
        .from('users')
        .select('id, suspended_until, user_status')
        .eq('user_status', 'suspended')
        .lt('suspended_until', now.toISOString());

      if (error) {
        logger.error('Error fetching expired suspensions:', error);
        return;
      }

      for (const user of expiredSuspensions || []) {
        await this.applyAutoTransition(user.id, 'suspension_expiry');
      }

    } catch (error) {
      logger.error('Error processing suspension expiry triggers:', error);
    }
  }

  /**
   * Process auto-restoration triggers
   */
  private async processAutoRestorationTriggers(): Promise<void> {
    try {
      // This could include automatic restoration based on other criteria
      // For now, we'll focus on suspension expiry
      logger.info('Auto-restoration triggers processed');

    } catch (error) {
      logger.error('Error processing auto-restoration triggers:', error);
    }
  }

  /**
   * Apply auto-transition based on trigger type
   */
  private async applyAutoTransition(userId: string, triggerType: string): Promise<void> {
    try {
      const rule = this.defaultRules.find(r => r.id === triggerType);
      if (!rule || !rule.enabled) {
        return;
      }

      // Get current user status
      const { data: user, error } = await this.supabase
        .from('users')
        .select('user_status')
        .eq('id', userId)
        .single();

      if (error || !user) {
        logger.error('Error fetching user for auto-transition:', { userId, error });
        return;
      }

      // Don't apply if user is already in target status
      if (user.user_status === rule.action.newStatus) {
        return;
      }

      // Apply the status change
      const statusChangeRequest: any = {
        userId,
        newStatus: rule.action.newStatus,
        reason: rule.action.reason
      };

      if (rule.action.duration) {
        statusChangeRequest.effectiveDate = new Date(Date.now() + rule.action.duration * 24 * 60 * 60 * 1000).toISOString();
      }

      await userStatusService.changeUserStatus(statusChangeRequest);

      logger.info('Auto-transition applied successfully', {
        userId,
        triggerType,
        newStatus: rule.action.newStatus,
        reason: rule.action.reason
      });

    } catch (error) {
      logger.error('Error applying auto-transition:', { userId, triggerType, error });
    }
  }

  /**
   * Schedule a workflow trigger
   */
  async scheduleTrigger(trigger: Omit<WorkflowTrigger, 'id' | 'createdAt'>): Promise<WorkflowTrigger> {
    try {
      const { data, error } = await this.supabase
        .from('user_status_workflow_triggers')
        .insert({
          ...trigger,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to schedule trigger: ${error.message}`);
      }

      return data as WorkflowTrigger;

    } catch (error) {
      logger.error('Error scheduling workflow trigger:', { trigger, error });
      throw error;
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(): Promise<{
    totalTriggers: number;
    pendingTriggers: number;
    processedToday: number;
    failedToday: number;
    autoTransitions: Record<string, number>;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: triggers, error } = await this.supabase
        .from('user_status_workflow_triggers')
        .select('*')
        .gte('created_at', today.toISOString());

      if (error) {
        logger.error('Error fetching workflow stats:', error);
        return {
          totalTriggers: 0,
          pendingTriggers: 0,
          processedToday: 0,
          failedToday: 0,
          autoTransitions: {}
        };
      }

      const processedToday = triggers?.filter(t => t.status === 'completed').length || 0;
      const failedToday = triggers?.filter(t => t.status === 'failed').length || 0;
      const pendingTriggers = triggers?.filter(t => t.status === 'pending').length || 0;

      return {
        totalTriggers: triggers?.length || 0,
        pendingTriggers,
        processedToday,
        failedToday,
        autoTransitions: {
          'multiple_violations': 0,
          'critical_violation': 0,
          'inactivity_check': 0,
          'suspension_expiry': 0
        }
      };

    } catch (error) {
      logger.error('Error getting workflow stats:', error);
      throw error;
    }
  }
}

export const userStatusWorkflowService = new UserStatusWorkflowService(); 