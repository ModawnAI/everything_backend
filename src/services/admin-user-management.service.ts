import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import { UserRole, UserStatus } from '../types/database.types';
import { websocketService } from './websocket.service';

export interface UserSearchFilters {
  search?: string; // Search in name, email, phone_number
  role?: UserRole;
  status?: UserStatus;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  isInfluencer?: boolean;
  phoneVerified?: boolean;
  startDate?: string; // Created date range
  endDate?: string;
  lastLoginStart?: string; // Last login date range
  lastLoginEnd?: string;
  hasReferrals?: boolean;
  minPoints?: number;
  maxPoints?: number;
  sortBy?: 'created_at' | 'name' | 'email' | 'last_login_at' | 'total_points' | 'total_referrals';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UserManagementResponse {
  users: Array<{
    id: string;
    email?: string;
    phoneNumber?: string;
    phoneVerified: boolean;
    name: string;
    nickname?: string;
    gender?: string;
    birthDate?: string;
    userRole: UserRole;
    userStatus: UserStatus;
    isInfluencer: boolean;
    influencerQualifiedAt?: string;
    socialProvider?: string;
    referralCode?: string;
    referredByCode?: string;
    totalPoints: number;
    availablePoints: number;
    totalReferrals: number;
    successfulReferrals: number;
    lastLoginAt?: string;
    lastLoginIp?: string;
    termsAcceptedAt?: string;
    privacyAcceptedAt?: string;
    marketingConsent: boolean;
    createdAt: string;
    updatedAt: string;
    // Additional computed fields
    daysSinceLastLogin?: number;
    isActive: boolean;
    hasCompletedProfile: boolean;
  }>;
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  filters: UserSearchFilters;
}

export interface UserStatusUpdateRequest {
  status: UserStatus;
  reason?: string;
  adminNotes?: string;
  notifyUser?: boolean;
}

export interface UserStatusUpdateResponse {
  success: boolean;
  user: {
    id: string;
    email?: string;
    name: string;
    previousStatus: UserStatus;
    newStatus: UserStatus;
    updatedAt: string;
  };
  action: {
    type: 'status_update';
    reason?: string;
    adminNotes?: string;
    performedBy: string;
    performedAt: string;
  };
}

export interface UserBulkActionRequest {
  userIds: string[];
  action: 'activate' | 'suspend' | 'delete' | 'export' | 'change_role';
  reason?: string;
  adminNotes?: string;
  // Additional parameters for specific actions
  targetRole?: UserRole; // For change_role action
  useTransaction?: boolean; // Whether to use database transactions (default: true)
  batchSize?: number; // Process in batches (default: 50)
}

export interface UserBulkActionResult {
  userId: string;
  success: boolean;
  error?: string;
  previousValue?: any; // Previous status/role for rollback
  newValue?: any; // New status/role
  timestamp: string;
}

export interface UserBulkActionResponse {
  success: boolean;
  results: UserBulkActionResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    processed: number;
  };
  progress?: {
    currentBatch: number;
    totalBatches: number;
    completedItems: number;
    remainingItems: number;
  };
  transactionId?: string;
  rollbackAvailable: boolean;
  executionTime: number;
}

export interface UserRoleUpdateRequest {
  role: UserRole;
  reason?: string;
  adminNotes?: string;
}

export interface UserRoleUpdateResponse {
  success: boolean;
  user: {
    id: string;
    email?: string;
    name: string;
    previousRole: UserRole;
    newRole: UserRole;
    updatedAt: string;
  };
  action: {
    type: 'role_update';
    reason?: string;
    adminNotes?: string;
    performedBy: string;
    performedAt: string;
  };
}

export interface UserActivityFilter {
  userId?: string;
  activityTypes?: string[];
  severity?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface UserActivityResponse {
  activities: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail?: string;
    activityType: string;
    description: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    timestamp: string;
    severity: string;
  }>;
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  filters: UserActivityFilter;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail?: string;
  actionType: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  reason?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'user_management' | 'shop_management' | 'content_moderation' | 'system' | 'security';
}

export interface AuditSearchFilter {
  userId?: string;
  adminId?: string;
  actionTypes?: string[];
  targetTypes?: string[];
  categories?: string[];
  severity?: string[];
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  ipAddress?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSearchResponse {
  auditLogs: AuditLogEntry[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  filters: AuditSearchFilter;
  aggregations?: {
    actionTypeCounts: Record<string, number>;
    adminCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
    severityCounts: Record<string, number>;
  };
}

export interface AuditExportRequest {
  format: 'csv' | 'json' | 'pdf';
  filters: AuditSearchFilter;
  includeMetadata?: boolean;
  includeAggregations?: boolean;
}

export interface AuditExportResponse {
  success: boolean;
  downloadUrl?: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  exportId: string;
  expiresAt: string;
}

export interface UserAnalyticsFilter {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  userSegments?: ('power_users' | 'inactive_users' | 'high_referral_users' | 'new_users' | 'churned_users')[];
  roles?: UserRole[];
  statuses?: UserStatus[];
  platforms?: string[];
  countries?: string[];
  includeGrowthTrends?: boolean;
  includeActivityPatterns?: boolean;
  includeBehavioralInsights?: boolean;
  includeRetentionMetrics?: boolean;
  includeGeographicData?: boolean;
}

export interface UserGrowthTrend {
  period: string;
  newUsers: number;
  activeUsers: number;
  churnedUsers: number;
  retentionRate: number;
  growthRate: number;
}

export interface UserActivityPattern {
  hour: number;
  dayOfWeek: number;
  averageActivity: number;
  peakActivity: number;
  activityType: string;
}

export interface UserBehavioralInsight {
  segment: string;
  userCount: number;
  averageSessionDuration: number;
  averageActionsPerSession: number;
  conversionRate: number;
  retentionRate: number;
  characteristics: string[];
}

export interface UserLifecycleMetrics {
  stage: 'new' | 'active' | 'at_risk' | 'churned' | 'reactivated';
  userCount: number;
  percentage: number;
  averageDaysInStage: number;
  transitionRates: Record<string, number>;
}

export interface GeographicDistribution {
  country: string;
  userCount: number;
  percentage: number;
  averageActivityLevel: number;
  topCities: Array<{
    city: string;
    userCount: number;
  }>;
}

export interface PlatformUsageStats {
  platform: string;
  userCount: number;
  percentage: number;
  averageSessionDuration: number;
  retentionRate: number;
}

export interface UserAnalyticsResponse {
  summary: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    churnRate: number;
    averageLifetimeValue: number;
    userGrowthRate: number;
  };
  growthTrends?: UserGrowthTrend[];
  activityPatterns?: UserActivityPattern[];
  behavioralInsights?: UserBehavioralInsight[];
  lifecycleMetrics?: UserLifecycleMetrics[];
  geographicDistribution?: GeographicDistribution[];
  platformUsage?: PlatformUsageStats[];
  userSegments: {
    powerUsers: number;
    inactiveUsers: number;
    highReferralUsers: number;
    newUsers: number;
    churnedUsers: number;
  };
  realTimeMetrics: {
    activeNow: number;
    sessionsToday: number;
    averageSessionDuration: number;
    topActions: Array<{
      action: string;
      count: number;
    }>;
  };
  filters: UserAnalyticsFilter;
  generatedAt: string;
}

export interface AdvancedUserSearchFilter {
  email?: string;
  name?: string;
  role?: UserRole[];
  status?: UserStatus[];
  limit?: number;
  offset?: number;
  segments?: ('power_users' | 'inactive_users' | 'high_referral_users' | 'new_users' | 'churned_users')[];
  activityLevel?: 'high' | 'medium' | 'low' | 'inactive';
  registrationDateRange?: {
    startDate: string;
    endDate: string;
  };
  lastActivityRange?: {
    startDate: string;
    endDate: string;
  };
  referralCount?: {
    min?: number;
    max?: number;
  };
  lifetimeValue?: {
    min?: number;
    max?: number;
  };
  platform?: string[];
  country?: string[];
  sortBy?: 'created_at' | 'last_activity' | 'referral_count' | 'lifetime_value' | 'activity_score';
  sortOrder?: 'asc' | 'desc';
}

export class AdminUserManagementService {
  private supabase = getSupabaseClient()
  private notificationService = new NotificationService();

  /**
   * Get users with advanced search and filtering
   */
  async getUsers(filters: UserSearchFilters = {}, adminId: string): Promise<UserManagementResponse> {
    try {
      logger.info('Admin user search', { adminId, filters });

      const {
        search,
        role,
        status,
        gender,
        isInfluencer,
        phoneVerified,
        startDate,
        endDate,
        lastLoginStart,
        lastLoginEnd,
        hasReferrals,
        minPoints,
        maxPoints,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = filters;

      const offset = (page - 1) * limit;

      // Build base query
      let query = this.supabase
        .from('users')
        .select('*', { count: 'exact' });

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%`);
      }

      // Apply role filter
      if (role) {
        query = query.eq('user_role', role);
      }

      // Apply status filter
      if (status) {
        query = query.eq('user_status', status);
      }

      // Apply gender filter
      if (gender) {
        query = query.eq('gender', gender);
      }

      // Apply influencer filter
      if (isInfluencer !== undefined) {
        query = query.eq('is_influencer', isInfluencer);
      }

      // Apply phone verification filter
      if (phoneVerified !== undefined) {
        query = query.eq('phone_verified', phoneVerified);
      }

      // Apply date range filters
      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      if (lastLoginStart) {
        query = query.gte('last_login_at', lastLoginStart);
      }

      if (lastLoginEnd) {
        query = query.lte('last_login_at', lastLoginEnd);
      }

      // Apply referral filter
      if (hasReferrals !== undefined) {
        if (hasReferrals) {
          query = query.gt('total_referrals', 0);
        } else {
          query = query.eq('total_referrals', 0);
        }
      }

      // Apply points range filter
      if (minPoints !== undefined) {
        query = query.gte('total_points', minPoints);
      }

      if (maxPoints !== undefined) {
        query = query.lte('total_points', maxPoints);
      }

      // Get total count first
      const { count, error: countError } = await query;

      if (countError) {
        throw new Error(`Failed to get user count: ${countError.message}`);
      }

      // Apply sorting and pagination
      const { data: users, error } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get users: ${error.message}`);
      }

      // Process and enrich user data
      const enrichedUsers = (users || []).map(user => {
        const now = new Date();
        const lastLogin = user.last_login_at ? new Date(user.last_login_at) : null;
        const daysSinceLastLogin = lastLogin 
          ? Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

        return {
          id: user.id,
          email: user.email,
          phoneNumber: user.phone_number,
          phoneVerified: user.phone_verified,
          name: user.name,
          nickname: user.nickname,
          gender: user.gender,
          birthDate: user.birth_date,
          userRole: user.user_role,
          userStatus: user.user_status,
          isInfluencer: user.is_influencer,
          influencerQualifiedAt: user.influencer_qualified_at,
          socialProvider: user.social_provider,
          referralCode: user.referral_code,
          referredByCode: user.referred_by_code,
          totalPoints: user.total_points,
          availablePoints: user.available_points,
          totalReferrals: user.total_referrals,
          successfulReferrals: user.successful_referrals,
          lastLoginAt: user.last_login_at,
          lastLoginIp: user.last_login_ip,
          termsAcceptedAt: user.terms_accepted_at,
          privacyAcceptedAt: user.privacy_accepted_at,
          marketingConsent: user.marketing_consent,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          // Computed fields
          daysSinceLastLogin,
          isActive: user.user_status === 'active',
          hasCompletedProfile: !!(user.name && (user.email || user.phone_number))
        };
      });

      const totalPages = Math.ceil((count || 0) / limit);
      const hasMore = page < totalPages;

      const response: UserManagementResponse = {
        users: enrichedUsers,
        totalCount: count || 0,
        hasMore,
        currentPage: page,
        totalPages,
        filters
      };

      // Log admin action
      await this.logAdminAction(adminId, 'user_search', {
        filters,
        resultCount: enrichedUsers.length,
        totalCount: count || 0
      });

      logger.info('Admin user search completed', { 
        adminId, 
        resultCount: enrichedUsers.length,
        totalCount: count || 0 
      });

      return response;
    } catch (error) {
      logger.error('Admin user search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
      });
      throw error;
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(
    userId: string, 
    request: UserStatusUpdateRequest, 
    adminId: string
  ): Promise<UserStatusUpdateResponse> {
    try {
      logger.info('Admin updating user status', { adminId, userId, request });

      // Get current user
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      const previousStatus = user.user_status;

      // Update user status
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          user_status: request.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update user status: ${updateError.message}`);
      }

      // Log admin action with enhanced tracking
      await this.logAdminAction(adminId, 'user_status_update', {
        userId,
        previousStatus,
        newStatus: request.status,
        reason: request.reason,
        adminNotes: request.adminNotes,
        notifyUser: request.notifyUser
      }, {
        targetId: userId,
        targetType: 'user',
        reason: request.reason,
        severity: request.status === 'suspended' ? 'high' : 'medium',
        category: request.status === 'suspended' ? 'security' : 'user_management'
      });

      // Create user status history record
      await this.supabase
        .from('user_status_history')
        .insert({
          user_id: userId,
          previous_status: previousStatus,
          new_status: request.status,
          changed_by: adminId,
          reason: request.reason,
          admin_notes: request.adminNotes,
          created_at: new Date().toISOString()
        });

      // Send notification to user if requested
      if (request.notifyUser) {
        await this.sendUserStatusChangeNotification(userId, previousStatus, request.status, request.reason);
      }

      // Broadcast status change activity to admin monitoring
      if (websocketService) {
        // Get admin name for the broadcast
        const { data: admin } = await this.supabase
          .from('users')
          .select('name')
          .eq('id', adminId)
          .single();

        websocketService.broadcastUserStatusChange(
          userId,
          user.name,
          previousStatus,
          request.status,
          request.reason,
          adminId,
          admin?.name
        );
      }

      const response: UserStatusUpdateResponse = {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          previousStatus,
          newStatus: request.status,
          updatedAt: new Date().toISOString()
        },
        action: {
          type: 'status_update',
          reason: request.reason,
          adminNotes: request.adminNotes,
          performedBy: adminId,
          performedAt: new Date().toISOString()
        }
      };

      logger.info('User status updated successfully', { 
        adminId, 
        userId, 
        previousStatus, 
        newStatus: request.status 
      });

      return response;
    } catch (error) {
      logger.error('User status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        userId,
        request
      });
      throw error;
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(
    userId: string, 
    request: UserRoleUpdateRequest, 
    adminId: string
  ): Promise<UserRoleUpdateResponse> {
    try {
      logger.info('Admin updating user role', { adminId, userId, request });

      // Get current user
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      const previousRole = user.user_role;

      // Prevent self-role modification for admins
      if (userId === adminId && previousRole === 'admin' && request.role !== 'admin') {
        throw new Error('Cannot remove admin role from yourself');
      }

      // Update user role
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          user_role: request.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update user role: ${updateError.message}`);
      }

      // Log admin action with enhanced tracking
      await this.logAdminAction(adminId, 'user_role_update', {
        userId,
        previousRole,
        newRole: request.role,
        reason: request.reason,
        adminNotes: request.adminNotes
      }, {
        targetId: userId,
        targetType: 'user',
        reason: request.reason,
        severity: request.role === 'admin' ? 'critical' : 'high',
        category: 'user_management'
      });

      // Create user role history record (if table exists)
      try {
        await this.supabase
          .from('user_role_history')
          .insert({
            user_id: userId,
            previous_role: previousRole,
            new_role: request.role,
            changed_by: adminId,
            reason: request.reason,
            admin_notes: request.adminNotes,
            created_at: new Date().toISOString()
          });
      } catch (historyError) {
        // Log but don't fail if history table doesn't exist
        logger.warn('Could not create role history record', { historyError });
      }

      // Send notification to user about role change
      await this.sendUserRoleChangeNotification(userId, previousRole, request.role, request.reason);

      // Broadcast role change activity to admin monitoring
      if (websocketService) {
        // Get admin name for the broadcast
        const { data: admin } = await this.supabase
          .from('users')
          .select('name')
          .eq('id', adminId)
          .single();

        websocketService.broadcastUserRoleChange(
          userId,
          user.name,
          previousRole,
          request.role,
          request.reason,
          adminId,
          admin?.name
        );
      }

      const response: UserRoleUpdateResponse = {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          previousRole,
          newRole: request.role,
          updatedAt: new Date().toISOString()
        },
        action: {
          type: 'role_update',
          reason: request.reason,
          adminNotes: request.adminNotes,
          performedBy: adminId,
          performedAt: new Date().toISOString()
        }
      };

      logger.info('User role updated successfully', { 
        adminId, 
        userId, 
        previousRole, 
        newRole: request.role 
      });

      return response;
    } catch (error) {
      logger.error('User role update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        userId,
        request
      });
      throw error;
    }
  }

  /**
   * Perform bulk actions on users with transaction safety
   */
  async performBulkAction(
    request: UserBulkActionRequest, 
    adminId: string
  ): Promise<UserBulkActionResponse> {
    const startTime = Date.now();
    const transactionId = `bulk_${adminId}_${Date.now()}`;
    const useTransaction = request.useTransaction !== false; // Default to true
    const batchSize = request.batchSize || 50;
    
    try {
      logger.info('Admin performing enhanced bulk action', { 
        adminId, 
        action: request.action, 
        userCount: request.userIds.length,
        useTransaction,
        batchSize,
        transactionId
      });

      // Validate request
      if (!request.userIds || request.userIds.length === 0) {
        throw new Error('No user IDs provided for bulk action');
      }

      if (request.action === 'change_role' && !request.targetRole) {
        throw new Error('Target role is required for change_role action');
      }

      const results: UserBulkActionResult[] = [];
      let successful = 0;
      let failed = 0;
      let skipped = 0;
      let processed = 0;

      // Process in batches
      const totalBatches = Math.ceil(request.userIds.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, request.userIds.length);
        const batchUserIds = request.userIds.slice(startIdx, endIdx);

        logger.info(`Processing batch ${batchIndex + 1}/${totalBatches}`, {
          batchSize: batchUserIds.length,
          transactionId
        });

        if (useTransaction) {
          // Process batch with transaction
          await this.processBatchWithTransaction(
            batchUserIds, 
            request, 
            adminId, 
            results,
            transactionId
          );
        } else {
          // Process batch without transaction
          await this.processBatchWithoutTransaction(
            batchUserIds, 
            request, 
            adminId, 
            results
          );
        }

        // Update counters
        const batchResults = results.slice(processed);
        for (const result of batchResults) {
          if (result.success) {
            successful++;
          } else {
            failed++;
          }
        }
        processed = results.length;
      }

      // Log bulk action
      await this.logAdminAction(adminId, 'user_bulk_action', {
        action: request.action,
        userIds: request.userIds,
        reason: request.reason,
        results: { successful, failed, skipped },
        transactionId,
        useTransaction,
        batchSize
      });

      // Broadcast bulk action activity
      if (websocketService) {
        const { data: admin } = await this.supabase
          .from('users')
          .select('name')
          .eq('id', adminId)
          .single();

        websocketService.broadcastAdminAction(
          adminId,
          admin?.name || 'Admin',
          'bulk_action',
          undefined,
          undefined,
          `Bulk ${request.action} on ${successful} users`,
          {
            action: request.action,
            totalUsers: request.userIds.length,
            successful,
            failed,
            transactionId
          }
        );
      }

      const executionTime = Date.now() - startTime;
      const response: UserBulkActionResponse = {
        success: failed === 0,
        results,
        summary: {
          total: request.userIds.length,
          successful,
          failed,
          skipped,
          processed
        },
        progress: {
          currentBatch: totalBatches,
          totalBatches,
          completedItems: processed,
          remainingItems: 0
        },
        transactionId,
        rollbackAvailable: useTransaction && failed === 0,
        executionTime
      };

      logger.info('Enhanced bulk action completed', { 
        adminId, 
        action: request.action,
        successful,
        failed,
        skipped,
        executionTime,
        transactionId
      });

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Enhanced bulk action failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        request,
        executionTime,
        transactionId
      });
      throw error;
    }
  }

  /**
   * Process a batch of users with database transaction
   */
  private async processBatchWithTransaction(
    userIds: string[],
    request: UserBulkActionRequest,
    adminId: string,
    results: UserBulkActionResult[],
    transactionId: string
  ): Promise<void> {
    // Note: Supabase doesn't support traditional transactions in the client library
    // We'll implement a rollback mechanism using a transaction log
    const batchStartTime = Date.now();
    const rollbackData: Array<{ userId: string; previousValue: any; action: string }> = [];

    try {
      for (const userId of userIds) {
        try {
          const result = await this.performSingleUserAction(userId, request, adminId, rollbackData);
          results.push(result);
        } catch (error) {
          // On error in transaction mode, attempt rollback of this batch
          logger.warn('Error in transaction batch, attempting rollback', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
            transactionId
          });

          // Rollback previous operations in this batch
          await this.rollbackBatchOperations(rollbackData, adminId);

          // Add failed result for this user
          results.push({
            userId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });

          // Add failed results for remaining users in batch
          const remainingUserIds = userIds.slice(userIds.indexOf(userId) + 1);
          for (const remainingUserId of remainingUserIds) {
            results.push({
              userId: remainingUserId,
              success: false,
              error: 'Skipped due to batch transaction failure',
              timestamp: new Date().toISOString()
            });
          }

          break; // Exit batch processing
        }
      }

      logger.info('Batch processed with transaction safety', {
        batchSize: userIds.length,
        executionTime: Date.now() - batchStartTime,
        transactionId
      });

    } catch (error) {
      logger.error('Batch transaction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId
      });
      throw error;
    }
  }

  /**
   * Process a batch of users without transaction (individual operations)
   */
  private async processBatchWithoutTransaction(
    userIds: string[],
    request: UserBulkActionRequest,
    adminId: string,
    results: UserBulkActionResult[]
  ): Promise<void> {
    for (const userId of userIds) {
      try {
        const result = await this.performSingleUserAction(userId, request, adminId);
        results.push(result);
      } catch (error) {
        results.push({
          userId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Perform a single user action with rollback data collection
   */
  private async performSingleUserAction(
    userId: string,
    request: UserBulkActionRequest,
    adminId: string,
    rollbackData?: Array<{ userId: string; previousValue: any; action: string }>
  ): Promise<UserBulkActionResult> {
    const timestamp = new Date().toISOString();

    // Get current user data for rollback
    const { data: currentUser, error: userError } = await this.supabase
      .from('users')
      .select('user_status, user_role, name, email')
      .eq('id', userId)
      .single();

    if (userError || !currentUser) {
      throw new Error(`User not found: ${userId}`);
    }

    let previousValue: any;
    let newValue: any;
    let actionPerformed: string;

    switch (request.action) {
      case 'activate':
        previousValue = currentUser.user_status;
        newValue = 'active';
        actionPerformed = 'status_update';
        
        await this.updateUserStatus(userId, {
          status: 'active',
          reason: request.reason,
          adminNotes: request.adminNotes,
          notifyUser: false
        }, adminId);
        break;

      case 'suspend':
        previousValue = currentUser.user_status;
        newValue = 'suspended';
        actionPerformed = 'status_update';
        
        await this.updateUserStatus(userId, {
          status: 'suspended',
          reason: request.reason,
          adminNotes: request.adminNotes,
          notifyUser: true
        }, adminId);
        break;

      case 'delete':
        previousValue = currentUser.user_status;
        newValue = 'deleted';
        actionPerformed = 'status_update';
        
        await this.updateUserStatus(userId, {
          status: 'deleted',
          reason: request.reason,
          adminNotes: request.adminNotes,
          notifyUser: false
        }, adminId);
        break;

      case 'change_role':
        if (!request.targetRole) {
          throw new Error('Target role is required for change_role action');
        }
        
        previousValue = currentUser.user_role;
        newValue = request.targetRole;
        actionPerformed = 'role_update';
        
        await this.updateUserRole(userId, {
          role: request.targetRole,
          reason: request.reason,
          adminNotes: request.adminNotes
        }, adminId);
        break;

      case 'export':
        // Export operation - no changes to user data
        previousValue = null;
        newValue = null;
        actionPerformed = 'export';
        
        // TODO: Implement actual export logic
        logger.info('Export operation for user', { userId, adminId });
        break;

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }

    // Store rollback data if provided
    if (rollbackData && previousValue !== null) {
      rollbackData.push({
        userId,
        previousValue,
        action: actionPerformed
      });
    }

    return {
      userId,
      success: true,
      previousValue,
      newValue,
      timestamp
    };
  }

  /**
   * Rollback batch operations in case of transaction failure
   */
  private async rollbackBatchOperations(
    rollbackData: Array<{ userId: string; previousValue: any; action: string }>,
    adminId: string
  ): Promise<void> {
    logger.info('Attempting to rollback batch operations', {
      operationsToRollback: rollbackData.length
    });

    for (const rollbackItem of rollbackData.reverse()) { // Reverse order for rollback
      try {
        switch (rollbackItem.action) {
          case 'status_update':
            await this.supabase
              .from('users')
              .update({
                user_status: rollbackItem.previousValue,
                updated_at: new Date().toISOString()
              })
              .eq('id', rollbackItem.userId);
            break;

          case 'role_update':
            await this.supabase
              .from('users')
              .update({
                user_role: rollbackItem.previousValue,
                updated_at: new Date().toISOString()
              })
              .eq('id', rollbackItem.userId);
            break;
        }

        logger.info('Rollback successful for user', {
          userId: rollbackItem.userId,
          action: rollbackItem.action,
          restoredValue: rollbackItem.previousValue
        });

      } catch (rollbackError) {
        logger.error('Rollback failed for user', {
          userId: rollbackItem.userId,
          action: rollbackItem.action,
          error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Get user activity feed for admin monitoring
   */
  async getUserActivity(filters: UserActivityFilter = {}, adminId: string): Promise<UserActivityResponse> {
    try {
      logger.info('Admin getting user activity', { adminId, filters });

      const {
        userId,
        activityTypes,
        severity,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = filters;

      // For now, we'll get activities from admin_actions table and user_status_history
      // In a production system, you might want a dedicated user_activities table
      let activities: any[] = [];

      // Get admin actions
      let adminActionsQuery = this.supabase
        .from('admin_actions')
        .select(`
          id,
          action_type,
          target_id,
          reason,
          metadata,
          created_at,
          admin:admin_id(id, name, email),
          target_user:target_id(id, name, email)
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        adminActionsQuery = adminActionsQuery.or(`admin_id.eq.${userId},target_id.eq.${userId}`);
      }

      if (startDate) {
        adminActionsQuery = adminActionsQuery.gte('created_at', startDate);
      }

      if (endDate) {
        adminActionsQuery = adminActionsQuery.lte('created_at', endDate);
      }

      const { data: adminActions, error: adminActionsError } = await adminActionsQuery
        .range(offset, offset + limit - 1);

      if (adminActionsError) {
        logger.error('Error fetching admin actions', { adminActionsError });
      } else {
        activities = activities.concat((adminActions || []).map(action => ({
          id: `admin_${action.id}`,
          userId: action.admin?.[0]?.id || action.target_id,
          userName: action.admin?.[0]?.name || action.target_user?.[0]?.name || 'Unknown',
          userEmail: action.admin?.[0]?.email || action.target_user?.[0]?.email,
          activityType: action.action_type.includes('user_') ? 'admin_action' : 'admin_action',
          description: this.formatAdminActionDescription(action),
          metadata: {
            actionType: action.action_type,
            targetUserId: action.target_id,
            targetUserName: action.target_user?.[0]?.name,
            adminId: action.admin?.[0]?.id,
            adminName: action.admin?.[0]?.name,
            ...action.metadata
          },
          timestamp: action.created_at,
          severity: this.getActivitySeverity(action.action_type)
        })));
      }

      // Get user status changes if user_status_history table exists
      try {
        let statusChangesQuery = this.supabase
          .from('user_status_history')
          .select(`
            id,
            user_id,
            previous_status,
            new_status,
            reason,
            admin_notes,
            created_at,
            user:user_id(id, name, email),
            admin:changed_by(id, name, email)
          `)
          .order('created_at', { ascending: false });

        if (userId) {
          statusChangesQuery = statusChangesQuery.eq('user_id', userId);
        }

        if (startDate) {
          statusChangesQuery = statusChangesQuery.gte('created_at', startDate);
        }

        if (endDate) {
          statusChangesQuery = statusChangesQuery.lte('created_at', endDate);
        }

        const { data: statusChanges } = await statusChangesQuery.range(0, limit - 1);

        if (statusChanges) {
          activities = activities.concat(statusChanges.map(change => ({
            id: `status_${change.id}`,
            userId: change.user_id,
            userName: change.user?.[0]?.name || 'Unknown',
            userEmail: change.user?.[0]?.email,
            activityType: 'status_change',
            description: `Status changed from ${change.previous_status} to ${change.new_status}`,
            metadata: {
              previousStatus: change.previous_status,
              newStatus: change.new_status,
              reason: change.reason,
              adminNotes: change.admin_notes,
              adminId: change.admin?.[0]?.id,
              adminName: change.admin?.[0]?.name
            },
            timestamp: change.created_at,
            severity: change.new_status === 'suspended' || change.new_status === 'deleted' ? 'high' : 'medium'
          })));
        }
      } catch (statusError) {
        logger.warn('Could not fetch status changes', { statusError });
      }

      // Get user role changes if user_role_history table exists
      try {
        let roleChangesQuery = this.supabase
          .from('user_role_history')
          .select(`
            id,
            user_id,
            previous_role,
            new_role,
            reason,
            admin_notes,
            created_at,
            user:user_id(id, name, email),
            admin:changed_by(id, name, email)
          `)
          .order('created_at', { ascending: false });

        if (userId) {
          roleChangesQuery = roleChangesQuery.eq('user_id', userId);
        }

        if (startDate) {
          roleChangesQuery = roleChangesQuery.gte('created_at', startDate);
        }

        if (endDate) {
          roleChangesQuery = roleChangesQuery.lte('created_at', endDate);
        }

        const { data: roleChanges } = await roleChangesQuery.range(0, limit - 1);

        if (roleChanges) {
          activities = activities.concat(roleChanges.map(change => ({
            id: `role_${change.id}`,
            userId: change.user_id,
            userName: change.user?.[0]?.name || 'Unknown',
            userEmail: change.user?.[0]?.email,
            activityType: 'role_change',
            description: `Role changed from ${change.previous_role} to ${change.new_role}`,
            metadata: {
              previousRole: change.previous_role,
              newRole: change.new_role,
              reason: change.reason,
              adminNotes: change.admin_notes,
              adminId: change.admin?.[0]?.id,
              adminName: change.admin?.[0]?.name
            },
            timestamp: change.created_at,
            severity: change.new_role === 'admin' ? 'critical' : 'medium'
          })));
        }
      } catch (roleError) {
        logger.warn('Could not fetch role changes', { roleError });
      }

      // Sort activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply filters
      if (activityTypes && activityTypes.length > 0) {
        activities = activities.filter(activity => activityTypes.includes(activity.activityType));
      }

      if (severity && severity.length > 0) {
        activities = activities.filter(activity => severity.includes(activity.severity));
      }

      // Apply pagination
      const totalCount = activities.length;
      const paginatedActivities = activities.slice(offset, offset + limit);
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      const hasMore = offset + limit < totalCount;

      const response: UserActivityResponse = {
        activities: paginatedActivities,
        totalCount,
        hasMore,
        currentPage,
        totalPages,
        filters
      };

      // Log admin action
      await this.logAdminAction(adminId, 'user_activity_viewed', {
        filters,
        resultCount: paginatedActivities.length,
        totalCount
      });

      logger.info('User activity retrieved', { 
        adminId, 
        resultCount: paginatedActivities.length,
        totalCount 
      });

      return response;
    } catch (error) {
      logger.error('Failed to get user activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
      });
      throw error;
    }
  }

  /**
   * Format admin action description for activity feed
   */
  private formatAdminActionDescription(action: any): string {
    const actionType = action.action_type;
    const targetName = action.target_user?.[0]?.name || 'Unknown User';
    const adminName = action.admin?.[0]?.name || 'System';

    switch (actionType) {
      case 'user_status_update':
        return `${adminName} updated ${targetName}'s status`;
      case 'user_role_update':
        return `${adminName} updated ${targetName}'s role`;
      case 'user_suspended':
        return `${adminName} suspended ${targetName}`;
      case 'user_activated':
        return `${adminName} activated ${targetName}`;
      case 'shop_approved':
        return `${adminName} approved shop`;
      case 'shop_rejected':
        return `${adminName} rejected shop`;
      case 'refund_processed':
        return `${adminName} processed refund`;
      case 'points_adjusted':
        return `${adminName} adjusted user points`;
      default:
        return `${adminName} performed ${actionType}`;
    }
  }

  /**
   * Get activity severity based on action type
   */
  private getActivitySeverity(actionType: string): string {
    if (actionType.includes('suspended') || actionType.includes('deleted')) {
      return 'high';
    }
    if (actionType.includes('admin') || actionType.includes('role')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get user statistics for admin dashboard
   */
  async getUserStatistics(adminId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    deletedUsers: number;
    newUsersThisMonth: number;
    newUsersThisWeek: number;
    usersByRole: Record<UserRole, number>;
    usersByStatus: Record<UserStatus, number>;
    topReferrers: Array<{
      id: string;
      name: string;
      email?: string;
      totalReferrals: number;
    }>;
    recentActivity: Array<{
      id: string;
      action: string;
      userId: string;
      userName: string;
      timestamp: string;
    }>;
  }> {
    try {
      logger.info('Getting user statistics', { adminId });

      // Get basic counts
      const { count: totalUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' });

      const { count: activeUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('user_status', 'active');

      const { count: suspendedUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('user_status', 'suspended');

      const { count: deletedUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('user_status', 'deleted');

      // Get new users this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: newUsersThisMonth } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .gte('created_at', startOfMonth.toISOString());

      // Get new users this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);

      const { count: newUsersThisWeek } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .gte('created_at', startOfWeek.toISOString());

      // Get users by role
      const { data: roleStats } = await this.supabase
        .from('users')
        .select('user_role');

      const usersByRole = (roleStats || []).reduce((acc, user) => {
        const role = user.user_role as UserRole;
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<UserRole, number>);

      // Get users by status
      const { data: statusStats } = await this.supabase
        .from('users')
        .select('user_status');

      const usersByStatus = (statusStats || []).reduce((acc, user) => {
        const status = user.user_status as UserStatus;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<UserStatus, number>);

      // Get top referrers
      const { data: topReferrers } = await this.supabase
        .from('users')
        .select('id, name, email, total_referrals')
        .gt('total_referrals', 0)
        .order('total_referrals', { ascending: false })
        .limit(10);

      // Get recent admin actions
      const { data: recentActivity } = await this.supabase
        .from('admin_actions')
        .select(`
          id,
          action_type,
          target_id,
          created_at,
          users!admin_actions_target_id_fkey(id, name)
        `)
        .eq('action_type', 'user_suspended')
        .order('created_at', { ascending: false })
        .limit(10);

      const statistics = {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        suspendedUsers: suspendedUsers || 0,
        deletedUsers: deletedUsers || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        newUsersThisWeek: newUsersThisWeek || 0,
        usersByRole,
        usersByStatus,
        topReferrers: (topReferrers || []).map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          totalReferrals: user.total_referrals
        })),
        recentActivity: (recentActivity || []).map(action => ({
          id: action.id,
          action: action.action_type,
          userId: action.target_id,
          userName: (action as any).users?.name || 'Unknown',
          timestamp: action.created_at
        }))
      };

      logger.info('User statistics retrieved', { adminId });

      return statistics;
    } catch (error) {
      logger.error('Failed to get user statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Enhanced admin action logging with comprehensive tracking
   */
  private async logAdminAction(
    adminId: string, 
    action: string, 
    metadata: any,
    options?: {
      targetId?: string;
      targetType?: string;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      category?: 'user_management' | 'shop_management' | 'content_moderation' | 'system' | 'security';
    }
  ): Promise<void> {
    try {
      const enhancedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        sessionId: options?.sessionId,
        severity: options?.severity || this.getActionSeverity(action),
        category: options?.category || this.getActionCategory(action)
      };

      await this.supabase
        .from('admin_actions')
        .insert({
          admin_id: adminId,
          action_type: action,
          target_type: options?.targetType || 'user',
          target_id: options?.targetId || metadata?.userId || null,
          reason: options?.reason || metadata?.reason,
          metadata: enhancedMetadata,
          created_at: new Date().toISOString()
        });

      logger.info('Admin action logged', {
        adminId,
        action,
        targetId: options?.targetId,
        severity: enhancedMetadata.severity,
        category: enhancedMetadata.category
      });

    } catch (error) {
      logger.error('Error logging admin action', { error, adminId, action });
    }
  }

  /**
   * Determine action severity based on action type
   */
  private getActionSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'user_search': 'low',
      'user_activity_viewed': 'low',
      'user_status_update': 'medium',
      'user_role_update': 'high',
      'user_bulk_action': 'high',
      'user_suspended': 'high',
      'user_activated': 'medium',
      'user_promoted_influencer': 'critical',
      'shop_approved': 'medium',
      'shop_rejected': 'medium',
      'shop_suspended': 'high',
      'refund_processed': 'medium',
      'points_adjusted': 'medium',
      'content_moderated': 'medium',
      'post_hidden': 'medium',
      'post_restored': 'low',
      'reservation_force_completed': 'high'
    };

    return severityMap[action] || 'medium';
  }

  /**
   * Determine action category based on action type
   */
  private getActionCategory(action: string): 'user_management' | 'shop_management' | 'content_moderation' | 'system' | 'security' {
    const categoryMap: Record<string, 'user_management' | 'shop_management' | 'content_moderation' | 'system' | 'security'> = {
      'user_search': 'user_management',
      'user_activity_viewed': 'user_management',
      'user_status_update': 'user_management',
      'user_role_update': 'user_management',
      'user_bulk_action': 'user_management',
      'user_suspended': 'security',
      'user_activated': 'user_management',
      'user_promoted_influencer': 'user_management',
      'shop_approved': 'shop_management',
      'shop_rejected': 'shop_management',
      'shop_suspended': 'shop_management',
      'refund_processed': 'system',
      'points_adjusted': 'system',
      'content_moderated': 'content_moderation',
      'post_hidden': 'content_moderation',
      'post_restored': 'content_moderation',
      'reservation_force_completed': 'system'
    };

    return categoryMap[action] || 'system';
  }

  /**
   * Search audit logs with comprehensive filtering
   */
  async searchAuditLogs(filters: AuditSearchFilter, adminId: string): Promise<AuditSearchResponse> {
    try {
      logger.info('Admin searching audit logs', { adminId, filters });

      const {
        userId,
        adminId: filterAdminId,
        actionTypes,
        targetTypes,
        categories,
        severity,
        startDate,
        endDate,
        searchTerm,
        ipAddress,
        sessionId,
        limit = 50,
        offset = 0
      } = filters;

      // Build base query
      let query = this.supabase
        .from('admin_actions')
        .select(`
          id,
          admin_id,
          action_type,
          target_type,
          target_id,
          reason,
          metadata,
          created_at,
          admin:admin_id(id, name, email),
          target_user:target_id(id, name, email)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filterAdminId) {
        query = query.eq('admin_id', filterAdminId);
      }

      if (userId) {
        query = query.or(`target_id.eq.${userId},admin_id.eq.${userId}`);
      }

      if (actionTypes && actionTypes.length > 0) {
        query = query.in('action_type', actionTypes);
      }

      if (targetTypes && targetTypes.length > 0) {
        query = query.in('target_type', targetTypes);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      if (ipAddress) {
        query = query.contains('metadata', { ipAddress });
      }

      if (sessionId) {
        query = query.contains('metadata', { sessionId });
      }

      // Execute query with pagination
      const { data: auditData, error: auditError, count } = await query
        .range(offset, offset + limit - 1);

      if (auditError) {
        throw new Error(`Failed to search audit logs: ${auditError.message}`);
      }

      // Transform data to AuditLogEntry format
      let auditLogs: AuditLogEntry[] = (auditData || []).map(entry => ({
        id: entry.id,
        adminId: entry.admin_id,
        adminName: entry.admin?.[0]?.name || 'Unknown Admin',
        adminEmail: entry.admin?.[0]?.email,
        actionType: entry.action_type,
        targetType: entry.target_type,
        targetId: entry.target_id,
        targetName: entry.target_user?.[0]?.name,
        reason: entry.reason,
        metadata: entry.metadata || {},
        ipAddress: entry.metadata?.ipAddress,
        userAgent: entry.metadata?.userAgent,
        sessionId: entry.metadata?.sessionId,
        timestamp: entry.created_at,
        severity: entry.metadata?.severity || this.getActionSeverity(entry.action_type),
        category: entry.metadata?.category || this.getActionCategory(entry.action_type)
      }));

      // Apply client-side filters for metadata fields
      if (categories && categories.length > 0) {
        auditLogs = auditLogs.filter(log => categories.includes(log.category));
      }

      if (severity && severity.length > 0) {
        auditLogs = auditLogs.filter(log => severity.includes(log.severity));
      }

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        auditLogs = auditLogs.filter(log => 
          log.adminName.toLowerCase().includes(searchLower) ||
          log.actionType.toLowerCase().includes(searchLower) ||
          log.targetName?.toLowerCase().includes(searchLower) ||
          log.reason?.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
        );
      }

      // Calculate aggregations
      const aggregations = this.calculateAuditAggregations(auditLogs);

      // Pagination calculations
      const totalCount = count || auditLogs.length;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      const hasMore = offset + limit < totalCount;

      const response: AuditSearchResponse = {
        auditLogs,
        totalCount,
        hasMore,
        currentPage,
        totalPages,
        filters,
        aggregations
      };

      // Log the audit search action
      await this.logAdminAction(adminId, 'audit_search', {
        filters,
        resultCount: auditLogs.length,
        totalCount
      });

      logger.info('Audit logs search completed', {
        adminId,
        resultCount: auditLogs.length,
        totalCount
      });

      return response;

    } catch (error) {
      logger.error('Failed to search audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(userId: string, filters: Partial<AuditSearchFilter>, adminId: string): Promise<AuditSearchResponse> {
    try {
      logger.info('Admin getting user audit logs', { adminId, userId, filters });

      const userFilters: AuditSearchFilter = {
        ...filters,
        userId,
        limit: filters.limit || 50,
        offset: filters.offset || 0
      };

      const result = await this.searchAuditLogs(userFilters, adminId);

      // Log the user audit access
      await this.logAdminAction(adminId, 'user_audit_accessed', {
        targetUserId: userId,
        filters,
        resultCount: result.auditLogs.length
      });

      return result;

    } catch (error) {
      logger.error('Failed to get user audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        userId,
        filters
      });
      throw error;
    }
  }

  /**
   * Calculate aggregations for audit logs
   */
  private calculateAuditAggregations(auditLogs: AuditLogEntry[]) {
    const actionTypeCounts: Record<string, number> = {};
    const adminCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};

    auditLogs.forEach(log => {
      // Action type counts
      actionTypeCounts[log.actionType] = (actionTypeCounts[log.actionType] || 0) + 1;

      // Admin counts
      const adminKey = `${log.adminName} (${log.adminId})`;
      adminCounts[adminKey] = (adminCounts[adminKey] || 0) + 1;

      // Category counts
      categoryCounts[log.category] = (categoryCounts[log.category] || 0) + 1;

      // Severity counts
      severityCounts[log.severity] = (severityCounts[log.severity] || 0) + 1;
    });

    return {
      actionTypeCounts,
      adminCounts,
      categoryCounts,
      severityCounts
    };
  }

  /**
   * Export audit logs in various formats
   */
  async exportAuditLogs(request: AuditExportRequest, adminId: string): Promise<AuditExportResponse> {
    try {
      logger.info('Admin exporting audit logs', { adminId, request });

      // Get audit logs based on filters
      const auditResult = await this.searchAuditLogs(request.filters, adminId);
      const auditLogs = auditResult.auditLogs;

      const exportId = `export_${adminId}_${Date.now()}`;
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `audit_logs_${timestamp}_${exportId}.${request.format}`;

      let fileContent: string;
      let fileSize: number;

      switch (request.format) {
        case 'csv':
          fileContent = this.generateCSVExport(auditLogs, request.includeMetadata);
          break;
        case 'json':
          fileContent = this.generateJSONExport(auditLogs, auditResult.aggregations, request.includeAggregations);
          break;
        case 'pdf':
          // For now, return JSON format for PDF (would need PDF library in production)
          fileContent = this.generateJSONExport(auditLogs, auditResult.aggregations, request.includeAggregations);
          break;
        default:
          throw new Error(`Unsupported export format: ${request.format}`);
      }

      fileSize = Buffer.byteLength(fileContent, 'utf8');

      // In a real implementation, you would save this to a file storage service
      // For now, we'll return a mock download URL
      const downloadUrl = `/api/admin/audit/export/${exportId}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      // Log the export action
      await this.logAdminAction(adminId, 'audit_export', {
        exportId,
        format: request.format,
        recordCount: auditLogs.length,
        filters: request.filters,
        includeMetadata: request.includeMetadata,
        includeAggregations: request.includeAggregations
      });

      const response: AuditExportResponse = {
        success: true,
        downloadUrl,
        fileName,
        fileSize,
        recordCount: auditLogs.length,
        exportId,
        expiresAt
      };

      logger.info('Audit logs export completed', {
        adminId,
        exportId,
        recordCount: auditLogs.length,
        fileSize
      });

      return response;

    } catch (error) {
      logger.error('Failed to export audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        request
      });
      throw error;
    }
  }

  /**
   * Generate CSV export format
   */
  private generateCSVExport(auditLogs: AuditLogEntry[], includeMetadata: boolean = false): string {
    const headers = [
      'ID',
      'Timestamp',
      'Admin Name',
      'Admin Email',
      'Action Type',
      'Target Type',
      'Target ID',
      'Target Name',
      'Reason',
      'Severity',
      'Category',
      'IP Address',
      'User Agent',
      'Session ID'
    ];

    if (includeMetadata) {
      headers.push('Metadata');
    }

    const csvRows = [headers.join(',')];

    auditLogs.forEach(log => {
      const row = [
        log.id,
        log.timestamp,
        `"${log.adminName}"`,
        `"${log.adminEmail || ''}"`,
        log.actionType,
        log.targetType,
        log.targetId,
        `"${log.targetName || ''}"`,
        `"${log.reason || ''}"`,
        log.severity,
        log.category,
        log.ipAddress || '',
        `"${log.userAgent || ''}"`,
        log.sessionId || ''
      ];

      if (includeMetadata) {
        row.push(`"${JSON.stringify(log.metadata).replace(/"/g, '""')}"`);
      }

      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Generate JSON export format
   */
  private generateJSONExport(
    auditLogs: AuditLogEntry[], 
    aggregations?: any, 
    includeAggregations: boolean = false
  ): string {
    const exportData: any = {
      exportTimestamp: new Date().toISOString(),
      recordCount: auditLogs.length,
      auditLogs
    };

    if (includeAggregations && aggregations) {
      exportData.aggregations = aggregations;
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get comprehensive user analytics for admin dashboard
   */
  async getUserAnalytics(filters: UserAnalyticsFilter, adminId: string): Promise<UserAnalyticsResponse> {
    try {
      logger.info('Admin getting comprehensive user analytics', { adminId, filters });

      const {
        dateRange,
        userSegments,
        roles,
        statuses,
        platforms,
        countries,
        includeGrowthTrends = true,
        includeActivityPatterns = true,
        includeBehavioralInsights = true,
        includeRetentionMetrics = true,
        includeGeographicData = true
      } = filters;

      // Set default date range if not provided
      const endDate = dateRange?.endDate || new Date().toISOString();
      const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get basic summary statistics
      const summary = await this.getAnalyticsSummary(startDate, endDate, roles, statuses);

      // Get user segments
      const userSegmentsData = await this.getUserSegments(roles, statuses);

      // Get real-time metrics
      const realTimeMetrics = await this.getRealTimeMetrics();

      // Initialize response
      const response: UserAnalyticsResponse = {
        summary,
        userSegments: userSegmentsData,
        realTimeMetrics,
        filters,
        generatedAt: new Date().toISOString()
      };

      // Add optional analytics based on filters
      if (includeGrowthTrends) {
        response.growthTrends = await this.getUserGrowthTrends(startDate, endDate);
      }

      if (includeActivityPatterns) {
        response.activityPatterns = await this.getUserActivityPatterns(startDate, endDate);
      }

      if (includeBehavioralInsights) {
        response.behavioralInsights = await this.getUserBehavioralInsights(startDate, endDate);
      }

      if (includeRetentionMetrics) {
        response.lifecycleMetrics = await this.getUserLifecycleMetrics();
      }

      if (includeGeographicData) {
        response.geographicDistribution = await this.getGeographicDistribution(countries);
        response.platformUsage = await this.getPlatformUsageStats(platforms);
      }

      // Log analytics access
      await this.logAdminAction(adminId, 'analytics_accessed', {
        filters,
        includedSections: {
          growthTrends: includeGrowthTrends,
          activityPatterns: includeActivityPatterns,
          behavioralInsights: includeBehavioralInsights,
          retentionMetrics: includeRetentionMetrics,
          geographicData: includeGeographicData
        }
      }, {
        targetType: 'analytics',
        category: 'user_management',
        severity: 'low'
      });

      logger.info('User analytics retrieved', { 
        adminId,
        summaryUsers: summary.totalUsers,
        includedSections: Object.keys(response).filter(key => key !== 'filters' && key !== 'generatedAt')
      });

      return response;

    } catch (error) {
      logger.error('Failed to get user analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get analytics summary statistics
   */
  private async getAnalyticsSummary(startDate: string, endDate: string, roles?: UserRole[], statuses?: UserStatus[]) {
    // Get total users
    let totalUsersQuery = this.supabase.from('users').select('*', { count: 'exact' });
    if (roles && roles.length > 0) {
      totalUsersQuery = totalUsersQuery.in('user_role', roles);
    }
    if (statuses && statuses.length > 0) {
      totalUsersQuery = totalUsersQuery.in('user_status', statuses);
    }
    const { count: totalUsers } = await totalUsersQuery;

    // Get active users
    const { count: activeUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('user_status', 'active');

    // Get new users for different periods
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: newUsersToday } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', today.toISOString());

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count: newUsersThisWeek } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', weekAgo.toISOString());

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count: newUsersThisMonth } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', monthAgo.toISOString());

    // Calculate growth rate (simplified)
    const previousMonthStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const { count: previousMonthUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', previousMonthStart.toISOString())
      .lt('created_at', monthAgo.toISOString());

    const userGrowthRate = previousMonthUsers && previousMonthUsers > 0 
      ? ((newUsersThisMonth || 0) - previousMonthUsers) / previousMonthUsers * 100 
      : 0;

    return {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      newUsersToday: newUsersToday || 0,
      newUsersThisWeek: newUsersThisWeek || 0,
      newUsersThisMonth: newUsersThisMonth || 0,
      churnRate: 0, // Placeholder - would need more complex calculation
      averageLifetimeValue: 0, // Placeholder - would need revenue data
      userGrowthRate
    };
  }

  /**
   * Get user segments data
   */
  private async getUserSegments(roles?: UserRole[], statuses?: UserStatus[]) {
    // Power users (high activity, high referrals)
    const { count: powerUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gt('total_referrals', 5)
      .eq('user_status', 'active');

    // Inactive users (no activity in 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count: inactiveUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .lt('last_activity_at', thirtyDaysAgo.toISOString())
      .eq('user_status', 'active');

    // High referral users
    const { count: highReferralUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gt('total_referrals', 10);

    // New users (registered in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count: newUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    // Churned users (deleted or suspended)
    const { count: churnedUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .in('user_status', ['deleted', 'suspended']);

    return {
      powerUsers: powerUsers || 0,
      inactiveUsers: inactiveUsers || 0,
      highReferralUsers: highReferralUsers || 0,
      newUsers: newUsers || 0,
      churnedUsers: churnedUsers || 0
    };
  }

  /**
   * Get real-time metrics
   */
  private async getRealTimeMetrics() {
    // Active now (users active in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: activeNow } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('last_activity_at', oneHourAgo.toISOString())
      .eq('user_status', 'active');

    // Sessions today (placeholder - would need session tracking)
    const sessionsToday = Math.floor((activeNow || 0) * 2.5); // Estimated

    // Top actions from admin_actions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: topActionsData } = await this.supabase
      .from('admin_actions')
      .select('action_type')
      .gte('created_at', today.toISOString())
      .limit(100);

    const actionCounts = (topActionsData || []).reduce((acc, action) => {
      acc[action.action_type] = (acc[action.action_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    return {
      activeNow: activeNow || 0,
      sessionsToday,
      averageSessionDuration: 25, // Placeholder - would need session tracking
      topActions
    };
  }

  /**
   * Get user growth trends
   */
  private async getUserGrowthTrends(startDate: string, endDate: string): Promise<UserGrowthTrend[]> {
    const trends: UserGrowthTrend[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Generate daily trends for the last 30 days
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const { count: newUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      const { count: activeUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .gte('last_activity_at', dayStart.toISOString())
        .eq('user_status', 'active');

      trends.push({
        period: dayStart.toISOString().split('T')[0],
        newUsers: newUsers || 0,
        activeUsers: activeUsers || 0,
        churnedUsers: 0, // Placeholder
        retentionRate: 0, // Placeholder
        growthRate: 0 // Placeholder
      });

      // Limit to prevent too many queries
      if (trends.length >= 30) break;
    }

    return trends;
  }

  /**
   * Get user activity patterns
   */
  private async getUserActivityPatterns(startDate: string, endDate: string): Promise<UserActivityPattern[]> {
    // This would require more detailed activity tracking
    // For now, return mock data based on typical patterns
    const patterns: UserActivityPattern[] = [];

    for (let hour = 0; hour < 24; hour++) {
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        patterns.push({
          hour,
          dayOfWeek,
          averageActivity: Math.floor(Math.random() * 100) + 10,
          peakActivity: Math.floor(Math.random() * 200) + 50,
          activityType: 'general'
        });
      }
    }

    return patterns;
  }

  /**
   * Get user behavioral insights
   */
  private async getUserBehavioralInsights(startDate: string, endDate: string): Promise<UserBehavioralInsight[]> {
    const insights: UserBehavioralInsight[] = [];

    // Power Users Insight
    const { count: powerUserCount } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gt('total_referrals', 5)
      .eq('user_status', 'active');

    insights.push({
      segment: 'Power Users',
      userCount: powerUserCount || 0,
      averageSessionDuration: 45,
      averageActionsPerSession: 12,
      conversionRate: 85,
      retentionRate: 92,
      characteristics: ['High referral activity', 'Long session duration', 'Frequent logins']
    });

    // New Users Insight
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count: newUserCount } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    insights.push({
      segment: 'New Users',
      userCount: newUserCount || 0,
      averageSessionDuration: 15,
      averageActionsPerSession: 5,
      conversionRate: 35,
      retentionRate: 65,
      characteristics: ['Exploring features', 'Short sessions', 'High drop-off rate']
    });

    return insights;
  }

  /**
   * Get user lifecycle metrics
   */
  private async getUserLifecycleMetrics(): Promise<UserLifecycleMetrics[]> {
    const metrics: UserLifecycleMetrics[] = [];

    // Get total user count for percentage calculations
    const { count: totalUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' });

    // New users (registered in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count: newUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    metrics.push({
      stage: 'new',
      userCount: newUsers || 0,
      percentage: totalUsers ? ((newUsers || 0) / totalUsers) * 100 : 0,
      averageDaysInStage: 3,
      transitionRates: { active: 70, churned: 30 }
    });

    // Active users
    const { count: activeUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('user_status', 'active');

    metrics.push({
      stage: 'active',
      userCount: activeUsers || 0,
      percentage: totalUsers ? ((activeUsers || 0) / totalUsers) * 100 : 0,
      averageDaysInStage: 45,
      transitionRates: { at_risk: 15, churned: 5, reactivated: 80 }
    });

    return metrics;
  }

  /**
   * Get geographic distribution
   */
  private async getGeographicDistribution(countries?: string[]): Promise<GeographicDistribution[]> {
    // This would require geographic data in the users table
    // For now, return mock data
    const mockDistribution: GeographicDistribution[] = [
      {
        country: 'United States',
        userCount: 1250,
        percentage: 35.2,
        averageActivityLevel: 8.5,
        topCities: [
          { city: 'New York', userCount: 320 },
          { city: 'Los Angeles', userCount: 280 },
          { city: 'Chicago', userCount: 180 }
        ]
      },
      {
        country: 'Canada',
        userCount: 450,
        percentage: 12.7,
        averageActivityLevel: 7.8,
        topCities: [
          { city: 'Toronto', userCount: 150 },
          { city: 'Vancouver', userCount: 120 },
          { city: 'Montreal', userCount: 90 }
        ]
      }
    ];

    return countries && countries.length > 0 
      ? mockDistribution.filter(dist => countries.includes(dist.country))
      : mockDistribution;
  }

  /**
   * Get platform usage statistics
   */
  private async getPlatformUsageStats(platforms?: string[]): Promise<PlatformUsageStats[]> {
    // This would require platform tracking in the users table
    // For now, return mock data
    const mockStats: PlatformUsageStats[] = [
      {
        platform: 'iOS',
        userCount: 1800,
        percentage: 45.0,
        averageSessionDuration: 28,
        retentionRate: 78
      },
      {
        platform: 'Android',
        userCount: 1600,
        percentage: 40.0,
        averageSessionDuration: 25,
        retentionRate: 72
      },
      {
        platform: 'Web',
        userCount: 600,
        percentage: 15.0,
        averageSessionDuration: 35,
        retentionRate: 85
      }
    ];

    return platforms && platforms.length > 0 
      ? mockStats.filter(stat => platforms.includes(stat.platform))
      : mockStats;
  }

  /**
   * Advanced user search with segments and analytics
   */
  async advancedUserSearch(filters: AdvancedUserSearchFilter, adminId: string): Promise<{
    users: any[];
    totalCount: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
    filters: AdvancedUserSearchFilter;
  }> {
    try {
      logger.info('Admin performing advanced user search', { adminId, filters });

      const {
        segments,
        activityLevel,
        registrationDateRange,
        lastActivityRange,
        referralCount,
        lifetimeValue,
        platform,
        country,
        sortBy = 'created_at',
        sortOrder = 'desc',
        limit = 50,
        offset = 0,
        email,
        name,
        role,
        status
      } = filters;

      // Start with base query
      let query = this.supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          user_role,
          user_status,
          created_at,
          last_activity_at,
          total_referrals,
          phone_number,
          profile_image_url
        `);

      // Apply base filters
      if (email) {
        query = query.ilike('email', `%${email}%`);
      }

      if (name) {
        query = query.ilike('name', `%${name}%`);
      }

      if (role && role.length > 0) {
        query = query.in('user_role', role);
      }

      if (status && status.length > 0) {
        query = query.in('user_status', status);
      }

      // Apply advanced filters
      if (registrationDateRange) {
        if (registrationDateRange.startDate) {
          query = query.gte('created_at', registrationDateRange.startDate);
        }
        if (registrationDateRange.endDate) {
          query = query.lte('created_at', registrationDateRange.endDate);
        }
      }

      if (lastActivityRange) {
        if (lastActivityRange.startDate) {
          query = query.gte('last_activity_at', lastActivityRange.startDate);
        }
        if (lastActivityRange.endDate) {
          query = query.lte('last_activity_at', lastActivityRange.endDate);
        }
      }

      if (referralCount) {
        if (referralCount.min !== undefined) {
          query = query.gte('total_referrals', referralCount.min);
        }
        if (referralCount.max !== undefined) {
          query = query.lte('total_referrals', referralCount.max);
        }
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Execute query with pagination
      const { data: users, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to search users: ${error.message}`);
      }

      // Apply client-side segment filtering if needed
      let filteredUsers = users || [];

      if (segments && segments.length > 0) {
        filteredUsers = filteredUsers.filter(user => {
          return segments.some(segment => {
            switch (segment) {
              case 'power_users':
                return user.total_referrals > 5 && user.user_status === 'active';
              case 'inactive_users':
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                return new Date(user.last_activity_at) < thirtyDaysAgo;
              case 'high_referral_users':
                return user.total_referrals > 10;
              case 'new_users':
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return new Date(user.created_at) > sevenDaysAgo;
              case 'churned_users':
                return ['deleted', 'suspended'].includes(user.user_status);
              default:
                return false;
            }
          });
        });
      }

      // Enrich users with additional data
      const enrichedUsers = filteredUsers.map(user => ({
        ...user,
        activityScore: this.calculateActivityScore(user),
        segmentTags: this.getUserSegmentTags(user)
      }));

      // Calculate pagination
      const totalCount = count || enrichedUsers.length;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      const hasMore = offset + limit < totalCount;

      const response = {
        users: enrichedUsers,
        totalCount,
        hasMore,
        currentPage,
        totalPages,
        filters
      };

      // Log advanced search
      await this.logAdminAction(adminId, 'advanced_user_search', {
        filters,
        resultCount: enrichedUsers.length,
        totalCount,
        segments: segments || [],
        sortBy,
        sortOrder
      }, {
        targetType: 'user_search',
        category: 'user_management',
        severity: 'low'
      });

      logger.info('Advanced user search completed', {
        adminId,
        resultCount: enrichedUsers.length,
        totalCount,
        segments: segments || []
      });

      return response;

    } catch (error) {
      logger.error('Failed to perform advanced user search', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
      });
      throw error;
    }
  }

  /**
   * Calculate activity score for a user
   */
  private calculateActivityScore(user: any): number {
    let score = 0;

    // Base score from status
    if (user.user_status === 'active') score += 40;
    else if (user.user_status === 'inactive') score += 20;

    // Score from referrals
    score += Math.min(user.total_referrals * 5, 30);

    // Score from recency of activity
    if (user.last_activity_at) {
      const daysSinceActivity = (Date.now() - new Date(user.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity < 1) score += 30;
      else if (daysSinceActivity < 7) score += 20;
      else if (daysSinceActivity < 30) score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Get segment tags for a user
   */
  private getUserSegmentTags(user: any): string[] {
    const tags: string[] = [];

    if (user.total_referrals > 10) tags.push('high_referral');
    if (user.total_referrals > 5 && user.user_status === 'active') tags.push('power_user');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (new Date(user.created_at) > sevenDaysAgo) tags.push('new_user');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (user.last_activity_at && new Date(user.last_activity_at) < thirtyDaysAgo) {
      tags.push('inactive');
    }

    if (['deleted', 'suspended'].includes(user.user_status)) tags.push('churned');

    return tags;
  }

  /**
   * Send status update notification to user
   */
  private async sendStatusUpdateNotification(userId: string, status: UserStatus, reason?: string): Promise<void> {
    try {
      // This would integrate with the notification system
      // For now, just log the notification
      logger.info('Status update notification would be sent', { userId, status, reason });
    } catch (error) {
      logger.error('Error sending status update notification', { error, userId, status });
    }
  }

  /**
   * Send notification when user status changes
   */
  private async sendUserStatusChangeNotification(
    userId: string,
    previousStatus: string,
    newStatus: string,
    reason?: string
  ): Promise<void> {
    try {
      let templateId: string;
      let dynamicData: Record<string, string> = {};

      // Determine template based on status change
      switch (newStatus) {
        case 'suspended':
          templateId = 'account_suspended';
          dynamicData = {
            reason: reason || '서비스 이용 규정 위반'
          };
          break;
        case 'active':
          if (previousStatus === 'suspended') {
            templateId = 'account_reactivated';
          } else {
            return; // Don't send notification for other activations
          }
          break;
        default:
          return; // Don't send notifications for other status changes
      }

      await this.notificationService.sendUserManagementNotification(
        userId,
        templateId,
        dynamicData,
        {
          relatedId: userId
        }
      );

      logger.info('User status change notification sent', {
        userId,
        templateId,
        previousStatus,
        newStatus
      });
    } catch (error) {
      logger.error('Failed to send user status change notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        previousStatus,
        newStatus
      });
    }
  }

  /**
   * Send notification when user role changes
   */
  private async sendUserRoleChangeNotification(
    userId: string,
    previousRole: string,
    newRole: string,
    reason?: string
  ): Promise<void> {
    try {
      // Only send notifications for role upgrades or significant changes
      const isUpgrade = (previousRole === 'user' && ['shop_owner', 'admin', 'influencer'].includes(newRole)) ||
                       (previousRole === 'shop_owner' && ['admin', 'influencer'].includes(newRole));

      if (!isUpgrade) {
        return; // Don't send notifications for downgrades or lateral moves
      }

      const dynamicData: Record<string, string> = {
        previousRole: this.getRoleDisplayName(previousRole),
        newRole: this.getRoleDisplayName(newRole),
        reason: reason || '시스템 관리자에 의한 권한 변경'
      };

      await this.notificationService.sendUserManagementNotification(
        userId,
        'role_upgraded',
        dynamicData,
        {
          relatedId: userId
        }
      );

      logger.info('User role change notification sent', {
        userId,
        previousRole,
        newRole
      });
    } catch (error) {
      logger.error('Failed to send user role change notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        previousRole,
        newRole
      });
    }
  }

  /**
   * Get display name for user role
   */
  private getRoleDisplayName(role: string): string {
    const roleNames: Record<string, string> = {
      user: '일반 사용자',
      shop_owner: '샵 운영자',
      admin: '관리자',
      influencer: '인플루언서'
    };
    return roleNames[role] || role;
  }

  /**
   * Send welcome notification to new user
   */
  async sendWelcomeNotification(userId: string, userName?: string): Promise<void> {
    try {
      const dynamicData: Record<string, string> = {};
      if (userName) {
        dynamicData.userName = userName;
      }

      await this.notificationService.sendUserManagementNotification(
        userId,
        'welcome',
        dynamicData,
        {
          relatedId: userId
        }
      );

      logger.info('Welcome notification sent', { userId, userName });
    } catch (error) {
      logger.error('Failed to send welcome notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        userName
      });
    }
  }

  /**
   * Send profile update confirmation notification
   */
  async sendProfileUpdateNotification(userId: string, updatedFields: string[]): Promise<void> {
    try {
      const dynamicData: Record<string, string> = {
        updatedFields: updatedFields.join(', ')
      };

      await this.notificationService.sendUserManagementNotification(
        userId,
        'profile_update_success',
        dynamicData,
        {
          relatedId: userId
        }
      );

      logger.info('Profile update notification sent', { userId, updatedFields });
    } catch (error) {
      logger.error('Failed to send profile update notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        updatedFields
      });
    }
  }

  /**
   * Send security alert notification
   */
  async sendSecurityAlertNotification(
    userId: string,
    alertType: 'password_change' | 'new_device_login' | 'suspicious_activity',
    metadata?: Record<string, string>
  ): Promise<void> {
    try {
      let templateId: string;
      const dynamicData: Record<string, string> = { ...metadata };

      switch (alertType) {
        case 'password_change':
          templateId = 'password_changed';
          break;
        case 'new_device_login':
          templateId = 'login_from_new_device';
          break;
        default:
          return; // Unknown alert type
      }

      await this.notificationService.sendUserManagementNotification(
        userId,
        templateId,
        dynamicData,
        {
          relatedId: userId
        }
      );

      logger.info('Security alert notification sent', { userId, alertType });
    } catch (error) {
      logger.error('Failed to send security alert notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        alertType
      });
    }
  }
}

export const adminUserManagementService = new AdminUserManagementService(); 