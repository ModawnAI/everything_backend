/**
 * User Blocking Service
 *
 * Handles user blocking functionality for iOS Guideline 1.2 compliance.
 * Allows users to block other users, hiding their content from view.
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export type BlockReason = 'spam' | 'harassment' | 'inappropriate_content' | 'fake_account' | 'other';

export interface BlockUserRequest {
  blockerId: string;
  blockedUserId: string;
  reason?: BlockReason;
  description?: string;
}

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedUserId: string;
  reason: BlockReason;
  description?: string;
  createdAt: string;
  blockedUser?: {
    id: string;
    name: string;
    nickname?: string;
    profileImage?: string;
  };
}

export interface BlockNotification {
  id: string;
  blockId: string;
  blockerId: string;
  blockedUserId: string;
  reason: BlockReason;
  description?: string;
  isReviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  blocker?: {
    id: string;
    name: string;
    email?: string;
  };
  blockedUser?: {
    id: string;
    name: string;
    email?: string;
  };
}

export class UserBlockingServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'UserBlockingServiceError';
  }
}

class UserBlockingServiceImpl {
  private supabase = getSupabaseClient();

  /**
   * Block a user
   */
  async blockUser(request: BlockUserRequest): Promise<UserBlock> {
    const { blockerId, blockedUserId, reason = 'other', description } = request;

    // Validate: cannot block yourself
    if (blockerId === blockedUserId) {
      throw new UserBlockingServiceError(
        'Cannot block yourself',
        'CANNOT_BLOCK_SELF',
        400
      );
    }

    // Check if blocked user exists
    const { data: blockedUser, error: userError } = await this.supabase
      .from('users')
      .select('id, name')
      .eq('id', blockedUserId)
      .single();

    if (userError || !blockedUser) {
      throw new UserBlockingServiceError(
        'User to block not found',
        'USER_NOT_FOUND',
        404
      );
    }

    // Check if already blocked
    const { data: existingBlock } = await this.supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_user_id', blockedUserId)
      .single();

    if (existingBlock) {
      throw new UserBlockingServiceError(
        'User is already blocked',
        'ALREADY_BLOCKED',
        409
      );
    }

    // Create block
    const { data: block, error: blockError } = await this.supabase
      .from('user_blocks')
      .insert({
        blocker_id: blockerId,
        blocked_user_id: blockedUserId,
        reason,
        description,
      })
      .select(`
        id,
        blocker_id,
        blocked_user_id,
        reason,
        description,
        created_at
      `)
      .single();

    if (blockError) {
      logger.error('Failed to block user', {
        blockerId,
        blockedUserId,
        error: blockError.message,
      });
      throw new UserBlockingServiceError(
        'Failed to block user',
        'BLOCK_FAILED',
        500
      );
    }

    logger.info('User blocked successfully', {
      blockerId,
      blockedUserId,
      reason,
    });

    return {
      id: block.id,
      blockerId: block.blocker_id,
      blockedUserId: block.blocked_user_id,
      reason: block.reason,
      description: block.description,
      createdAt: block.created_at,
    };
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_user_id', blockedUserId);

    if (error) {
      logger.error('Failed to unblock user', {
        blockerId,
        blockedUserId,
        error: error.message,
      });
      throw new UserBlockingServiceError(
        'Failed to unblock user',
        'UNBLOCK_FAILED',
        500
      );
    }

    logger.info('User unblocked successfully', {
      blockerId,
      blockedUserId,
    });
  }

  /**
   * Get list of users blocked by a user
   */
  async getBlockedUsers(userId: string, page = 1, limit = 20): Promise<{
    blocks: UserBlock[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;

    // Get total count
    const { count } = await this.supabase
      .from('user_blocks')
      .select('*', { count: 'exact', head: true })
      .eq('blocker_id', userId);

    // Get blocked users with user info
    const { data: blocks, error } = await this.supabase
      .from('user_blocks')
      .select(`
        id,
        blocker_id,
        blocked_user_id,
        reason,
        description,
        created_at,
        blocked_user:users!blocked_user_id(
          id,
          name,
          nickname,
          profile_image
        )
      `)
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to get blocked users', {
        userId,
        error: error.message,
      });
      throw new UserBlockingServiceError(
        'Failed to get blocked users',
        'GET_BLOCKED_USERS_FAILED',
        500
      );
    }

    return {
      blocks: (blocks || []).map((block: any) => ({
        id: block.id,
        blockerId: block.blocker_id,
        blockedUserId: block.blocked_user_id,
        reason: block.reason,
        description: block.description,
        createdAt: block.created_at,
        blockedUser: block.blocked_user ? {
          id: block.blocked_user.id,
          name: block.blocked_user.name,
          nickname: block.blocked_user.nickname,
          profileImage: block.blocked_user.profile_image,
        } : undefined,
      })),
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Check if a user is blocked by another user
   */
  async isUserBlocked(blockerId: string, targetUserId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_user_id', targetUserId)
      .single();

    return !!data;
  }

  /**
   * Get all blocked user IDs for filtering content
   */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_blocks')
      .select('blocked_user_id')
      .eq('blocker_id', userId);

    if (error) {
      logger.error('Failed to get blocked user IDs', {
        userId,
        error: error.message,
      });
      return [];
    }

    return (data || []).map((block: any) => block.blocked_user_id);
  }

  // ========== Admin Functions ==========

  /**
   * Get block notifications for admin review
   */
  async getBlockNotifications(
    page = 1,
    limit = 20,
    onlyUnreviewed = false
  ): Promise<{
    notifications: BlockNotification[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('admin_block_notifications')
      .select(`
        id,
        block_id,
        blocker_id,
        blocked_user_id,
        reason,
        description,
        is_reviewed,
        reviewed_by,
        reviewed_at,
        review_notes,
        created_at,
        blocker:users!blocker_id(id, name, email),
        blocked_user:users!blocked_user_id(id, name, email)
      `, { count: 'exact' });

    if (onlyUnreviewed) {
      query = query.eq('is_reviewed', false);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to get block notifications', { error: error.message });
      throw new UserBlockingServiceError(
        'Failed to get block notifications',
        'GET_NOTIFICATIONS_FAILED',
        500
      );
    }

    return {
      notifications: (data || []).map((notification: any) => ({
        id: notification.id,
        blockId: notification.block_id,
        blockerId: notification.blocker_id,
        blockedUserId: notification.blocked_user_id,
        reason: notification.reason,
        description: notification.description,
        isReviewed: notification.is_reviewed,
        reviewedBy: notification.reviewed_by,
        reviewedAt: notification.reviewed_at,
        reviewNotes: notification.review_notes,
        createdAt: notification.created_at,
        blocker: notification.blocker ? {
          id: notification.blocker.id,
          name: notification.blocker.name,
          email: notification.blocker.email,
        } : undefined,
        blockedUser: notification.blocked_user ? {
          id: notification.blocked_user.id,
          name: notification.blocked_user.name,
          email: notification.blocked_user.email,
        } : undefined,
      })),
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Mark a block notification as reviewed
   */
  async reviewBlockNotification(
    notificationId: string,
    adminId: string,
    notes?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('admin_block_notifications')
      .update({
        is_reviewed: true,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      logger.error('Failed to review block notification', {
        notificationId,
        adminId,
        error: error.message,
      });
      throw new UserBlockingServiceError(
        'Failed to review block notification',
        'REVIEW_FAILED',
        500
      );
    }

    logger.info('Block notification reviewed', {
      notificationId,
      adminId,
    });
  }

  /**
   * Get block statistics for admin dashboard
   */
  async getBlockStatistics(): Promise<{
    totalBlocks: number;
    blocksToday: number;
    blocksThisWeek: number;
    unreviewedNotifications: number;
    topBlockReasons: { reason: string; count: number }[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Total blocks
    const { count: totalBlocks } = await this.supabase
      .from('user_blocks')
      .select('*', { count: 'exact', head: true });

    // Blocks today
    const { count: blocksToday } = await this.supabase
      .from('user_blocks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Blocks this week
    const { count: blocksThisWeek } = await this.supabase
      .from('user_blocks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    // Unreviewed notifications
    const { count: unreviewedNotifications } = await this.supabase
      .from('admin_block_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_reviewed', false);

    // Top block reasons (using raw query via RPC would be better, but this works)
    const { data: reasonData } = await this.supabase
      .from('user_blocks')
      .select('reason');

    const reasonCounts: Record<string, number> = {};
    (reasonData || []).forEach((block: any) => {
      reasonCounts[block.reason] = (reasonCounts[block.reason] || 0) + 1;
    });

    const topBlockReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalBlocks: totalBlocks || 0,
      blocksToday: blocksToday || 0,
      blocksThisWeek: blocksThisWeek || 0,
      unreviewedNotifications: unreviewedNotifications || 0,
      topBlockReasons,
    };
  }
}

export const userBlockingService = new UserBlockingServiceImpl();
