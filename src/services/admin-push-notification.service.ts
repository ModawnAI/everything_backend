import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';

export interface PushNotificationData {
  title: string;
  body: string;
  targetUserType?: string[]; // ['user', 'shop_owner', 'influencer']
  targetUserIds?: string[]; // Specific user IDs
  data?: Record<string, string>;
  imageUrl?: string;
  schedule?: string; // ISO datetime for scheduled push
}

export class AdminPushNotificationService {
  private supabase = getSupabaseClient();
  private notificationService = new NotificationService();

  /**
   * Send push notification to users
   */
  async sendPushNotification(notificationData: PushNotificationData, adminId: string): Promise<any> {
    try {
      let targetUserIds: string[] = [];

      // Determine target users
      if (notificationData.targetUserIds && notificationData.targetUserIds.length > 0) {
        targetUserIds = notificationData.targetUserIds;
      } else if (notificationData.targetUserType && notificationData.targetUserType.length > 0) {
        // Get users by role
        const { data: users, error } = await this.supabase
          .from('users')
          .select('id')
          .in('user_role', notificationData.targetUserType)
          .eq('user_status', 'active');

        if (error) {
          throw error;
        }

        targetUserIds = users?.map(u => u.id) || [];
      } else {
        // Send to all active users
        const { data: users, error } = await this.supabase
          .from('users')
          .select('id')
          .eq('user_status', 'active');

        if (error) {
          throw error;
        }

        targetUserIds = users?.map(u => u.id) || [];
      }

      if (targetUserIds.length === 0) {
        return {
          success: false,
          message: 'No target users found',
          sentCount: 0,
          failedCount: 0
        };
      }

      // Store notification record - using correct column names and enum values
      const { data: notificationRecord, error: recordError } = await this.supabase
        .from('notifications')
        .insert({
          notification_type: 'system', // Using 'system' type for admin announcements
          title: notificationData.title,
          message: notificationData.body,
          user_id: adminId, // Admin who sent it
          status: 'unread' // Status must be 'unread', 'read', or 'deleted'
        })
        .select()
        .single();

      if (recordError) {
        logger.error('Failed to insert notification record', { error: recordError });
        throw recordError;
      }

      // Send push notifications
      let sentCount = 0;
      let failedCount = 0;

      for (const userId of targetUserIds) {
        try {
          await this.notificationService.sendNotificationToUser(
            userId,
            {
              title: notificationData.title,
              body: notificationData.body,
              data: notificationData.data || {},
              imageUrl: notificationData.imageUrl,
              clickAction: '/announcements'
            }
          );
          sentCount++;
        } catch (error) {
          logger.error('Failed to send push to user', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId
          });
          failedCount++;
        }
      }

      logger.info('Push notifications sent', {
        adminId,
        notificationId: notificationRecord.id,
        targetCount: targetUserIds.length,
        sentCount,
        failedCount
      });

      return {
        notification: notificationRecord,
        targetCount: targetUserIds.length,
        sentCount,
        failedCount,
        success: sentCount > 0
      };
    } catch (error) {
      logger.error('Send push notification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Get push notification history
   */
  async getPushHistory(
    page: number,
    limit: number,
    status: string | undefined,
    adminId: string
  ): Promise<any> {
    try {
      const offset = (page - 1) * limit;
      let query = this.supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('notification_type', 'system') // Query for 'system' type (admin announcements)
        .order('created_at', { ascending: false });

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      logger.info('Push history retrieved', { adminId, page, limit });

      return {
        notifications: data || [],
        totalCount: count || 0,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      logger.error('Get push history failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Get push notification by ID
   */
  async getPushNotificationById(notificationId: string, adminId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (error) {
        throw error;
      }

      logger.info('Push notification retrieved', { adminId, notificationId });

      return { notification: data };
    } catch (error) {
      logger.error('Get push notification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        notificationId
      });
      throw error;
    }
  }
}

export const adminPushNotificationService = new AdminPushNotificationService();
