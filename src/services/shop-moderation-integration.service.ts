import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ShopStatus } from '../types/database.types';
import { ModerationAction } from '../types/moderation';
import { moderationActionsService } from './moderation-actions.service';
import { shopReportingService } from './shop-reporting.service';
import { contentModerationService } from './content-moderation.service';

export interface ShopModerationStatus {
  shop_id: string;
  current_status: ShopStatus;
  moderation_status: 'clean' | 'flagged' | 'under_review' | 'suspended' | 'blocked';
  report_count: number;
  pending_reports: number;
  last_moderation_action?: string;
  last_moderation_date?: string;
  violation_score: number;
  warning_count: number;
  suspension_count: number;
  auto_hidden: boolean;
  requires_review: boolean;
}

export interface ModerationActionRequest {
  action_type: 'suspend' | 'activate' | 'flag' | 'block' | 'warn' | 'approve';
  reason: string;
  moderator_id: string;
  report_id?: string;
  duration_hours?: number; // For temporary suspensions
  notify_owner?: boolean;
  notify_customers?: boolean;
}

export interface ShopModerationResult {
  success: boolean;
  shop_id: string;
  previous_status: ShopStatus;
  new_status: ShopStatus;
  action_taken: string;
  message: string;
  notifications_sent: string[];
  cache_invalidated: boolean;
}

class ShopModerationIntegrationService {
  private supabase = getSupabaseClient();

  /**
   * Get comprehensive moderation status for a shop
   */
  async getShopModerationStatus(shopId: string): Promise<ShopModerationStatus | null> {
    try {
      logger.info('Getting shop moderation status', { shopId });

      // Get shop basic info
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, shop_status, name, owner_id')
        .eq('id', shopId)
        .single();

      if (shopError || !shop) {
        logger.warn('Shop not found for moderation status', { shopId, error: shopError?.message });
        return null;
      }

      // Get report statistics
      const { data: reports, error: reportsError } = await this.supabase
        .from('shop_reports')
        .select('id, status, report_type, created_at')
        .eq('shop_id', shopId);

      if (reportsError) {
        logger.error('Failed to fetch shop reports for moderation status', { 
          shopId, 
          error: reportsError.message 
        });
        throw new Error('Failed to fetch shop reports');
      }

      // Get moderation actions
      const { data: actions, error: actionsError } = await this.supabase
        .from('moderation_actions')
        .select('id, action_type, severity, created_at')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (actionsError) {
        logger.error('Failed to fetch moderation actions', { 
          shopId, 
          error: actionsError.message 
        });
        throw new Error('Failed to fetch moderation actions');
      }

      // Calculate statistics
      const reportCount = reports?.length || 0;
      const pendingReports = reports?.filter(r => r.status === 'pending').length || 0;
      const warningCount = actions?.filter(a => a.action_type === 'warning').length || 0;
      const suspensionCount = actions?.filter(a => a.action_type === 'suspend').length || 0;

      // Calculate violation score based on recent actions and reports
      let violationScore = 0;
      if (actions && actions.length > 0) {
        violationScore = actions.reduce((score, action) => {
          switch (action.severity) {
            case 'low': return score + 10;
            case 'medium': return score + 30;
            case 'high': return score + 60;
            case 'critical': return score + 100;
            default: return score;
          }
        }, 0);
      }

      // Determine moderation status
      let moderationStatus: ShopModerationStatus['moderation_status'] = 'clean';
      if (shop.shop_status === 'suspended') {
        moderationStatus = 'suspended';
      } else if (shop.shop_status === 'inactive' && violationScore > 50) {
        moderationStatus = 'blocked';
      } else if (pendingReports > 0 || violationScore > 30) {
        moderationStatus = 'flagged';
      } else if (violationScore > 10) {
        moderationStatus = 'under_review';
      }

      // Check if shop should be auto-hidden
      const autoHidden = this.shouldAutoHide(reportCount, violationScore, pendingReports);
      const requiresReview = pendingReports > 0 || violationScore > 50;

      const status: ShopModerationStatus = {
        shop_id: shopId,
        current_status: shop.shop_status as ShopStatus,
        moderation_status: moderationStatus,
        report_count: reportCount,
        pending_reports: pendingReports,
        last_moderation_action: actions?.[0]?.action_type,
        last_moderation_date: actions?.[0]?.created_at,
        violation_score: violationScore,
        warning_count: warningCount,
        suspension_count: suspensionCount,
        auto_hidden: autoHidden,
        requires_review: requiresReview
      };

      logger.info('Shop moderation status retrieved', { 
        shopId, 
        moderationStatus: status.moderation_status,
        violationScore: status.violation_score,
        reportCount: status.report_count
      });

      return status;
    } catch (error) {
      logger.error('Error getting shop moderation status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      throw error;
    }
  }

  /**
   * Execute a moderation action on a shop
   */
  async executeModerationAction(
    shopId: string, 
    request: ModerationActionRequest
  ): Promise<ShopModerationResult> {
    try {
      logger.info('Executing moderation action', { shopId, actionType: request.action_type });

      // Get current shop status
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, shop_status, name, owner_id')
        .eq('id', shopId)
        .single();

      if (shopError || !shop) {
        throw new Error('Shop not found');
      }

      const previousStatus = shop.shop_status as ShopStatus;
      let newStatus: ShopStatus = previousStatus;
      let actionTaken = request.action_type;

      // Determine new status based on action
      switch (request.action_type) {
        case 'suspend':
          newStatus = 'suspended';
          await this.suspendShop(shopId, request);
          break;
        case 'activate':
        case 'approve':
          newStatus = 'active';
          await this.activateShop(shopId, request);
          break;
        case 'block':
          newStatus = 'inactive';
          await this.blockShop(shopId, request);
          break;
        case 'flag':
          await this.flagShop(shopId, request);
          break;
        case 'warn':
          await this.warnShop(shopId, request);
          break;
        default:
          throw new Error(`Unknown moderation action: ${request.action_type}`);
      }

      // Update shop status if it changed
      if (newStatus !== previousStatus) {
        const { error: updateError } = await this.supabase
          .from('shops')
          .update({
            shop_status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', shopId);

        if (updateError) {
          logger.error('Failed to update shop status', { 
            shopId, 
            newStatus, 
            error: updateError.message 
          });
          throw new Error('Failed to update shop status');
        }
      }

      // Create moderation action record
      await moderationActionsService.createModerationAction(shopId, {
        action_type: request.action_type as any,
        reason: request.reason,
        details: `Moderation action: ${request.action_type}. Reason: ${request.reason}`,
        moderator_id: request.moderator_id
      }, request.report_id);

      // Send notifications
      const notificationsSent = await this.sendModerationNotifications(shopId, request);

      // Invalidate search cache
      await this.invalidateShopCache(shopId);

      const result: ShopModerationResult = {
        success: true,
        shop_id: shopId,
        previous_status: previousStatus,
        new_status: newStatus,
        action_taken: actionTaken,
        message: `Shop ${actionTaken} successfully`,
        notifications_sent: notificationsSent,
        cache_invalidated: true
      };

      logger.info('Moderation action executed successfully', {
        shopId,
        actionType: request.action_type,
        previousStatus,
        newStatus
      });

      return result;
    } catch (error) {
      logger.error('Error executing moderation action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        actionType: request.action_type
      });
      throw error;
    }
  }

  /**
   * Automatically process shop based on report count and violation score
   */
  async processAutomaticModeration(shopId: string): Promise<ShopModerationResult | null> {
    try {
      logger.info('Processing automatic moderation for shop', { shopId });

      const moderationStatus = await this.getShopModerationStatus(shopId);
      if (!moderationStatus) {
        return null;
      }

      // Determine if automatic action is needed
      let actionType: ModerationActionRequest['action_type'] | null = null;
      let reason = '';

      if (moderationStatus.violation_score >= 100) {
        actionType = 'block';
        reason = 'Critical violation score reached - automatic blocking';
      } else if (moderationStatus.violation_score >= 75) {
        actionType = 'suspend';
        reason = 'High violation score - automatic suspension';
      } else if (moderationStatus.pending_reports >= 5) {
        actionType = 'flag';
        reason = 'Multiple pending reports - flagged for review';
      } else if (moderationStatus.report_count >= 10) {
        actionType = 'warn';
        reason = 'High report count - warning issued';
      }

      if (!actionType) {
        logger.info('No automatic action needed', { shopId });
        return null;
      }

      // Execute automatic action
      const result = await this.executeModerationAction(shopId, {
        action_type: actionType,
        reason,
        moderator_id: 'system',
        notify_owner: true,
        notify_customers: actionType === 'suspend' || actionType === 'block'
      });

      logger.info('Automatic moderation action completed', {
        shopId,
        actionType,
        reason
      });

      return result;
    } catch (error) {
      logger.error('Error processing automatic moderation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      throw error;
    }
  }

  /**
   * Check if shop should be hidden from search results
   */
  async shouldHideFromSearch(shopId: string): Promise<boolean> {
    try {
      const moderationStatus = await this.getShopModerationStatus(shopId);
      if (!moderationStatus) {
        return false;
      }

      return moderationStatus.auto_hidden || 
             moderationStatus.current_status === 'suspended' ||
             moderationStatus.current_status === 'inactive' ||
             moderationStatus.moderation_status === 'blocked';
    } catch (error) {
      logger.error('Error checking if shop should be hidden', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      return false;
    }
  }

  /**
   * Get shops that require moderation review
   */
  async getShopsRequiringReview(limit: number = 20, offset: number = 0): Promise<{
    shops: Array<ShopModerationStatus & { shop_name: string; owner_email: string }>;
    total: number;
  }> {
    try {
      logger.info('Getting shops requiring review', { limit, offset });

      // Get shops with pending reports or high violation scores
      const { data: shops, error: shopsError } = await this.supabase
        .from('shops')
        .select(`
          id, name, shop_status, owner_id,
          users!shops_owner_id_fkey(email)
        `)
        .in('shop_status', ['active', 'inactive'])
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (shopsError) {
        logger.error('Failed to fetch shops for review', { error: shopsError.message });
        throw new Error('Failed to fetch shops');
      }

      const shopsWithModerationStatus = [];
      for (const shop of shops || []) {
        const moderationStatus = await this.getShopModerationStatus(shop.id);
        if (moderationStatus && moderationStatus.requires_review) {
          shopsWithModerationStatus.push({
            ...moderationStatus,
            shop_name: shop.name,
            owner_email: (shop.users as any)?.email || ''
          });
        }
      }

      // Get total count
      const { count, error: countError } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .in('shop_status', ['active', 'inactive']);

      if (countError) {
        logger.error('Failed to get shops count', { error: countError.message });
      }

      logger.info('Shops requiring review retrieved', {
        count: shopsWithModerationStatus.length,
        total: count || 0
      });

      return {
        shops: shopsWithModerationStatus,
        total: count || 0
      };
    } catch (error) {
      logger.error('Error getting shops requiring review', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create audit trail for moderation decisions
   */
  async createModerationAuditTrail(
    shopId: string,
    action: string,
    moderatorId: string,
    reason: string,
    details?: any
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('moderation_audit_trail')
        .insert({
          shop_id: shopId,
          action,
          moderator_id: moderatorId,
          reason,
          details: details || {},
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Failed to create moderation audit trail', {
          shopId,
          action,
          error: error.message
        });
        // Don't throw - audit trail failure shouldn't break the main action
      } else {
        logger.info('Moderation audit trail created', { shopId, action });
      }
    } catch (error) {
      logger.error('Error creating moderation audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        action
      });
    }
  }

  // Private helper methods

  private shouldAutoHide(reportCount: number, violationScore: number, pendingReports: number): boolean {
    return reportCount >= 5 || violationScore >= 50 || pendingReports >= 3;
  }

  private async suspendShop(shopId: string, request: ModerationActionRequest): Promise<void> {
    // Implementation for suspending a shop
    logger.info('Suspending shop', { shopId, duration: request.duration_hours });
  }

  private async activateShop(shopId: string, request: ModerationActionRequest): Promise<void> {
    // Implementation for activating a shop
    logger.info('Activating shop', { shopId });
  }

  private async blockShop(shopId: string, request: ModerationActionRequest): Promise<void> {
    // Implementation for blocking a shop
    logger.info('Blocking shop', { shopId });
  }

  private async flagShop(shopId: string, request: ModerationActionRequest): Promise<void> {
    // Implementation for flagging a shop
    logger.info('Flagging shop', { shopId });
  }

  private async warnShop(shopId: string, request: ModerationActionRequest): Promise<void> {
    // Implementation for warning a shop
    logger.info('Warning shop', { shopId });
  }

  private async sendModerationNotifications(
    shopId: string, 
    request: ModerationActionRequest
  ): Promise<string[]> {
    const notificationsSent: string[] = [];

    try {
      // Get shop owner info
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select(`
          name, owner_id,
          users!shops_owner_id_fkey(email, username)
        `)
        .eq('id', shopId)
        .single();

      if (shopError || !shop) {
        logger.error('Failed to get shop for notifications', { shopId, error: shopError.message });
        return notificationsSent;
      }

      // Send notification to shop owner
      if (request.notify_owner && shop.users) {
        try {
          // Import notification service dynamically to avoid circular dependency
          const { notificationService } = await import('./notification.service');
          
          // Determine notification template based on action type
          let templateId = '';
          switch (request.action_type) {
            case 'suspend':
              templateId = 'shop_suspended';
              break;
            case 'block':
              templateId = 'shop_blocked';
              break;
            case 'flag':
              templateId = 'shop_flagged';
              break;
            case 'warn':
              templateId = 'shop_warning';
              break;
            case 'activate':
            case 'approve':
              templateId = 'shop_reactivated';
              break;
            default:
              logger.warn('Unknown moderation action type for notification', { actionType: request.action_type });
              break;
          }

          if (templateId) {
            await notificationService.sendTemplateNotification(
              shop.owner_id,
              templateId,
              {
                shopName: shop.name,
                reason: request.reason,
                shopId: shopId
              }
            );
            notificationsSent.push('shop_owner_notified');
            logger.info('Moderation notification sent to shop owner', { 
              shopId, 
              ownerEmail: (shop.users as any).email,
              templateId,
              actionType: request.action_type
            });
          }
        } catch (notificationError) {
          logger.error('Failed to send moderation notification to shop owner', {
            shopId,
            error: notificationError instanceof Error ? notificationError.message : 'Unknown error'
          });
        }
      }

      // Send notification to customers if needed
      if (request.notify_customers) {
        try {
          // Get customers with upcoming reservations for this shop
          const { data: reservations, error: reservationsError } = await this.supabase
            .from('reservations')
            .select(`
              id, user_id, reservation_date,
              users!reservations_user_id_fkey(email, username)
            `)
            .eq('shop_id', shopId)
            .eq('status', 'confirmed')
            .gte('reservation_date', new Date().toISOString())
            .limit(100); // Limit to avoid too many notifications

          if (reservationsError) {
            logger.error('Failed to get customers for notifications', { 
              shopId, 
              error: reservationsError.message 
            });
          } else if (reservations && reservations.length > 0) {
            // Import notification service dynamically
            const { notificationService } = await import('./notification.service');
            
            // Send notifications to customers about shop suspension/blocking
            const userIds = reservations.map(r => r.user_id);
            const customData = {
              shopName: shop.name,
              reason: request.reason,
              shopId: shopId,
              actionType: request.action_type
            };

            // Use a generic template for customer notifications
            await notificationService.sendNotificationToUsers(
              userIds,
              {
                title: `매장 운영 안내 - ${shop.name}`,
                body: `예약하신 매장의 운영 상태가 변경되었습니다. 자세한 내용을 확인해주세요.`,
                data: {
                  type: 'shop_status_change',
                  shopId: shopId,
                  action: 'view_reservation'
                },
                clickAction: '/reservations'
              }
            );

            notificationsSent.push('customers_notified');
            logger.info('Notifications sent to customers with upcoming reservations', { 
              shopId, 
              customerCount: userIds.length 
            });
          }
        } catch (customerNotificationError) {
          logger.error('Failed to send notifications to customers', {
            shopId,
            error: customerNotificationError instanceof Error ? customerNotificationError.message : 'Unknown error'
          });
        }
      }

    } catch (error) {
      logger.error('Error sending moderation notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
    }

    return notificationsSent;
  }

  private async invalidateShopCache(shopId: string): Promise<void> {
    try {
      // Invalidate search cache for the shop
      // This would integrate with the existing search cache invalidation service
      logger.info('Invalidating shop cache', { shopId });
    } catch (error) {
      logger.error('Error invalidating shop cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
    }
  }
}

export const shopModerationIntegrationService = new ShopModerationIntegrationService();
