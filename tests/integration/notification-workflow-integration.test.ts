/**
 * Comprehensive Notification Workflow Integration Tests
 * 
 * Integration tests covering notification processing workflows:
 * - Email, SMS, and push notification delivery
 * - Notification template rendering and personalization
 * - Notification delivery status tracking
 * - Bulk notification processing
 * - Notification failure handling and retry logic
 * - Integration with external notification services
 */

import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Import services for notification integration testing
import { NotificationService } from '../../src/services/notification.service';
import { ShopOwnerNotificationService } from '../../src/services/shop-owner-notification.service';
import { UserNotificationService } from '../../src/services/user-notification.service';

// Mock external dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/email.service');
jest.mock('../../src/services/sms.service');
jest.mock('../../src/services/push-notification.service');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { emailService } from '../../src/services/email.service';
import { smsService } from '../../src/services/sms.service';
import { pushNotificationService } from '../../src/services/push-notification.service';
import { logger } from '../../src/utils/logger';

describe('Notification Workflow Integration Tests', () => {
  let notificationService: NotificationService;
  let shopOwnerNotificationService: ShopOwnerNotificationService;
  let userNotificationService: UserNotificationService;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockEmailService: jest.Mocked<typeof emailService>;
  let mockSmsService: jest.Mocked<typeof smsService>;
  let mockPushNotificationService: jest.Mocked<typeof pushNotificationService>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize services
    notificationService = new NotificationService();
    shopOwnerNotificationService = new ShopOwnerNotificationService();
    userNotificationService = new UserNotificationService();
    testUtils = new ReservationTestUtils();

    // Setup mocks
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockEmailService = emailService as jest.Mocked<typeof emailService>;
    mockSmsService = smsService as jest.Mocked<typeof smsService>;
    mockPushNotificationService = pushNotificationService as jest.Mocked<typeof pushNotificationService>;
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('Multi-Channel Notification Delivery', () => {
    it('should send email, SMS, and push notifications for new reservation', async () => {
      const notificationData = {
        type: 'new_reservation_request',
        recipientId: 'user-123',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-123',
          shopName: 'Test Shop',
          serviceName: 'Hair Cut',
          reservationDate: '2024-03-15',
          reservationTime: '10:00',
          totalAmount: 50000
        },
        channels: ['email', 'sms', 'push']
      };

      // Mock successful delivery for all channels
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-123',
        deliveredAt: new Date().toISOString()
      });

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: 'sms-123',
        deliveredAt: new Date().toISOString()
      });

      mockPushNotificationService.sendPushNotification.mockResolvedValue({
        success: true,
        messageId: 'push-123',
        deliveredAt: new Date().toISOString()
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'notification-123', ...notificationData }],
              error: null
            })
          })
        })
      });

      const result = await notificationService.sendNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notification-123');
      expect(result.deliveryResults).toHaveLength(3);
      expect(result.deliveryResults.every(r => r.success)).toBe(true);

      // Verify all channels were called
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.any(String),
          subject: expect.stringContaining('New Reservation'),
          template: 'new_reservation_request'
        })
      );

      expect(mockSmsService.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.any(String),
          message: expect.stringContaining('reservation confirmed')
        })
      );

      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          title: expect.stringContaining('Reservation'),
          body: expect.any(String)
        })
      );
    });

    it('should handle partial notification delivery failures', async () => {
      const notificationData = {
        type: 'reservation_reminder',
        recipientId: 'user-456',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-456',
          shopName: 'Test Shop',
          reservationDate: '2024-03-15',
          reservationTime: '10:00'
        },
        channels: ['email', 'sms', 'push']
      };

      // Mock email success, SMS failure, push success
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-456',
        deliveredAt: new Date().toISOString()
      });

      mockSmsService.sendSms.mockResolvedValue({
        success: false,
        error: 'Invalid phone number format'
      });

      mockPushNotificationService.sendPushNotification.mockResolvedValue({
        success: true,
        messageId: 'push-456',
        deliveredAt: new Date().toISOString()
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'notification-456', ...notificationData }],
              error: null
            })
          })
        })
      });

      const result = await notificationService.sendNotification(notificationData);

      expect(result.success).toBe(true); // Overall success despite partial failures
      expect(result.deliveryResults).toHaveLength(3);
      expect(result.deliveryResults.filter(r => r.success)).toHaveLength(2);
      expect(result.deliveryResults.filter(r => !r.success)).toHaveLength(1);
    });

    it('should respect user notification preferences', async () => {
      const notificationData = {
        type: 'reservation_confirmed',
        recipientId: 'user-789',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-789',
          shopName: 'Test Shop'
        },
        channels: ['email', 'sms', 'push']
      };

      // Mock user preferences (email only)
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'user-789',
                email_notifications: true,
                sms_notifications: false,
                push_notifications: false
              },
              error: null
            })
          })
        })
      });

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-789',
        deliveredAt: new Date().toISOString()
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'notification-789', ...notificationData }],
              error: null
            })
          })
        })
      });

      const result = await notificationService.sendNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.deliveryResults).toHaveLength(1); // Only email
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockSmsService.sendSms).not.toHaveBeenCalled();
      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });
  });

  describe('Template Rendering and Personalization', () => {
    it('should render personalized email templates', async () => {
      const emailData = {
        type: 'reservation_confirmed',
        recipientId: 'user-123',
        data: {
          customerName: 'John Doe',
          shopName: 'Hair Studio',
          serviceName: 'Premium Hair Cut',
          reservationDate: '2024-03-15',
          reservationTime: '10:00',
          totalAmount: 50000,
          shopAddress: '123 Main St, Seoul',
          shopPhone: '02-1234-5678'
        }
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                name: 'John Doe',
                email: 'john@example.com'
              },
              error: null
            })
          })
        })
      });

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-template-123',
        deliveredAt: new Date().toISOString()
      });

      await userNotificationService.sendReservationConfirmation(emailData);

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          subject: expect.stringContaining('John Doe'),
          template: 'reservation_confirmed',
          data: expect.objectContaining({
            customerName: 'John Doe',
            shopName: 'Hair Studio',
            serviceName: 'Premium Hair Cut'
          })
        })
      );
    });

    it('should handle template rendering errors gracefully', async () => {
      const emailData = {
        type: 'invalid_template',
        recipientId: 'user-456',
        data: {
          invalidField: 'test'
        }
      };

      mockEmailService.sendEmail.mockResolvedValue({
        success: false,
        error: 'Template not found: invalid_template'
      });

      const result = await notificationService.sendNotification(emailData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Template not found: invalid_template');
    });

    it('should support multilingual notification templates', async () => {
      const notificationData = {
        type: 'reservation_reminder',
        recipientId: 'user-789',
        recipientType: 'user',
        language: 'ko',
        data: {
          reservationId: 'reservation-789',
          shopName: '헤어 스튜디오',
          serviceName: '커트 서비스'
        }
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'user-789',
                name: '김철수',
                email: 'kim@example.com',
                preferred_language: 'ko'
              },
              error: null
            })
          })
        })
      });

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-korean-123',
        deliveredAt: new Date().toISOString()
      });

      await userNotificationService.sendReservationReminder(notificationData);

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'reservation_reminder_ko',
          data: expect.objectContaining({
            shopName: '헤어 스튜디오',
            serviceName: '커트 서비스'
          })
        })
      );
    });
  });

  describe('Bulk Notification Processing', () => {
    it('should process bulk notifications efficiently', async () => {
      const bulkNotifications = Array(100).fill(0).map((_, index) => ({
        type: 'promotional_offer',
        recipientId: `user-${index}`,
        recipientType: 'user',
        data: {
          offerCode: 'SAVE20',
          discountAmount: 10000,
          expiryDate: '2024-03-31'
        },
        channels: ['email']
      }));

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: `bulk-email-${Math.random()}`,
        deliveredAt: new Date().toISOString()
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: `bulk-notification-${Math.random()}`, ...bulkNotifications[0] }],
              error: null
            })
          })
        })
      });

      const startTime = performance.now();
      
      const results = await Promise.allSettled(
        bulkNotifications.map(notification => notificationService.sendNotification(notification))
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful).toHaveLength(100);
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(100);
    });

    it('should handle bulk notification failures gracefully', async () => {
      const bulkNotifications = Array(50).fill(0).map((_, index) => ({
        type: 'newsletter',
        recipientId: `user-${index}`,
        recipientType: 'user',
        data: {
          newsletterId: 'newsletter-123',
          title: 'Monthly Newsletter'
        },
        channels: ['email']
      }));

      // Mock some successes and some failures
      mockEmailService.sendEmail.mockImplementation(() => {
        const random = Math.random();
        if (random > 0.3) {
          return Promise.resolve({
            success: true,
            messageId: `success-${Math.random()}`,
            deliveredAt: new Date().toISOString()
          });
        } else {
          return Promise.resolve({
            success: false,
            error: 'Invalid email address'
          });
        }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: `bulk-notification-${Math.random()}` }],
              error: null
            })
          })
        })
      });

      const results = await Promise.allSettled(
        bulkNotifications.map(notification => notificationService.sendNotification(notification))
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length + failed.length).toBe(50);
      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
    });

    it('should implement rate limiting for bulk notifications', async () => {
      const bulkNotifications = Array(1000).fill(0).map((_, index) => ({
        type: 'system_announcement',
        recipientId: `user-${index}`,
        recipientType: 'user',
        data: {
          announcement: 'System maintenance scheduled'
        },
        channels: ['email']
      }));

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: `rate-limited-${Math.random()}`,
        deliveredAt: new Date().toISOString()
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: `rate-limited-notification-${Math.random()}` }],
              error: null
            })
          })
        })
      });

      const startTime = performance.now();
      
      const results = await notificationService.sendBulkNotifications(bulkNotifications);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(results.totalSent).toBe(1000);
      expect(results.successful).toBeGreaterThan(900);
      expect(results.failed).toBeLessThan(100);
      expect(executionTime).toBeLessThan(60000); // Should complete within 1 minute with rate limiting
    });
  });

  describe('Notification Delivery Status Tracking', () => {
    it('should track notification delivery status', async () => {
      const notificationData = {
        type: 'reservation_confirmed',
        recipientId: 'user-123',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-123'
        },
        channels: ['email', 'sms']
      };

      // Mock delivery status updates
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-status-123',
        deliveredAt: new Date().toISOString(),
        status: 'delivered'
      });

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: 'sms-status-123',
        deliveredAt: new Date().toISOString(),
        status: 'delivered'
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'notification-status-123', ...notificationData }],
              error: null
            })
          })
        })
      });

      const result = await notificationService.sendNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.deliveryResults).toHaveLength(2);
      expect(result.deliveryResults.every(r => r.status === 'delivered')).toBe(true);

      // Verify status tracking in database
      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    });

    it('should handle delivery status webhooks', async () => {
      const webhookData = {
        messageId: 'email-webhook-123',
        status: 'delivered',
        deliveredAt: '2024-03-15T10:30:00Z',
        channel: 'email'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: {
          notificationId: 'notification-webhook-123',
          updated: true,
          newStatus: 'delivered'
        },
        error: null
      });

      const result = await notificationService.handleDeliveryWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notification-webhook-123');
      expect(result.newStatus).toBe('delivered');
    });

    it('should retry failed notifications', async () => {
      const failedNotification = {
        id: 'notification-retry-123',
        type: 'reservation_reminder',
        recipientId: 'user-456',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-456'
        },
        channels: ['email'],
        retryCount: 0,
        maxRetries: 3
      };

      // First attempt fails
      mockEmailService.sendEmail.mockResolvedValueOnce({
        success: false,
        error: 'Temporary service unavailable'
      });

      // Second attempt succeeds
      mockEmailService.sendEmail.mockResolvedValueOnce({
        success: true,
        messageId: 'email-retry-success',
        deliveredAt: new Date().toISOString()
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: failedNotification,
              error: null
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          id: 'notification-retry-123',
          retryCount: 1,
          status: 'completed'
        },
        error: null
      });

      const result = await notificationService.retryFailedNotification('notification-retry-123');

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(result.status).toBe('completed');
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('Shop Owner Notification Integration', () => {
    it('should send notifications to shop owners for new reservations', async () => {
      const shopOwnerNotification = {
        shopId: 'shop-123',
        reservationId: 'reservation-123',
        type: 'new_reservation_request',
        data: {
          customerName: 'John Doe',
          serviceName: 'Hair Cut',
          reservationDate: '2024-03-15',
          reservationTime: '10:00',
          totalAmount: 50000
        }
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'shop-123',
                owner_id: 'owner-123',
                name: 'Test Shop',
                owner_email: 'owner@testshop.com',
                owner_phone: '010-1234-5678'
              },
              error: null
            })
          })
        })
      });

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'owner-email-123',
        deliveredAt: new Date().toISOString()
      });

      const result = await shopOwnerNotificationService.sendNotification(shopOwnerNotification);

      expect(result.success).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@testshop.com',
          subject: expect.stringContaining('New Reservation Request'),
          template: 'shop_owner_new_reservation'
        })
      );
    });

    it('should send notifications for reservation cancellations', async () => {
      const cancellationNotification = {
        shopId: 'shop-456',
        reservationId: 'reservation-456',
        type: 'reservation_cancelled',
        data: {
          customerName: 'Jane Doe',
          serviceName: 'Hair Color',
          cancellationReason: 'Customer requested',
          refundAmount: 50000
        }
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'shop-456',
                owner_id: 'owner-456',
                name: 'Hair Studio',
                owner_email: 'owner@hairstudio.com'
              },
              error: null
            })
          })
        })
      });

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'cancellation-email-456',
        deliveredAt: new Date().toISOString()
      });

      const result = await shopOwnerNotificationService.sendNotification(cancellationNotification);

      expect(result.success).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Reservation Cancelled'),
          template: 'shop_owner_reservation_cancelled'
        })
      );
    });

    it('should handle shop owner notification preferences', async () => {
      const notification = {
        shopId: 'shop-789',
        reservationId: 'reservation-789',
        type: 'reservation_no_show',
        data: {
          customerName: 'Bob Smith',
          serviceName: 'Hair Cut'
        }
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'shop-789',
                owner_id: 'owner-789',
                name: 'Barber Shop',
                owner_email: 'owner@barbershop.com',
                owner_sms_notifications: true,
                owner_email_notifications: false
              },
              error: null
            })
          })
        })
      });

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: 'owner-sms-789',
        deliveredAt: new Date().toISOString()
      });

      const result = await shopOwnerNotificationService.sendNotification(notification);

      expect(result.success).toBe(true);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
      expect(mockSmsService.sendSms).toHaveBeenCalled();
    });
  });

  describe('Notification Failure Handling', () => {
    it('should handle email service failures', async () => {
      const notificationData = {
        type: 'reservation_confirmed',
        recipientId: 'user-123',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-123'
        },
        channels: ['email']
      };

      mockEmailService.sendEmail.mockRejectedValue(
        new Error('Email service temporarily unavailable')
      );

      const result = await notificationService.sendNotification(notificationData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Email service temporarily unavailable');
    });

    it('should handle SMS service failures', async () => {
      const notificationData = {
        type: 'reservation_reminder',
        recipientId: 'user-456',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-456'
        },
        channels: ['sms']
      };

      mockSmsService.sendSms.mockResolvedValue({
        success: false,
        error: 'Invalid phone number format'
      });

      const result = await notificationService.sendNotification(notificationData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid phone number format');
    });

    it('should implement circuit breaker pattern for failing services', async () => {
      // Simulate multiple failures to trigger circuit breaker
      mockEmailService.sendEmail.mockRejectedValue(
        new Error('Service overloaded')
      );

      const notifications = Array(10).fill(0).map((_, index) => ({
        type: 'test_notification',
        recipientId: `user-${index}`,
        recipientType: 'user',
        data: {},
        channels: ['email']
      }));

      const results = await Promise.allSettled(
        notifications.map(notification => notificationService.sendNotification(notification))
      );

      const failed = results.filter(r => r.status === 'rejected');
      
      // After circuit breaker triggers, some requests should be rejected immediately
      expect(failed.length).toBeGreaterThan(0);
    });
  });
});
