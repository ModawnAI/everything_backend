import { Request, Response } from 'express';
import { adminUserManagementService } from '../services/admin-user-management.service';
import { adminAuthService } from '../services/admin-auth.service';
import { logger } from '../utils/logger';
import { UserRole, UserStatus } from '../types/database.types';

// Create validation arrays for type checking
const VALID_USER_ROLES: UserRole[] = ['user', 'shop_owner', 'admin', 'influencer'];
const VALID_USER_STATUSES: UserStatus[] = ['active', 'inactive', 'suspended', 'deleted'];

export class AdminUserManagementController {
  /**
   * GET /api/admin/users
   * Get users with advanced search and filtering
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Extract and validate query parameters
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
        sortBy,
        sortOrder,
        page = '1',
        limit = '20'
      } = req.query;

      // Validate role if provided
      if (role && !VALID_USER_ROLES.includes(role as UserRole)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role'
        });
        return;
      }

      // Validate status if provided
      if (status && !VALID_USER_STATUSES.includes(status as UserStatus)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
        return;
      }

      // Validate sort order
      if (sortOrder && !['asc', 'desc'].includes(sortOrder as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid sort order. Must be "asc" or "desc"'
        });
        return;
      }

      // Map frontend camelCase sort fields to database snake_case columns
      type ValidSortField = 'created_at' | 'name' | 'email' | 'last_login_at' | 'total_points' | 'total_referrals';
      const sortByMap: Record<string, ValidSortField> = {
        'createdAt': 'created_at',
        'updatedAt': 'created_at', // Map updatedAt to created_at since it's not in the valid list
        'lastLoginAt': 'last_login_at',
        'totalPoints': 'total_points',
        'totalReferrals': 'total_referrals',
        'name': 'name',
        'email': 'email'
      };

      const mappedSortBy = (sortBy ? (sortByMap[sortBy as string] || 'created_at') : 'created_at') as ValidSortField;

      const filters = {
        search: search as string,
        role: role as UserRole,
        status: status as UserStatus,
        gender: gender as any,
        isInfluencer: isInfluencer === 'true' ? true : isInfluencer === 'false' ? false : undefined,
        phoneVerified: phoneVerified === 'true' ? true : phoneVerified === 'false' ? false : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
        lastLoginStart: lastLoginStart as string,
        lastLoginEnd: lastLoginEnd as string,
        hasReferrals: hasReferrals === 'true' ? true : hasReferrals === 'false' ? false : undefined,
        minPoints: minPoints ? parseInt(minPoints as string, 10) : undefined,
        maxPoints: maxPoints ? parseInt(maxPoints as string, 10) : undefined,
        sortBy: mappedSortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const result = await adminUserManagementService.getUsers(filters, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin get users failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get users'
      });
    }
  }

  /**
   * GET /api/admin/users/roles
   * Get list of available user roles
   */
  async getUserRoles(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: VALID_USER_ROLES.map(role => ({
          value: role,
          label: role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        }))
      });
    } catch (error) {
      logger.error('Admin get user roles failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user roles'
      });
    }
  }

  /**
   * PUT /api/admin/users/:id/status
   * Update user status
   */
  async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;
      const { status, reason, adminNotes, notifyUser } = req.body;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      if (!status || !VALID_USER_STATUSES.includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Valid status is required'
        });
        return;
      }

      const request = {
        status,
        reason,
        adminNotes,
        notifyUser: notifyUser === true
      };

      const result = await adminUserManagementService.updateUserStatus(userId, request, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin update user status failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        ipAddress: req.ip
      });

      const errorMessage = error instanceof Error ? error.message : 'Failed to update user status';
      
      res.status(500).json({
        success: false,
        error: errorMessage.includes('User not found') ? 'User not found' : 'Failed to update user status'
      });
    }
  }

  /**
   * POST /api/admin/users/bulk-action
   * Perform bulk actions on users
   */
  async performBulkAction(req: Request, res: Response): Promise<void> {
    try {
      const { userIds, action, reason, adminNotes } = req.body;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'User IDs array is required'
        });
        return;
      }

      if (!action || !['activate', 'suspend', 'delete', 'export', 'change_role'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Valid action is required (activate, suspend, delete, export, change_role)'
        });
        return;
      }

      // Extract additional parameters for enhanced bulk operations
      const {
        targetRole,
        useTransaction = true,
        batchSize = 50
      } = req.body;

      // Validate change_role specific parameters
      if (action === 'change_role') {
        if (!targetRole || !VALID_USER_ROLES.includes(targetRole)) {
          res.status(400).json({
            success: false,
            error: 'Valid target role is required for change_role action'
          });
          return;
        }

        // Prevent privilege escalation - only admins can assign admin role
        if (targetRole === 'admin' && user.role !== 'admin') {
          res.status(403).json({
            success: false,
            error: 'Insufficient privileges to assign admin role'
          });
          return;
        }
      }

      // Validate batch size
      if (batchSize && (batchSize < 1 || batchSize > 100)) {
        res.status(400).json({
          success: false,
          error: 'Batch size must be between 1 and 100'
        });
        return;
      }

      const request = {
        userIds,
        action,
        reason,
        adminNotes,
        targetRole,
        useTransaction,
        batchSize
      };

      const result = await adminUserManagementService.performBulkAction(request, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin bulk action failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk action'
      });
    }
  }

  /**
   * GET /api/admin/users/statistics
   * Get user statistics for admin dashboard
   */
  async getUserStatistics(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const statistics = await adminUserManagementService.getUserStatistics(user.id);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Admin get user statistics failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user statistics'
      });
    }
  }

  /**
   * PUT /api/admin/users/:id/role
   * Update user role
   */
  async updateUserRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;
      const { role, reason, adminNotes } = req.body;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      if (!role || !VALID_USER_ROLES.includes(role)) {
        res.status(400).json({
          success: false,
          error: 'Valid role is required (user, shop_owner, admin, influencer)'
        });
        return;
      }

      // Prevent privilege escalation - only super admins can create admins
      if (role === 'admin' && user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Insufficient privileges to assign admin role'
        });
        return;
      }

      const request = {
        role,
        reason,
        adminNotes
      };

      const result = await adminUserManagementService.updateUserRole(userId, request, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin update user role failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        ipAddress: req.ip
      });

      const errorMessage = error instanceof Error ? error.message : 'Failed to update user role';
      
      res.status(500).json({
        success: false,
        error: errorMessage.includes('User not found') ? 'User not found' : 'Failed to update user role'
      });
    }
  }

  /**
   * GET /api/admin/users/activity
   * Get user activity feed for admin monitoring
   */
  async getUserActivity(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Extract and validate query parameters
      const {
        userId,
        activityTypes,
        severity,
        startDate,
        endDate,
        page = '1',
        limit = '50'
      } = req.query;

      const filters = {
        userId: userId as string,
        activityTypes: activityTypes ? (activityTypes as string).split(',') : undefined,
        severity: severity ? (severity as string).split(',') : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: Math.min(parseInt(limit as string, 10), 100), // Max 100 items per page
        offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10)
      };

      const result = await adminUserManagementService.getUserActivity(filters, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin get user activity failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user activity'
      });
    }
  }

  /**
   * GET /api/admin/users/:id
   * Get detailed user information
   */
  async getUserDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      // Get user with detailed information
      const { data: userData, error } = await adminUserManagementService['supabase']
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !userData) {
        logger.error('Failed to fetch user details', {
          userId,
          error: error?.message,
          errorCode: error?.code,
          details: error?.details
        });
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      // Fetch related data separately to avoid Supabase relationship issues
      const { data: reservations } = await adminUserManagementService['supabase']
        .from('reservations')
        .select('id, status, created_at')
        .eq('user_id', userId);

      const { data: referrals } = await adminUserManagementService['supabase']
        .from('referrals')
        .select('id, status, created_at')
        .eq('referrer_id', userId);

      // Attach related data to userData object
      userData.reservations = reservations || [];
      userData.referrals = referrals || [];

      // Calculate additional statistics
      const totalReservations = userData.reservations?.length || 0;
      const completedReservations = userData.reservations?.filter((r: any) => r.status === 'completed').length || 0;
      // Note: point_transactions table doesn't exist yet, using userData's total_points fields instead
      const totalPointsEarned = userData.total_points || 0;
      const totalPointsUsed = (userData.total_points || 0) - (userData.available_points || 0);
      const successfulReferrals = userData.referrals?.filter((r: any) => r.status === 'completed').length || 0;

      const userDetails = {
        id: userData.id,
        email: userData.email,
        phoneNumber: userData.phone_number,
        phoneVerified: userData.phone_verified,
        name: userData.name,
        nickname: userData.nickname,
        gender: userData.gender,
        birthDate: userData.birth_date,
        userRole: userData.user_role,
        userStatus: userData.user_status,
        isInfluencer: userData.is_influencer,
        influencerQualifiedAt: userData.influencer_qualified_at,
        socialProvider: userData.social_provider,
        referralCode: userData.referral_code,
        referredByCode: userData.referred_by_code,
        totalPoints: userData.total_points,
        availablePoints: userData.available_points,
        totalReferrals: userData.total_referrals,
        successfulReferrals: userData.successful_referrals,
        lastLoginAt: userData.last_login_at,
        lastLoginIp: userData.last_login_ip,
        termsAcceptedAt: userData.terms_accepted_at,
        privacyAcceptedAt: userData.privacy_accepted_at,
        marketingConsent: userData.marketing_consent,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
        // Additional statistics
        statistics: {
          totalReservations,
          completedReservations,
          totalPointsEarned,
          totalPointsUsed,
          successfulReferrals,
          completionRate: totalReservations > 0 ? (completedReservations / totalReservations) * 100 : 0
        }
      };

      res.json({
        success: true,
        data: userDetails
      });
    } catch (error) {
      logger.error('Admin get user details failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user details'
      });
    }
  }

  /**
   * Search audit logs with comprehensive filtering
   */
  async searchAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Extract and validate query parameters
      const {
        userId,
        adminId,
        actionTypes,
        targetTypes,
        categories,
        severity,
        startDate,
        endDate,
        searchTerm,
        ipAddress: filterIpAddress,
        sessionId,
        page = '1',
        limit = '50'
      } = req.query;

      const filters = {
        userId: userId as string,
        adminId: adminId as string,
        actionTypes: actionTypes ? (actionTypes as string).split(',') : undefined,
        targetTypes: targetTypes ? (targetTypes as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        severity: severity ? (severity as string).split(',') : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
        searchTerm: searchTerm as string,
        ipAddress: filterIpAddress as string,
        sessionId: sessionId as string,
        limit: Math.min(parseInt(limit as string, 10), 100), // Max 100 items per page
        offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10)
      };

      const result = await adminUserManagementService.searchAuditLogs(filters, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin audit logs search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to search audit logs'
      });
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      // Extract query parameters for filtering
      const {
        actionTypes,
        targetTypes,
        categories,
        severity,
        startDate,
        endDate,
        searchTerm,
        page = '1',
        limit = '50'
      } = req.query;

      const filters = {
        actionTypes: actionTypes ? (actionTypes as string).split(',') : undefined,
        targetTypes: targetTypes ? (targetTypes as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        severity: severity ? (severity as string).split(',') : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
        searchTerm: searchTerm as string,
        limit: Math.min(parseInt(limit as string, 10), 100),
        offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10)
      };

      const result = await adminUserManagementService.getUserAuditLogs(userId, filters, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin get user audit logs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        ipAddress: req.ip
      });

      const errorMessage = error instanceof Error ? error.message : 'Failed to get user audit logs';
      
      res.status(500).json({
        success: false,
        error: errorMessage.includes('User not found') ? 'User not found' : 'Failed to get user audit logs'
      });
    }
  }

  /**
   * Export audit logs in various formats
   */
  async exportAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const {
        format = 'json',
        includeMetadata = false,
        includeAggregations = false,
        ...filterParams
      } = req.body;

      // Validate format
      if (!['csv', 'json', 'pdf'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'Invalid export format. Supported formats: csv, json, pdf'
        });
        return;
      }

      // Build filters from request body
      const filters = {
        userId: filterParams.userId,
        adminId: filterParams.adminId,
        actionTypes: filterParams.actionTypes,
        targetTypes: filterParams.targetTypes,
        categories: filterParams.categories,
        severity: filterParams.severity,
        startDate: filterParams.startDate,
        endDate: filterParams.endDate,
        searchTerm: filterParams.searchTerm,
        ipAddress: filterParams.ipAddress,
        sessionId: filterParams.sessionId,
        limit: Math.min(filterParams.limit || 1000, 10000), // Max 10k records for export
        offset: filterParams.offset || 0
      };

      const exportRequest = {
        format,
        filters,
        includeMetadata: Boolean(includeMetadata),
        includeAggregations: Boolean(includeAggregations)
      };

      const result = await adminUserManagementService.exportAuditLogs(exportRequest, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin audit logs export failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to export audit logs'
      });
    }
  }

  /**
   * Get comprehensive user analytics for admin dashboard
   */
  async getUserAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Extract query parameters for analytics filters
      const {
        startDate,
        endDate,
        userSegments,
        roles,
        statuses,
        platforms,
        countries,
        includeGrowthTrends = 'true',
        includeActivityPatterns = 'true',
        includeBehavioralInsights = 'true',
        includeRetentionMetrics = 'true',
        includeGeographicData = 'true'
      } = req.query;

      const filters = {
        dateRange: startDate && endDate ? {
          startDate: startDate as string,
          endDate: endDate as string
        } : undefined,
        userSegments: userSegments ? (userSegments as string).split(',') as any[] : undefined,
        roles: roles ? (roles as string).split(',') as any[] : undefined,
        statuses: statuses ? (statuses as string).split(',') as any[] : undefined,
        platforms: platforms ? (platforms as string).split(',') : undefined,
        countries: countries ? (countries as string).split(',') : undefined,
        includeGrowthTrends: includeGrowthTrends === 'true',
        includeActivityPatterns: includeActivityPatterns === 'true',
        includeBehavioralInsights: includeBehavioralInsights === 'true',
        includeRetentionMetrics: includeRetentionMetrics === 'true',
        includeGeographicData: includeGeographicData === 'true'
      };

      const result = await adminUserManagementService.getUserAnalytics(filters, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin get user analytics failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user analytics'
      });
    }
  }

  /**
   * Advanced user search with segments and analytics
   */
  async advancedUserSearch(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Extract query parameters for advanced search
      const {
        email,
        name,
        role,
        status,
        segments,
        activityLevel,
        registrationStartDate,
        registrationEndDate,
        lastActivityStartDate,
        lastActivityEndDate,
        referralMin,
        referralMax,
        lifetimeValueMin,
        lifetimeValueMax,
        platform,
        country,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = '1',
        limit = '50'
      } = req.query;

      const filters = {
        email: email as string,
        name: name as string,
        role: role ? (role as string).split(',') as any[] : undefined,
        status: status ? (status as string).split(',') as any[] : undefined,
        segments: segments ? (segments as string).split(',') as any[] : undefined,
        activityLevel: activityLevel as any,
        registrationDateRange: registrationStartDate && registrationEndDate ? {
          startDate: registrationStartDate as string,
          endDate: registrationEndDate as string
        } : undefined,
        lastActivityRange: lastActivityStartDate && lastActivityEndDate ? {
          startDate: lastActivityStartDate as string,
          endDate: lastActivityEndDate as string
        } : undefined,
        referralCount: referralMin || referralMax ? {
          min: referralMin ? parseInt(referralMin as string, 10) : undefined,
          max: referralMax ? parseInt(referralMax as string, 10) : undefined
        } : undefined,
        lifetimeValue: lifetimeValueMin || lifetimeValueMax ? {
          min: lifetimeValueMin ? parseFloat(lifetimeValueMin as string) : undefined,
          max: lifetimeValueMax ? parseFloat(lifetimeValueMax as string) : undefined
        } : undefined,
        platform: platform ? (platform as string).split(',') : undefined,
        country: country ? (country as string).split(',') : undefined,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        limit: Math.min(parseInt(limit as string, 10), 100),
        offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10)
      };

      const result = await adminUserManagementService.advancedUserSearch(filters, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin advanced user search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to perform advanced user search'
      });
    }
  }
}

export const adminUserManagementController = new AdminUserManagementController(); 