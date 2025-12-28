/**
 * Shop Owner Notification Service
 * 
 * Handles sending notifications to shop owners for new reservation requests in v3.1 flow
 * Integrates with existing notification system and supports multiple notification channels
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface ShopOwnerNotificationPayload {
  shopId: string;
  reservationId: string;
  customerName?: string;
  reservationDate: string;
  reservationTime: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    quantity: number;
  }>;
  totalAmount: number;
  depositAmount?: number;
  remainingAmount?: number;
  specialRequests?: string;
  paymentMethod?: string;
  notificationPreferences?: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
  };
}

export interface ShopOwnerInfo {
  shopId: string;
  ownerUserId: string;
  shopName: string;
  ownerName: string;
  email?: string;
  phoneNumber?: string;
}

export class ShopOwnerNotificationService {
  private supabase = getSupabaseClient();

  /**
   * Send notification to shop owner about new reservation request
   */
  async notifyShopOwnerOfNewRequest(payload: ShopOwnerNotificationPayload): Promise<void> {
    try {
      logger.info('Sending shop owner notification for new reservation request', {
        shopId: payload.shopId,
        reservationId: payload.reservationId
      });

      // Get shop owner information
      const shopOwnerInfo = await this.getShopOwnerInfo(payload.shopId);
      if (!shopOwnerInfo) {
        throw new Error(`Shop owner not found for shop ${payload.shopId}`);
      }

      // Create notification record in database
      const notificationId = await this.createNotificationRecord(shopOwnerInfo.ownerUserId, payload);

      // Send push notification if enabled
      if (payload.notificationPreferences?.pushNotifications !== false) {
        await this.sendPushNotification(shopOwnerInfo.ownerUserId, payload, notificationId);
      }

      // Send email notification if enabled and email available
      if (payload.notificationPreferences?.emailNotifications !== false && shopOwnerInfo.email) {
        await this.sendEmailNotification(shopOwnerInfo, payload, notificationId);
      }

      // Send SMS notification if enabled and phone number available
      if (payload.notificationPreferences?.smsNotifications !== false && shopOwnerInfo.phoneNumber) {
        await this.sendSMSNotification(shopOwnerInfo, payload, notificationId);
      }

      logger.info('Shop owner notification sent successfully', {
        shopId: payload.shopId,
        reservationId: payload.reservationId,
        ownerUserId: shopOwnerInfo.ownerUserId,
        notificationId
      });

    } catch (error) {
      logger.error('Failed to send shop owner notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: payload.shopId,
        reservationId: payload.reservationId
      });
      throw error;
    }
  }

  /**
   * Get shop owner information including contact details
   */
  private async getShopOwnerInfo(shopId: string): Promise<ShopOwnerInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('shops')
        .select(`
          id,
          name,
          owner_id,
          users!shops_owner_id_fkey (
            id,
            name,
            email,
            phone_number
          )
        `)
        .eq('id', shopId)
        .single();

      if (error) {
        logger.error('Failed to fetch shop owner info', { error: error.message, shopId });
        return null;
      }

      if (!data || !data.users || Array.isArray(data.users)) {
        logger.warn('Shop owner not found', { shopId });
        return null;
      }

      // Type assertion to handle Supabase query result
      const shopData = data as any;
      const userData = shopData.users as any;

      return {
        shopId: shopData.id,
        ownerUserId: userData.id,
        shopName: shopData.name,
        ownerName: userData.name,
        email: userData.email,
        phoneNumber: userData.phone_number
      };

    } catch (error) {
      logger.error('Error fetching shop owner info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      return null;
    }
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(
    ownerUserId: string,
    payload: ShopOwnerNotificationPayload
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: ownerUserId,
          notification_type: 'reservation_requested',
          title: '새로운 예약 요청이 있습니다',
          message: this.generateNotificationMessage(payload),
          related_id: payload.reservationId,
          action_url: `/shop/reservations/${payload.reservationId}`,
          status: 'unread'
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create notification record: ${error.message}`);
      }

      return data.id;

    } catch (error) {
      logger.error('Failed to create notification record', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ownerUserId,
        reservationId: payload.reservationId
      });
      throw error;
    }
  }

  /**
   * Generate notification message for shop owner
   */
  private generateNotificationMessage(payload: ShopOwnerNotificationPayload): string {
    const serviceNames = payload.services.map(s => s.serviceName).join(', ');
    const timeStr = payload.reservationTime.substring(0, 5); // Format as HH:MM
    
    let message = `${payload.reservationDate} ${timeStr}에 ${serviceNames} 예약 요청이 있습니다.`;
    
    if (payload.depositAmount && payload.remainingAmount) {
      message += ` 예약금: ${payload.depositAmount.toLocaleString()}원, 잔금: ${payload.remainingAmount.toLocaleString()}원`;
    } else if (payload.totalAmount) {
      message += ` 총 금액: ${payload.totalAmount.toLocaleString()}원`;
    }

    if (payload.specialRequests) {
      message += ` 특별 요청: ${payload.specialRequests}`;
    }

    return message;
  }

  /**
   * Send push notification to shop owner
   */
  private async sendPushNotification(
    ownerUserId: string,
    payload: ShopOwnerNotificationPayload,
    notificationId: string
  ): Promise<void> {
    try {
      // Import notification service dynamically to avoid circular dependencies
      const { notificationService } = await import('./notification.service');
      
      await notificationService.sendNotificationToUser(ownerUserId, {
        title: '새로운 예약 요청',
        body: this.generateNotificationMessage(payload),
        data: {
          type: 'reservation_requested',
          shopId: payload.shopId,
          reservationId: payload.reservationId,
          notificationId
        }
      });

      logger.info('Push notification sent to shop owner', {
        ownerUserId,
        reservationId: payload.reservationId
      });

    } catch (error) {
      logger.error('Failed to send push notification to shop owner', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ownerUserId,
        reservationId: payload.reservationId
      });
      // Don't throw error - push notifications are not critical
    }
  }

  /**
   * Send email notification to shop owner
   */
  private async sendEmailNotification(
    shopOwnerInfo: ShopOwnerInfo,
    payload: ShopOwnerNotificationPayload,
    notificationId: string
  ): Promise<void> {
    try {
      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
      // For now, we'll just log the email notification
      logger.info('Email notification would be sent to shop owner', {
        shopOwnerEmail: shopOwnerInfo.email,
        shopId: payload.shopId,
        reservationId: payload.reservationId,
        notificationId
      });

      // Example email integration (commented out):
      /*
      const emailService = new EmailService();
      await emailService.sendEmail({
        to: shopOwnerInfo.email,
        subject: '새로운 예약 요청 - ' + shopOwnerInfo.shopName,
        template: 'reservation-request-notification',
        data: {
          shopName: shopOwnerInfo.shopName,
          customerName: payload.customerName,
          reservationDate: payload.reservationDate,
          reservationTime: payload.reservationTime,
          services: payload.services,
          totalAmount: payload.totalAmount,
          depositAmount: payload.depositAmount,
          remainingAmount: payload.remainingAmount,
          specialRequests: payload.specialRequests,
          actionUrl: `https://app.ebeautything.com/shop/reservations/${payload.reservationId}`
        }
      });
      */

    } catch (error) {
      logger.error('Failed to send email notification to shop owner', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopOwnerEmail: shopOwnerInfo.email,
        reservationId: payload.reservationId
      });
      // Don't throw error - email notifications are not critical
    }
  }

  /**
   * Send SMS notification to shop owner
   */
  private async sendSMSNotification(
    shopOwnerInfo: ShopOwnerInfo,
    payload: ShopOwnerNotificationPayload,
    notificationId: string
  ): Promise<void> {
    try {
      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
      // For now, we'll just log the SMS notification
      logger.info('SMS notification would be sent to shop owner', {
        shopOwnerPhone: shopOwnerInfo.phoneNumber,
        shopId: payload.shopId,
        reservationId: payload.reservationId,
        notificationId
      });

      // Example SMS integration (commented out):
      /*
      const smsService = new SMSService();
      await smsService.sendSMS({
        to: shopOwnerInfo.phoneNumber,
        message: `[${shopOwnerInfo.shopName}] 새로운 예약 요청: ${payload.reservationDate} ${payload.reservationTime}`
      });
      */

    } catch (error) {
      logger.error('Failed to send SMS notification to shop owner', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopOwnerPhone: shopOwnerInfo.phoneNumber,
        reservationId: payload.reservationId
      });
      // Don't throw error - SMS notifications are not critical
    }
  }

  /**
   * Get notification history for a shop owner
   */
  async getShopOwnerNotificationHistory(
    shopId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const shopOwnerInfo = await this.getShopOwnerInfo(shopId);
      if (!shopOwnerInfo) {
        return [];
      }

      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', shopOwnerInfo.ownerUserId)
        .eq('notification_type', 'reservation_requested')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to fetch shop owner notification history', {
          error: error.message,
          shopId,
          ownerUserId: shopOwnerInfo.ownerUserId
        });
        return [];
      }

      return data || [];

    } catch (error) {
      logger.error('Error fetching shop owner notification history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, ownerUserId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', ownerUserId);

      if (error) {
        logger.error('Failed to mark notification as read', {
          error: error.message,
          notificationId,
          ownerUserId
        });
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Error marking notification as read', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId,
        ownerUserId
      });
      return false;
    }
  }
}

export const shopOwnerNotificationService = new ShopOwnerNotificationService();
