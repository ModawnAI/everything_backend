import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { UserRole, UserStatus } from '../types/database.types';

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
  action: 'activate' | 'suspend' | 'delete' | 'export';
  reason?: string;
  adminNotes?: string;
}

export interface UserBulkActionResponse {
  success: boolean;
  results: Array<{
    userId: string;
    success: boolean;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export class AdminUserManagementService {
  private supabase = getSupabaseClient();

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

      // Log admin action
      await this.logAdminAction(adminId, 'user_status_update', {
        userId,
        previousStatus,
        newStatus: request.status,
        reason: request.reason,
        adminNotes: request.adminNotes,
        notifyUser: request.notifyUser
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
        await this.sendStatusUpdateNotification(userId, request.status, request.reason);
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
   * Perform bulk actions on users
   */
  async performBulkAction(
    request: UserBulkActionRequest, 
    adminId: string
  ): Promise<UserBulkActionResponse> {
    try {
      logger.info('Admin performing bulk action', { adminId, action: request.action, userCount: request.userIds.length });

      const results: Array<{ userId: string; success: boolean; error?: string }> = [];
      let successful = 0;
      let failed = 0;

      for (const userId of request.userIds) {
        try {
          switch (request.action) {
            case 'activate':
              await this.updateUserStatus(userId, {
                status: 'active',
                reason: request.reason,
                adminNotes: request.adminNotes,
                notifyUser: false
              }, adminId);
              break;

            case 'suspend':
              await this.updateUserStatus(userId, {
                status: 'suspended',
                reason: request.reason,
                adminNotes: request.adminNotes,
                notifyUser: true
              }, adminId);
              break;

            case 'delete':
              // Soft delete - update status to deleted
              await this.updateUserStatus(userId, {
                status: 'deleted',
                reason: request.reason,
                adminNotes: request.adminNotes,
                notifyUser: false
              }, adminId);
              break;

            case 'export':
              // This would trigger an export process
              // For now, just mark as successful
              break;

            default:
              throw new Error(`Unknown action: ${request.action}`);
          }

          results.push({ userId, success: true });
          successful++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ userId, success: false, error: errorMessage });
          failed++;
        }
      }

      // Log bulk action
      await this.logAdminAction(adminId, 'user_bulk_action', {
        action: request.action,
        userIds: request.userIds,
        reason: request.reason,
        results: { successful, failed }
      });

      const response: UserBulkActionResponse = {
        success: true,
        results,
        summary: {
          total: request.userIds.length,
          successful,
          failed
        }
      };

      logger.info('Bulk action completed', { 
        adminId, 
        action: request.action,
        successful,
        failed 
      });

      return response;
    } catch (error) {
      logger.error('Bulk action failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        request
      });
      throw error;
    }
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
   * Log admin action
   */
  private async logAdminAction(adminId: string, action: string, metadata: any): Promise<void> {
    try {
      await this.supabase
        .from('admin_actions')
        .insert({
          admin_id: adminId,
          action_type: action,
          target_type: 'user',
          metadata,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging admin action', { error, adminId, action });
    }
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
}

export const adminUserManagementService = new AdminUserManagementService(); 