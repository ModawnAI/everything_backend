/**
 * RBAC Content Integration Middleware
 * 
 * Integrates Role-Based Access Control with content validation and security middleware.
 * Provides comprehensive permission checking for social feed operations with context-aware
 * access control based on user roles, ownership, and content moderation status.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { requirePermission, PermissionService } from './rbac.middleware';
import { AuthenticatedRequest } from './auth.middleware';
import { 
  Resource, 
  PermissionAction, 
  UserRole,
  PermissionContext,
  PermissionResult 
} from '../types/permissions.types';
import { getSupabaseClient } from '../config/database';

export interface RBACContentConfig {
  resource: Resource;
  action: PermissionAction;
  enableOwnershipCheck: boolean;
  enableModerationStatusCheck: boolean;
  enableContentStatusCheck: boolean;
  allowSuperAdmin: boolean;
  customConditions?: string[];
  errorHandler?: (error: any, req: Request, res: Response) => void;
}

export interface ContentOwnershipContext {
  contentId?: string;
  authorId?: string;
  moderationStatus?: string;
  contentStatus?: string;
  isHidden?: boolean;
  requiresReview?: boolean;
}

export interface RBACContentResult {
  allowed: boolean;
  reason: string;
  userRole: UserRole;
  isOwner: boolean;
  canModerate: boolean;
  contentContext?: ContentOwnershipContext;
  appliedConditions: string[];
}

class RBACContentIntegration {
  private supabase = getSupabaseClient();
  private permissionService = new PermissionService();

  /**
   * Create RBAC middleware for feed posts
   */
  public forFeedPosts(action: PermissionAction, config?: Partial<RBACContentConfig>) {
    return this.createMiddleware('feed_posts', action, {
      resource: 'feed_posts',
      action,
      enableOwnershipCheck: true,
      enableModerationStatusCheck: true,
      enableContentStatusCheck: true,
      allowSuperAdmin: true,
      ...config
    });
  }

  /**
   * Create RBAC middleware for feed comments
   */
  public forFeedComments(action: PermissionAction, config?: Partial<RBACContentConfig>) {
    return this.createMiddleware('feed_comments', action, {
      resource: 'feed_comments',
      action,
      enableOwnershipCheck: true,
      enableModerationStatusCheck: true,
      enableContentStatusCheck: true,
      allowSuperAdmin: true,
      ...config
    });
  }

  /**
   * Create RBAC middleware for feed likes
   */
  public forFeedLikes(action: PermissionAction, config?: Partial<RBACContentConfig>) {
    return this.createMiddleware('feed_likes', action, {
      resource: 'feed_likes',
      action,
      enableOwnershipCheck: true,
      enableModerationStatusCheck: false,
      enableContentStatusCheck: false,
      allowSuperAdmin: true,
      ...config
    });
  }

  /**
   * Create RBAC middleware for feed reports
   */
  public forFeedReports(action: PermissionAction, config?: Partial<RBACContentConfig>) {
    return this.createMiddleware('feed_reports', action, {
      resource: 'feed_reports',
      action,
      enableOwnershipCheck: true,
      enableModerationStatusCheck: false,
      enableContentStatusCheck: false,
      allowSuperAdmin: true,
      ...config
    });
  }

  /**
   * Create RBAC middleware for feed moderation
   */
  public forFeedModeration(action: PermissionAction, config?: Partial<RBACContentConfig>) {
    return this.createMiddleware('feed_moderation', action, {
      resource: 'feed_moderation',
      action,
      enableOwnershipCheck: false,
      enableModerationStatusCheck: false,
      enableContentStatusCheck: false,
      allowSuperAdmin: true,
      customConditions: ['moderator_role'],
      ...config
    });
  }

  /**
   * Create generic RBAC middleware
   */
  private createMiddleware(
    resource: Resource, 
    action: PermissionAction, 
    config: RBACContentConfig
  ) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check authentication
        if (!req.user) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required for this operation',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Perform comprehensive RBAC check
        const result = await this.performRBACCheck(req, resource, action, config);

        if (!result.allowed) {
          this.handleAccessDenied(res, result, config);
          return;
        }

        // Add RBAC context to request for downstream middleware
        (req as any).rbacContext = {
          userRole: result.userRole,
          isOwner: result.isOwner,
          canModerate: result.canModerate,
          contentContext: result.contentContext,
          appliedConditions: result.appliedConditions
        };

        next();

      } catch (error) {
        logger.error('RBAC content integration error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          userId: req.user?.id,
          resource,
          action,
          path: req.path,
          method: req.method
        });

        if (config.errorHandler) {
          config.errorHandler(error, req, res);
          return;
        }

        res.status(500).json({
          success: false,
          error: {
            code: 'RBAC_CHECK_FAILED',
            message: 'Permission check failed. Please try again later.',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Perform comprehensive RBAC check
   */
  private async performRBACCheck(
    req: AuthenticatedRequest,
    resource: Resource,
    action: PermissionAction,
    config: RBACContentConfig
  ): Promise<RBACContentResult> {
    const userId = req.user!.id;
    const userRole = req.user!.role as UserRole;
    let contentContext: ContentOwnershipContext | undefined;
    let isOwner = false;
    let canModerate = false;
    const appliedConditions: string[] = [];

    // 1. Super admin override
    if (config.allowSuperAdmin && userRole === 'admin') {
      appliedConditions.push('admin_override');
      return {
        allowed: true,
        reason: 'Admin override - full access granted',
        userRole,
        isOwner: true, // Admins are considered owners for all content
        canModerate: true,
        appliedConditions
      };
    }

    // 2. Get content context if needed
    if (config.enableOwnershipCheck || config.enableModerationStatusCheck || config.enableContentStatusCheck) {
      contentContext = await this.getContentContext(req, resource);
      
      if (contentContext) {
        isOwner = contentContext.authorId === userId;
        appliedConditions.push('ownership_checked');
      }
    }

    // 3. Check moderation permissions
    canModerate = await this.checkModerationPermissions(userRole, resource);
    if (canModerate) {
      appliedConditions.push('moderation_permissions');
    }

    // 4. Basic permission check using existing RBAC system
    const permissionContext: PermissionContext = {
      userId,
      userRole,
      userStatus: req.user!.status || 'active',
      resourceId: contentContext?.contentId,
      resourceOwnerId: contentContext?.authorId,
      shopId: undefined, // Not applicable for feed content
      isEmailVerified: !!req.user!.email_confirmed_at,
      isPaymentVerified: true, // Assume verified for now - can be enhanced later
      requestTime: new Date()
    };

    const basicPermissionResult = await this.permissionService.checkPermission(
      permissionContext,
      resource,
      action,
      {
        resource,
        action,
        allowSuperAdmin: config.allowSuperAdmin,
        customConditions: config.customConditions?.map(condition => 
          (context: PermissionContext) => this.evaluateCustomCondition(condition, context, contentContext)
        )
      }
    );

    if (!basicPermissionResult.allowed) {
      return {
        allowed: false,
        reason: basicPermissionResult.reason || 'Basic permission check failed',
        userRole,
        isOwner,
        canModerate,
        contentContext,
        appliedConditions
      };
    }

    appliedConditions.push('basic_permissions');

    // 5. Content-specific checks
    if (contentContext) {
      // Check moderation status
      if (config.enableModerationStatusCheck) {
        const moderationCheck = this.checkModerationStatus(
          contentContext, 
          userRole, 
          isOwner, 
          canModerate, 
          action
        );
        
        if (!moderationCheck.allowed) {
          return {
            allowed: false,
            reason: moderationCheck.reason,
            userRole,
            isOwner,
            canModerate,
            contentContext,
            appliedConditions
          };
        }
        
        appliedConditions.push('moderation_status_checked');
      }

      // Check content status
      if (config.enableContentStatusCheck) {
        const contentStatusCheck = this.checkContentStatus(
          contentContext, 
          userRole, 
          isOwner, 
          canModerate, 
          action
        );
        
        if (!contentStatusCheck.allowed) {
          return {
            allowed: false,
            reason: contentStatusCheck.reason,
            userRole,
            isOwner,
            canModerate,
            contentContext,
            appliedConditions
          };
        }
        
        appliedConditions.push('content_status_checked');
      }
    }

    // 6. Custom conditions
    if (config.customConditions) {
      for (const condition of config.customConditions) {
        const conditionResult = await this.checkCustomCondition(
          condition, 
          permissionContext, 
          contentContext
        );
        
        if (!conditionResult.allowed) {
          return {
            allowed: false,
            reason: conditionResult.reason,
            userRole,
            isOwner,
            canModerate,
            contentContext,
            appliedConditions
          };
        }
        
        appliedConditions.push(`custom_condition_${condition}`);
      }
    }

    return {
      allowed: true,
      reason: 'All permission checks passed',
      userRole,
      isOwner,
      canModerate,
      contentContext,
      appliedConditions
    };
  }

  /**
   * Get content context for permission checking
   */
  private async getContentContext(
    req: AuthenticatedRequest, 
    resource: Resource
  ): Promise<ContentOwnershipContext | undefined> {
    try {
      const contentId = req.params.id || req.params.postId || req.params.commentId;
      if (!contentId) return undefined;

      let query;
      let tableName: string;

      switch (resource) {
        case 'feed_posts':
          tableName = 'feed_posts';
          query = this.supabase
            .from('feed_posts')
            .select('id, author_id, status, moderation_status, is_hidden, requires_review')
            .eq('id', contentId)
            .single();
          break;

        case 'feed_comments':
          tableName = 'feed_comments';
          query = this.supabase
            .from('feed_comments')
            .select('id, author_id, status, moderation_status, is_hidden, requires_review')
            .eq('id', contentId)
            .single();
          break;

        case 'feed_likes':
          // For likes, we need to check the target content (post or comment)
          const targetId = req.params.postId || req.params.commentId;
          const targetType = req.params.postId ? 'post' : 'comment';
          
          if (targetType === 'post') {
            tableName = 'feed_posts';
            query = this.supabase
              .from('feed_posts')
              .select('id, author_id, status, moderation_status, is_hidden, requires_review')
              .eq('id', targetId)
              .single();
          } else {
            tableName = 'feed_comments';
            query = this.supabase
              .from('feed_comments')
              .select('id, author_id, status, moderation_status, is_hidden, requires_review')
              .eq('id', targetId)
              .single();
          }
          break;

        default:
          return undefined;
      }

      const { data, error } = await query;

      if (error || !data) {
        logger.warn('Failed to get content context', { 
          resource, 
          contentId, 
          error: error?.message 
        });
        return undefined;
      }

      return {
        contentId: data.id,
        authorId: data.author_id,
        moderationStatus: data.moderation_status,
        contentStatus: data.status,
        isHidden: data.is_hidden,
        requiresReview: data.requires_review
      };

    } catch (error) {
      logger.warn('Error getting content context', { resource, error });
      return undefined;
    }
  }

  /**
   * Check if user has moderation permissions
   */
  private async checkModerationPermissions(userRole: UserRole, resource: Resource): Promise<boolean> {
    // Admins can moderate all content
    if (userRole === 'admin') return true;
    
    // In the future, you might have dedicated moderator roles
    // For now, only admins can moderate
    return false;
  }

  /**
   * Check moderation status restrictions
   */
  private checkModerationStatus(
    contentContext: ContentOwnershipContext,
    userRole: UserRole,
    isOwner: boolean,
    canModerate: boolean,
    action: PermissionAction
  ): { allowed: boolean; reason: string } {
    // Hidden content restrictions
    if (contentContext.isHidden) {
      if (canModerate) {
        return { allowed: true, reason: 'Moderator can access hidden content' };
      }
      
      if (isOwner && (action === 'read' || action === 'update' || action === 'delete')) {
        return { allowed: true, reason: 'Owner can access their hidden content' };
      }
      
      return { allowed: false, reason: 'Content is hidden and not accessible' };
    }

    // Content requiring review
    if (contentContext.requiresReview) {
      if (canModerate) {
        return { allowed: true, reason: 'Moderator can access content requiring review' };
      }
      
      if (isOwner && (action === 'read' || action === 'update' || action === 'delete')) {
        return { allowed: true, reason: 'Owner can access their content requiring review' };
      }
      
      if (action === 'read') {
        return { allowed: false, reason: 'Content requires review before public access' };
      }
    }

    // Moderation status specific checks
    switch (contentContext.moderationStatus) {
      case 'rejected':
        if (canModerate || isOwner) {
          return { allowed: true, reason: 'Moderator or owner can access rejected content' };
        }
        return { allowed: false, reason: 'Content has been rejected by moderation' };

      case 'quarantined':
        if (canModerate) {
          return { allowed: true, reason: 'Moderator can access quarantined content' };
        }
        if (isOwner && action !== 'read') {
          return { allowed: false, reason: 'Owner cannot modify quarantined content' };
        }
        return { allowed: false, reason: 'Content is quarantined' };

      default:
        return { allowed: true, reason: 'Moderation status allows access' };
    }
  }

  /**
   * Check content status restrictions
   */
  private checkContentStatus(
    contentContext: ContentOwnershipContext,
    userRole: UserRole,
    isOwner: boolean,
    canModerate: boolean,
    action: PermissionAction
  ): { allowed: boolean; reason: string } {
    switch (contentContext.contentStatus) {
      case 'draft':
        if (isOwner || canModerate) {
          return { allowed: true, reason: 'Owner or moderator can access draft content' };
        }
        return { allowed: false, reason: 'Draft content is not publicly accessible' };

      case 'archived':
        if (action === 'read') {
          return { allowed: true, reason: 'Archived content can be read' };
        }
        if (isOwner || canModerate) {
          return { allowed: true, reason: 'Owner or moderator can modify archived content' };
        }
        return { allowed: false, reason: 'Archived content cannot be modified' };

      case 'deleted':
        if (canModerate) {
          return { allowed: true, reason: 'Moderator can access deleted content' };
        }
        return { allowed: false, reason: 'Content has been deleted' };

      default:
        return { allowed: true, reason: 'Content status allows access' };
    }
  }

  /**
   * Evaluate custom condition for permission checking
   */
  private evaluateCustomCondition(
    condition: string,
    permissionContext: PermissionContext,
    contentContext?: ContentOwnershipContext
  ): boolean {
    switch (condition) {
      case 'moderator_role':
        return permissionContext.userRole === 'admin';
      case 'verified_user':
        return permissionContext.isEmailVerified === true;
      case 'content_owner':
        return contentContext?.authorId === permissionContext.userId;
      default:
        return false;
    }
  }

  /**
   * Check custom conditions
   */
  private async checkCustomCondition(
    condition: string,
    permissionContext: PermissionContext,
    contentContext?: ContentOwnershipContext
  ): Promise<{ allowed: boolean; reason: string }> {
    switch (condition) {
      case 'moderator_role':
        const canModerate = await this.checkModerationPermissions(
          permissionContext.userRole, 
          'feed_moderation'
        );
        return {
          allowed: canModerate,
          reason: canModerate ? 'User has moderator role' : 'User does not have moderator role'
        };

      case 'verified_user':
        // This would typically check if user is verified
        // For now, assume all authenticated users are verified
        return { allowed: true, reason: 'User is verified' };

      case 'content_owner':
        const isOwner = contentContext?.authorId === permissionContext.userId;
        return {
          allowed: isOwner,
          reason: isOwner ? 'User owns the content' : 'User does not own the content'
        };

      default:
        logger.warn('Unknown custom condition', { condition });
        return { allowed: false, reason: `Unknown condition: ${condition}` };
    }
  }

  /**
   * Handle access denied responses
   */
  private handleAccessDenied(
    res: Response, 
    result: RBACContentResult, 
    config: RBACContentConfig
  ): void {
    const statusCode = this.getStatusCodeForDenial(result.reason);
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: result.reason,
        details: {
          resource: config.resource,
          action: config.action,
          userRole: result.userRole,
          isOwner: result.isOwner,
          canModerate: result.canModerate,
          appliedConditions: result.appliedConditions
        },
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get appropriate HTTP status code for denial reason
   */
  private getStatusCodeForDenial(reason: string): number {
    if (reason.includes('hidden') || reason.includes('deleted') || reason.includes('rejected')) {
      return 404; // Not Found
    }
    if (reason.includes('quarantined') || reason.includes('review')) {
      return 423; // Locked
    }
    return 403; // Forbidden
  }
}

// Export singleton instance
export const rbacContentIntegration = new RBACContentIntegration();

// Export convenience functions
export function requireFeedPostPermission(action: PermissionAction, config?: Partial<RBACContentConfig>) {
  return rbacContentIntegration.forFeedPosts(action, config);
}

export function requireFeedCommentPermission(action: PermissionAction, config?: Partial<RBACContentConfig>) {
  return rbacContentIntegration.forFeedComments(action, config);
}

export function requireFeedLikePermission(action: PermissionAction, config?: Partial<RBACContentConfig>) {
  return rbacContentIntegration.forFeedLikes(action, config);
}

export function requireFeedReportPermission(action: PermissionAction, config?: Partial<RBACContentConfig>) {
  return rbacContentIntegration.forFeedReports(action, config);
}

export function requireFeedModerationPermission(action: PermissionAction, config?: Partial<RBACContentConfig>) {
  return rbacContentIntegration.forFeedModeration(action, config);
}
