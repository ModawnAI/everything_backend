/**
 * Customer Notification Service
 * 
 * Handles sending notifications to customers for reservation confirmations and rejections in v3.1 flow
 * Integrates with existing notification system and supports multiple notification channels
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface CustomerNotificationPayload {
  customerId: string;
  reservationId: string;
  shopName: string;
  reservationDate: string;
  reservationTime: string;
  services: Array<{
    serviceName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  depositAmount?: number;
  remainingAmount?: number;
  specialRequests?: string;
  notificationType: 'reservation_confirmed' | 'reservation_rejected';
  additionalData?: {
    confirmationNotes?: string;
    rejectionReason?: string;
    refundProcessed?: boolean;
    refundAmount?: number;
  };
}

export interface CustomerInfo {
  userId: string;
  name: string;
  email?: string;
  phoneNumber?: string;
}

export class CustomerNotificationService {
  private supabase = getSupabaseClient();

  /**
   * Send notification to customer about reservation status change
   */
  async notifyCustomerOfReservationUpdate(payload: CustomerNotificationPayload): Promise<void> {
    try {
      logger.info('Sending customer notification for reservation status update', {
        customerId: payload.customerId,
        reservationId: payload.reservationId,
        notificationType: payload.notificationType
      });

      // Get customer information
      const customerInfo = await this.getCustomerInfo(payload.customerId);
      if (!customerInfo) {
        throw new Error(`Customer not found for user ${payload.customerId}`);
      }

      // Create notification record in database
      const notificationId = await this.createNotificationRecord(payload);

      // Send push notification
      await this.sendPushNotification(payload, notificationId);

      // Send email notification if email available
      if (customerInfo.email) {
        await this.sendEmailNotification(customerInfo, payload, notificationId);
      }

      // Send SMS notification if phone number available
      if (customerInfo.phoneNumber) {
        await this.sendSMSNotification(customerInfo, payload, notificationId);
      }

      logger.info('Customer notification sent successfully', {
        customerId: payload.customerId,
        reservationId: payload.reservationId,
        notificationType: payload.notificationType,
        notificationId
      });

    } catch (error) {
      logger.error('Failed to send customer notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId: payload.customerId,
        reservationId: payload.reservationId,
        notificationType: payload.notificationType
      });
      throw error;
    }
  }

  /**
   * Get customer information including contact details
   */
  private async getCustomerInfo(userId: string): Promise<CustomerInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, name, email, phone_number')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Failed to fetch customer info', { error: error.message, userId });
        return null;
      }

      if (!data) {
        logger.warn('Customer not found', { userId });
        return null;
      }

      return {
        userId: data.id,
        name: data.name,
        email: data.email,
        phoneNumber: data.phone_number
      };

    } catch (error) {
      logger.error('Error fetching customer info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return null;
    }
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(payload: CustomerNotificationPayload): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: payload.customerId,
          notification_type: payload.notificationType,
          title: this.generateNotificationTitle(payload),
          message: this.generateNotificationMessage(payload),
          related_id: payload.reservationId,
          action_url: `/reservations/${payload.reservationId}`,
          status: 'unread',
          data: {
            reservationId: payload.reservationId,
            shopName: payload.shopName,
            reservationDate: payload.reservationDate,
            reservationTime: payload.reservationTime,
            totalAmount: payload.totalAmount,
            depositAmount: payload.depositAmount,
            remainingAmount: payload.remainingAmount,
            services: payload.services,
            specialRequests: payload.specialRequests,
            notificationType: payload.notificationType,
            ...payload.additionalData
          }
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
        customerId: payload.customerId,
        reservationId: payload.reservationId
      });
      throw error;
    }
  }

  /**
   * Generate notification title for customer
   */
  private generateNotificationTitle(payload: CustomerNotificationPayload): string {
    switch (payload.notificationType) {
      case 'reservation_confirmed':
        return `🎉 [${payload.shopName}] 예약 확정`;
      case 'reservation_rejected':
        return `😔 [${payload.shopName}] 예약 거절`;
      default:
        return `[${payload.shopName}] 예약 상태 변경`;
    }
  }

  /**
   * Generate notification message for customer
   */
  private generateNotificationMessage(payload: CustomerNotificationPayload): string {
    const timeStr = payload.reservationTime.substring(0, 5); // Format as HH:MM
    const serviceNames = payload.services.map(s => s.serviceName).join(', ');
    
    let message = '';
    
    switch (payload.notificationType) {
      case 'reservation_confirmed':
        message = `🎉 예약이 확정되었습니다!

샵: ${payload.shopName}
예약일시: ${payload.reservationDate} ${timeStr}
서비스: ${serviceNames}
총 금액: ${payload.totalAmount.toLocaleString()}원`;

        if (payload.depositAmount && payload.remainingAmount) {
          message += `
예약금: ${payload.depositAmount.toLocaleString()}원
잔금: ${payload.remainingAmount.toLocaleString()}원`;
        }

        if (payload.additionalData?.confirmationNotes) {
          message += `

샵 메시지: ${payload.additionalData.confirmationNotes}`;
        }

        message += `

예약 시간에 맞춰 방문해주세요.
문의사항이 있으시면 샵에 직접 연락해주세요.

감사합니다.`;
        break;

      case 'reservation_rejected':
        message = `😔 예약이 거절되었습니다.

샵: ${payload.shopName}
예약일시: ${payload.reservationDate} ${timeStr}
서비스: ${serviceNames}
거절 사유: ${payload.additionalData?.rejectionReason || '샵 사정으로 인한 예약 거절'}`;

        if (payload.additionalData?.refundProcessed && payload.additionalData?.refundAmount) {
          message += `

예약금 ${payload.additionalData.refundAmount.toLocaleString()}원이 환불 처리되었습니다.`;
        } else if (payload.depositAmount && payload.depositAmount > 0) {
          message += `

예약금 환불은 별도로 처리됩니다.`;
        }

        message += `

다른 시간이나 샵으로 예약을 다시 시도해보시기 바랍니다.
문의사항이 있으시면 고객센터로 연락해주세요.

감사합니다.`;
        break;

      default:
        message = `예약 상태가 변경되었습니다.

샵: ${payload.shopName}
예약일시: ${payload.reservationDate} ${timeStr}
서비스: ${serviceNames}`;
    }

    if (payload.specialRequests) {
      message += `
특별 요청: ${payload.specialRequests}`;
    }

    return message;
  }

  /**
   * Send push notification to customer
   */
  private async sendPushNotification(
    payload: CustomerNotificationPayload,
    notificationId: string
  ): Promise<void> {
    try {
      // Import notification service dynamically to avoid circular dependencies
      const { notificationService } = await import('./notification.service');
      
      await notificationService.sendNotificationToUser(payload.customerId, {
        title: this.generateNotificationTitle(payload),
        body: this.generateNotificationMessage(payload),
        data: {
          type: payload.notificationType,
          reservationId: payload.reservationId,
          shopName: payload.shopName,
          notificationId
        }
      });

      logger.info('Push notification sent to customer', {
        customerId: payload.customerId,
        reservationId: payload.reservationId,
        notificationType: payload.notificationType
      });

    } catch (error) {
      logger.error('Failed to send push notification to customer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId: payload.customerId,
        reservationId: payload.reservationId
      });
      // Don't throw error - push notifications are not critical
    }
  }

  /**
   * Send email notification to customer
   */
  private async sendEmailNotification(
    customerInfo: CustomerInfo,
    payload: CustomerNotificationPayload,
    notificationId: string
  ): Promise<void> {
    try {
      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
      // For now, we'll just log the email notification
      logger.info('Email notification would be sent to customer', {
        customerEmail: customerInfo.email,
        customerId: payload.customerId,
        reservationId: payload.reservationId,
        notificationType: payload.notificationType,
        notificationId
      });

      // Example email integration (commented out):
      /*
      const emailService = new EmailService();
      await emailService.sendEmail({
        to: customerInfo.email,
        subject: this.generateNotificationTitle(payload),
        template: payload.notificationType === 'reservation_confirmed' ? 'reservation-confirmation' : 'reservation-rejection',
        data: {
          customerName: customerInfo.name,
          shopName: payload.shopName,
          reservationDate: payload.reservationDate,
          reservationTime: payload.reservationTime,
          services: payload.services,
          totalAmount: payload.totalAmount,
          depositAmount: payload.depositAmount,
          remainingAmount: payload.remainingAmount,
          specialRequests: payload.specialRequests,
          confirmationNotes: payload.additionalData?.confirmationNotes,
          rejectionReason: payload.additionalData?.rejectionReason,
          refundProcessed: payload.additionalData?.refundProcessed,
          refundAmount: payload.additionalData?.refundAmount,
          actionUrl: `https://app.ebeautything.com/reservations/${payload.reservationId}`
        }
      });
      */

    } catch (error) {
      logger.error('Failed to send email notification to customer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerEmail: customerInfo.email,
        customerId: payload.customerId,
        reservationId: payload.reservationId
      });
      // Don't throw error - email notifications are not critical
    }
  }

  /**
   * Send SMS notification to customer
   */
  private async sendSMSNotification(
    customerInfo: CustomerInfo,
    payload: CustomerNotificationPayload,
    notificationId: string
  ): Promise<void> {
    try {
      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
      // For now, we'll just log the SMS notification
      logger.info('SMS notification would be sent to customer', {
        customerPhone: customerInfo.phoneNumber,
        customerId: payload.customerId,
        reservationId: payload.reservationId,
        notificationType: payload.notificationType,
        notificationId
      });

      // Example SMS integration (commented out):
      /*
      const smsService = new SMSService();
      const timeStr = payload.reservationTime.substring(0, 5);
      
      let smsMessage = '';
      if (payload.notificationType === 'reservation_confirmed') {
        smsMessage = `[${payload.shopName}] 예약 확정: ${payload.reservationDate} ${timeStr}`;
      } else {
        smsMessage = `[${payload.shopName}] 예약 거절: ${payload.reservationDate} ${timeStr}`;
      }
      
      await smsService.sendSMS({
        to: customerInfo.phoneNumber,
        message: smsMessage
      });
      */

    } catch (error) {
      logger.error('Failed to send SMS notification to customer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerPhone: customerInfo.phoneNumber,
        customerId: payload.customerId,
        reservationId: payload.reservationId
      });
      // Don't throw error - SMS notifications are not critical
    }
  }

  /**
   * Get notification history for a customer
   */
  async getCustomerNotificationHistory(
    customerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', customerId)
        .in('notification_type', ['reservation_confirmed', 'reservation_rejected'])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to fetch customer notification history', {
          error: error.message,
          customerId
        });
        return [];
      }

      return data || [];

    } catch (error) {
      logger.error('Error fetching customer notification history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId
      });
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, customerId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', customerId);

      if (error) {
        logger.error('Failed to mark notification as read', {
          error: error.message,
          notificationId,
          customerId
        });
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Error marking notification as read', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId,
        customerId
      });
      return false;
    }
  }
}

export const customerNotificationService = new CustomerNotificationService();
