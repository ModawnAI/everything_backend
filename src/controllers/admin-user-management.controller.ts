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
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
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
        sortBy: sortBy as any,
        sortOrder: sortOrder as 'asc' | 'desc',
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const result = await adminUserManagementService.getUsers(filters, validation.admin.id);

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
   * PUT /api/admin/users/:id/status
   * Update user status
   */
  async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;
      const { status, reason, adminNotes, notifyUser } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
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

      const result = await adminUserManagementService.updateUserStatus(userId, request, validation.admin.id);

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
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
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

      if (!action || !['activate', 'suspend', 'delete', 'export'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Valid action is required (activate, suspend, delete, export)'
        });
        return;
      }

      const request = {
        userIds,
        action,
        reason,
        adminNotes
      };

      const result = await adminUserManagementService.performBulkAction(request, validation.admin.id);

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
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
        });
        return;
      }

      const statistics = await adminUserManagementService.getUserStatistics(validation.admin.id);

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
   * GET /api/admin/users/:id
   * Get detailed user information
   */
  async getUserDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
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
      const { data: user, error } = await adminUserManagementService['supabase']
        .from('users')
        .select(`
          *,
          reservations:reservations(id, status, created_at),
          point_transactions:point_transactions(id, amount, transaction_type, status, created_at),
          referrals:referrals(id, status, created_at)
        `)
        .eq('id', userId)
        .single();

      if (error || !user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      // Calculate additional statistics
      const totalReservations = user.reservations?.length || 0;
      const completedReservations = user.reservations?.filter((r: any) => r.status === 'completed').length || 0;
      const totalPointsEarned = user.point_transactions?.filter((t: any) => t.transaction_type === 'earned_service').reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
      const totalPointsUsed = user.point_transactions?.filter((t: any) => t.transaction_type === 'used_service').reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0) || 0;
      const successfulReferrals = user.referrals?.filter((r: any) => r.status === 'completed').length || 0;

      const userDetails = {
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
}

export const adminUserManagementController = new AdminUserManagementController(); 