import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { pushNotificationService } from './push-notification.service';
import {
  ShopNotification,
  CreateShopNotificationDto,
  ShopNotificationWithStats,
  ShopOwnerNotification,
} from '../types/shop-notification.types';

class ShopNotificationService {
  /**
   * Create a new shop notification
   */
  async createNotification(
    adminUserId: string,
    dto: CreateShopNotificationDto
  ): Promise<ShopNotification> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('shop_notifications')
      .insert({
        title: dto.title,
        content: dto.content,
        notification_type: dto.notificationType || 'announcement',
        priority: dto.priority || 'normal',
        target_categories: dto.targetCategories,
        send_push: dto.sendPush ?? true,
        send_in_app: dto.sendInApp ?? true,
        scheduled_at: dto.scheduledAt,
        created_by: adminUserId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create shop notification', { error, dto });
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    // If not scheduled, send immediately
    if (!dto.scheduledAt) {
      await this.sendNotification(data.id);
    }

    return this.mapNotification(data);
  }

  /**
   * Send notification to all target shops
   */
  async sendNotification(notificationId: string): Promise<{ sentCount: number }> {
    const supabase = getSupabaseClient();

    // Get notification
    const { data: notification, error: fetchError } = await supabase
      .from('shop_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      throw new Error('Notification not found');
    }

    if (notification.sent_at) {
      throw new Error('Notification already sent');
    }

    // Get target shops
    let shopsQuery = supabase
      .from('shops')
      .select('id, owner_id, name')
      .eq('is_active', true);

    // Filter by category if specified
    if (notification.target_categories && notification.target_categories.length > 0) {
      shopsQuery = shopsQuery.in('main_category', notification.target_categories);
    }

    const { data: shops, error: shopsError } = await shopsQuery;

    if (shopsError) {
      logger.error('Failed to fetch shops for notification', { error: shopsError });
      throw new Error(`Failed to fetch shops: ${shopsError.message}`);
    }

    if (!shops || shops.length === 0) {
      logger.warn('No target shops found for notification', { notificationId });
      throw new Error('No target shops found');
    }

    // Create receipts
    const receipts = shops.map(shop => ({
      notification_id: notificationId,
      shop_id: shop.id,
    }));

    const { error: receiptError } = await supabase
      .from('shop_notification_receipts')
      .insert(receipts);

    if (receiptError) {
      logger.error('Failed to create notification receipts', { error: receiptError });
    }

    // Update notification as sent
    await supabase
      .from('shop_notifications')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', notificationId);

    // Send push notifications if enabled
    if (notification.send_push) {
      try {
        const shopOwnerIds = shops.map(s => s.owner_id).filter(Boolean) as string[];

        if (shopOwnerIds.length > 0) {
          // Send bulk push notification to all shop owners
          await pushNotificationService.sendBulkPushNotification(
            shopOwnerIds,
            notification.title,
            notification.content.substring(0, 100),
            {
              type: 'shop_notification',
              notificationId,
            }
          );
        }
      } catch (pushError) {
        logger.error('Failed to send push notifications', { error: pushError });
        // Don't throw - notification is still delivered in-app
      }
    }

    logger.info('Shop notification sent', {
      notificationId,
      recipientCount: shops.length
    });

    return { sentCount: shops.length };
  }

  /**
   * Get all notifications with stats (for admin)
   */
  async getNotifications(options: {
    page?: number;
    limit?: number;
    type?: string;
  } = {}): Promise<{ notifications: ShopNotificationWithStats[]; total: number }> {
    const supabase = getSupabaseClient();
    const { page = 1, limit = 20, type } = options;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('shop_notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('notification_type', type);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch shop notifications', { error });
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    // Get receipt counts for each notification
    const notificationIds = (data || []).map(n => n.id);

    const { data: receipts } = await supabase
      .from('shop_notification_receipts')
      .select('notification_id, read_at')
      .in('notification_id', notificationIds);

    const statsMap = new Map<string, { delivered: number; read: number }>();
    (receipts || []).forEach(r => {
      const existing = statsMap.get(r.notification_id) || { delivered: 0, read: 0 };
      existing.delivered++;
      if (r.read_at) existing.read++;
      statsMap.set(r.notification_id, existing);
    });

    const notifications = (data || []).map(n => {
      const stats = statsMap.get(n.id) || { delivered: 0, read: 0 };
      return {
        ...this.mapNotification(n),
        totalRecipients: stats.delivered,
        deliveredCount: stats.delivered,
        readCount: stats.read,
      };
    });

    return {
      notifications,
      total: count || 0,
    };
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(notificationId: string): Promise<ShopNotificationWithStats | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('shop_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (error || !data) {
      return null;
    }

    // Get receipt counts
    const { data: receipts } = await supabase
      .from('shop_notification_receipts')
      .select('read_at')
      .eq('notification_id', notificationId);

    const deliveredCount = receipts?.length || 0;
    const readCount = receipts?.filter(r => r.read_at).length || 0;

    return {
      ...this.mapNotification(data),
      totalRecipients: deliveredCount,
      deliveredCount,
      readCount,
    };
  }

  /**
   * Get notifications for a shop (shop owner view)
   */
  async getShopNotifications(
    shopId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ): Promise<{ notifications: ShopOwnerNotification[]; unreadCount: number }> {
    const supabase = getSupabaseClient();
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('shop_notification_receipts')
      .select(`
        id,
        delivered_at,
        read_at,
        shop_notifications (
          id,
          title,
          content,
          notification_type,
          priority,
          sent_at
        )
      `)
      .eq('shop_id', shopId)
      .order('delivered_at', { ascending: false });

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch shop notifications', { error, shopId });
      throw new Error(`Failed to fetch shop notifications: ${error.message}`);
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('shop_notification_receipts')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .is('read_at', null);

    const notifications: ShopOwnerNotification[] = (data || []).map(r => ({
      id: r.id,
      notificationId: (r.shop_notifications as any)?.id || '',
      title: (r.shop_notifications as any)?.title || '',
      content: (r.shop_notifications as any)?.content || '',
      type: (r.shop_notifications as any)?.notification_type || 'announcement',
      priority: (r.shop_notifications as any)?.priority || 'normal',
      deliveredAt: new Date(r.delivered_at),
      readAt: r.read_at ? new Date(r.read_at) : undefined,
      isRead: !!r.read_at,
    }));

    return {
      notifications,
      unreadCount: unreadCount || 0,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(shopId: string, receiptId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('shop_notification_receipts')
      .update({ read_at: new Date().toISOString() })
      .eq('id', receiptId)
      .eq('shop_id', shopId);

    if (error) {
      logger.error('Failed to mark notification as read', { error, receiptId, shopId });
      throw new Error(`Failed to mark as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read for a shop
   */
  async markAllAsRead(shopId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('shop_notification_receipts')
      .update({ read_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .is('read_at', null);

    if (error) {
      logger.error('Failed to mark all notifications as read', { error, shopId });
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }
  }

  /**
   * Delete a notification (admin only)
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('shop_notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      logger.error('Failed to delete notification', { error, notificationId });
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  }

  private mapNotification(data: any): ShopNotification {
    return {
      id: data.id,
      title: data.title,
      content: data.content,
      notificationType: data.notification_type,
      priority: data.priority,
      targetCategories: data.target_categories,
      sendPush: data.send_push,
      sendInApp: data.send_in_app,
      scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : undefined,
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const shopNotificationService = new ShopNotificationService();
