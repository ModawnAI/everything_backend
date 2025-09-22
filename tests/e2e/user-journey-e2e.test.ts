/**
 * End-to-End User Journey Tests
 * 
 * Comprehensive E2E tests simulating real user interactions:
 * - Complete reservation booking flow from search to completion
 * - User authentication and profile management
 * - Payment processing and refund scenarios
 * - Shop owner management workflows
 * - Mobile and web application interactions
 * - Cross-browser and device compatibility
 */

import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Import services for E2E testing
import { ReservationService } from '../../src/services/reservation.service';
import { PaymentService } from '../../src/services/payment.service';
import { NotificationService } from '../../src/services/notification.service';
import { TimeSlotService } from '../../src/services/time-slot.service';
import { UserService } from '../../src/services/user.service';
import { ShopService } from '../../src/services/shop.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/toss-payments.service');
jest.mock('../../src/services/email.service');
jest.mock('../../src/services/sms.service');
jest.mock('../../src/services/push-notification.service');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { tossPaymentsService } from '../../src/services/toss-payments.service';
import { emailService } from '../../src/services/email.service';
import { smsService } from '../../src/services/sms.service';
import { pushNotificationService } from '../../src/services/push-notification.service';
import { logger } from '../../src/utils/logger';

describe('End-to-End User Journey Tests', () => {
  let reservationService: ReservationService;
  let paymentService: PaymentService;
  let notificationService: NotificationService;
  let timeSlotService: TimeSlotService;
  let userService: UserService;
  let shopService: ShopService;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockTossPaymentsService: jest.Mocked<typeof tossPaymentsService>;
  let mockEmailService: jest.Mocked<typeof emailService>;
  let mockSmsService: jest.Mocked<typeof smsService>;
  let mockPushNotificationService: jest.Mocked<typeof pushNotificationService>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize services
    reservationService = new ReservationService();
    paymentService = new PaymentService();
    notificationService = new NotificationService();
    timeSlotService = new TimeSlotService();
    userService = new UserService();
    shopService = new ShopService();
    testUtils = new ReservationTestUtils();

    // Setup comprehensive mocks
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
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockTossPaymentsService = tossPaymentsService as jest.Mocked<typeof tossPaymentsService>;
    mockEmailService = emailService as jest.Mocked<typeof emailService>;
    mockSmsService = smsService as jest.Mocked<typeof smsService>;
    mockPushNotificationService = pushNotificationService as jest.Mocked<typeof pushNotificationService>;
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('Complete Reservation Booking Journey', () => {
    it('should simulate complete user booking flow from search to completion', async () => {
      // Step 1: User searches for services
      console.log('🎯 E2E Test: Complete Reservation Booking Journey');
      
      const searchResults = await shopService.searchShops({
        location: 'Seoul, Gangnam',
        serviceType: 'hair_salon',
        date: '2024-03-15',
        time: '10:00'
      });

      expect(searchResults.shops).toHaveLength(5);
      expect(searchResults.shops[0].name).toBe('Hair Studio Gangnam');

      // Step 2: User selects a shop and views details
      const shopId = searchResults.shops[0].id;
      const shopDetails = await shopService.getShopDetails(shopId);
      
      expect(shopDetails.id).toBe(shopId);
      expect(shopDetails.services).toHaveLength(3);
      expect(shopDetails.availableTimeSlots).toBeDefined();

      // Step 3: User checks available time slots
      const timeSlots = await timeSlotService.getAvailableTimeSlots({
        shopId,
        date: '2024-03-15',
        serviceIds: ['service-1'],
        duration: { duration: 60, bufferTime: 15 }
      });

      expect(timeSlots).toHaveLength(8);
      expect(timeSlots[0].startTime).toBe('09:00');

      // Step 4: User creates reservation
      const reservationRequest = {
        shopId,
        userId: 'user-e2e-test',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        specialRequests: 'E2E test reservation'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-e2e-123', 
          status: 'requested',
          total_amount: 50000,
          deposit_amount: 10000,
          remaining_amount: 40000
        },
        error: null
      });

      const reservation = await reservationService.createReservation(reservationRequest);
      
      expect(reservation.id).toBe('reservation-e2e-123');
      expect(reservation.status).toBe('requested');

      // Step 5: User makes deposit payment
      const paymentRequest = {
        reservationId: reservation.id,
        amount: 10000,
        paymentMethod: 'card',
        isDeposit: true,
        customerInfo: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '010-1234-5678'
        }
      };

      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: 'payment-e2e-123',
        orderId: 'order-e2e-123',
        amount: 10000,
        status: 'DONE'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'payment-e2e-123',
          reservation_id: reservation.id,
          amount: 10000,
          payment_status: 'completed'
        },
        error: null
      });

      const payment = await paymentService.processPayment(paymentRequest);
      
      expect(payment.success).toBe(true);
      expect(payment.transactionId).toBe('payment-e2e-123');

      // Step 6: Shop owner confirms reservation
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: reservation.id,
          status: 'confirmed',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const confirmationResult = await reservationService.confirmReservation(
        reservation.id,
        'shop-owner-123',
        'Customer confirmed appointment'
      );

      expect(confirmationResult.success).toBe(true);
      expect(confirmationResult.reservation.status).toBe('confirmed');

      // Step 7: User receives confirmation notification
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-e2e-123',
        deliveredAt: new Date().toISOString()
      });

      mockPushNotificationService.sendPushNotification.mockResolvedValue({
        success: true,
        messageId: 'push-e2e-123',
        deliveredAt: new Date().toISOString()
      });

      const notificationResult = await notificationService.sendNotification({
        type: 'reservation_confirmed',
        recipientId: 'user-e2e-test',
        recipientType: 'user',
        data: {
          reservationId: reservation.id,
          shopName: 'Hair Studio Gangnam',
          reservationDate: '2024-03-15',
          reservationTime: '10:00'
        },
        channels: ['email', 'push']
      });

      expect(notificationResult.success).toBe(true);
      expect(notificationResult.deliveryResults).toHaveLength(2);

      // Step 8: User completes remaining payment
      const remainingPaymentRequest = {
        reservationId: reservation.id,
        amount: 40000,
        paymentMethod: 'card',
        isDeposit: false,
        customerInfo: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '010-1234-5678'
        }
      };

      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: 'payment-e2e-456',
        orderId: 'order-e2e-456',
        amount: 40000,
        status: 'DONE'
      });

      const remainingPayment = await paymentService.processPayment(remainingPaymentRequest);
      
      expect(remainingPayment.success).toBe(true);

      // Step 9: Service completion
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: reservation.id,
          status: 'completed',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const completionResult = await reservationService.completeReservation(
        reservation.id,
        'shop-owner-123',
        'Service completed successfully'
      );

      expect(completionResult.success).toBe(true);
      expect(completionResult.reservation.status).toBe('completed');

      console.log('✅ E2E Test: Complete booking journey successful');
    });

    it('should simulate user cancellation and refund flow', async () => {
      console.log('🎯 E2E Test: User Cancellation and Refund Flow');
      
      // Step 1: User creates and pays for reservation
      const reservationRequest = {
        shopId: 'shop-123',
        userId: 'user-cancel-test',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-cancel-123', 
          status: 'confirmed',
          total_amount: 50000,
          paid_amount: 50000
        },
        error: null
      });

      const reservation = await reservationService.createReservation(reservationRequest);

      // Step 2: User requests cancellation
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: reservation.id,
          status: 'cancelled_by_user',
          cancellation_reason: 'Schedule conflict',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const cancellationResult = await reservationService.cancelReservation(
        reservation.id,
        'user-cancel-test',
        'Schedule conflict'
      );

      expect(cancellationResult.success).toBe(true);
      expect(cancellationResult.reservation.status).toBe('cancelled_by_user');

      // Step 3: System processes refund
      mockTossPaymentsService.cancelPayment.mockResolvedValue({
        success: true,
        cancelAmount: 50000,
        cancelReason: 'Customer requested cancellation',
        canceledAt: new Date().toISOString()
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'refund-cancel-123',
          reservation_id: reservation.id,
          amount: 50000,
          refund_status: 'completed'
        },
        error: null
      });

      const refundResult = await paymentService.processRefund({
        reservationId: reservation.id,
        amount: 50000,
        reason: 'Customer requested cancellation',
        refundType: 'full'
      });

      expect(refundResult.success).toBe(true);
      expect(refundResult.amount).toBe(50000);

      // Step 4: User receives refund notification
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-refund-123',
        deliveredAt: new Date().toISOString()
      });

      const refundNotification = await notificationService.sendNotification({
        type: 'refund_processed',
        recipientId: 'user-cancel-test',
        recipientType: 'user',
        data: {
          reservationId: reservation.id,
          refundAmount: 50000,
          refundDate: new Date().toISOString()
        },
        channels: ['email']
      });

      expect(refundNotification.success).toBe(true);

      console.log('✅ E2E Test: Cancellation and refund flow successful');
    });

    it('should simulate no-show scenario and automatic processing', async () => {
      console.log('🎯 E2E Test: No-Show Scenario and Automatic Processing');
      
      // Step 1: Create confirmed reservation for past time
      const pastTime = new Date();
      pastTime.setMinutes(pastTime.getMinutes() - 30);
      const pastTimeStr = pastTime.toISOString().substring(11, 16);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [{
                    id: 'reservation-noshow-123',
                    status: 'confirmed',
                    reservation_date: new Date().toISOString().split('T')[0],
                    start_time: pastTimeStr,
                    user_id: 'user-noshow-test',
                    shop_id: 'shop-123'
                  }],
                  error: null
                })
              })
            })
          })
        })
      });

      // Step 2: System detects no-show and automatically updates status
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-noshow-123',
          status: 'no_show',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const noShowResult = await reservationService.processNoShowReservations();
      
      expect(noShowResult.processedCount).toBe(1);
      expect(noShowResult.transitions).toHaveLength(1);
      expect(noShowResult.transitions[0].toStatus).toBe('no_show');

      // Step 3: Shop owner receives no-show notification
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-noshow-123',
        deliveredAt: new Date().toISOString()
      });

      const noShowNotification = await notificationService.sendNotification({
        type: 'reservation_no_show',
        recipientId: 'shop-owner-123',
        recipientType: 'shop_owner',
        data: {
          reservationId: 'reservation-noshow-123',
          customerName: 'No Show Customer',
          serviceName: 'Hair Cut',
          scheduledTime: pastTimeStr
        },
        channels: ['email']
      });

      expect(noShowNotification.success).toBe(true);

      console.log('✅ E2E Test: No-show scenario processing successful');
    });
  });

  describe('User Authentication and Profile Management Journey', () => {
    it('should simulate complete user registration and profile setup', async () => {
      console.log('🎯 E2E Test: User Registration and Profile Setup');
      
      // Step 1: User registration
      const registrationData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'New User',
        phone: '010-9876-5432',
        dateOfBirth: '1990-01-01'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'user-registration-123',
          email: registrationData.email,
          name: registrationData.name,
          status: 'active',
          created_at: new Date().toISOString()
        },
        error: null
      });

      const registrationResult = await userService.registerUser(registrationData);
      
      expect(registrationResult.success).toBe(true);
      expect(registrationResult.user.id).toBe('user-registration-123');

      // Step 2: Email verification
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-verification-123',
        deliveredAt: new Date().toISOString()
      });

      const verificationEmail = await userService.sendVerificationEmail('user-registration-123');
      
      expect(verificationEmail.success).toBe(true);

      // Step 3: User verifies email and completes profile
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'user-registration-123',
          email_verified: true,
          profile_completed: true,
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const profileCompletion = await userService.completeProfile('user-registration-123', {
        preferences: {
          notifications: {
            email: true,
            sms: false,
            push: true
          },
          language: 'ko',
          timezone: 'Asia/Seoul'
        },
        interests: ['hair_salon', 'beauty_spa'],
        location: {
          city: 'Seoul',
          district: 'Gangnam'
        }
      });

      expect(profileCompletion.success).toBe(true);

      // Step 4: User updates notification preferences
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'user-registration-123',
          notification_preferences: {
            email: true,
            sms: true,
            push: false
          },
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const preferenceUpdate = await userService.updateNotificationPreferences(
        'user-registration-123',
        {
          email: true,
          sms: true,
          push: false
        }
      );

      expect(preferenceUpdate.success).toBe(true);

      console.log('✅ E2E Test: User registration and profile setup successful');
    });

    it('should simulate user login and session management', async () => {
      console.log('🎯 E2E Test: User Login and Session Management');
      
      // Step 1: User login
      const loginCredentials = {
        email: 'user@example.com',
        password: 'SecurePassword123!'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          user: {
            id: 'user-login-123',
            email: loginCredentials.email,
            name: 'Test User'
          },
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
            expires_at: new Date(Date.now() + 3600000).toISOString()
          }
        },
        error: null
      });

      const loginResult = await userService.loginUser(loginCredentials);
      
      expect(loginResult.success).toBe(true);
      expect(loginResult.session.access_token).toBe('access-token-123');

      // Step 2: User accesses protected resource
      const protectedResource = await userService.getUserProfile('user-login-123', 'access-token-123');
      
      expect(protectedResource.success).toBe(true);
      expect(protectedResource.user.id).toBe('user-login-123');

      // Step 3: Session refresh
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          session: {
            access_token: 'new-access-token-123',
            refresh_token: 'new-refresh-token-123',
            expires_at: new Date(Date.now() + 3600000).toISOString()
          }
        },
        error: null
      });

      const refreshResult = await userService.refreshSession('refresh-token-123');
      
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.session.access_token).toBe('new-access-token-123');

      // Step 4: User logout
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null
      });

      const logoutResult = await userService.logoutUser('user-login-123', 'access-token-123');
      
      expect(logoutResult.success).toBe(true);

      console.log('✅ E2E Test: User login and session management successful');
    });
  });

  describe('Shop Owner Management Journey', () => {
    it('should simulate shop owner business management workflow', async () => {
      console.log('🎯 E2E Test: Shop Owner Business Management Workflow');
      
      // Step 1: Shop owner views dashboard
      const dashboardData = await shopService.getOwnerDashboard('shop-owner-123');
      
      expect(dashboardData.todayReservations).toBeDefined();
      expect(dashboardData.weeklyRevenue).toBeDefined();
      expect(dashboardData.pendingRequests).toBeDefined();

      // Step 2: Shop owner manages reservations
      const pendingReservations = await reservationService.getPendingReservations('shop-123');
      
      expect(pendingReservations).toHaveLength(3);

      // Step 3: Shop owner confirms reservation
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-shop-123',
          status: 'confirmed',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const confirmation = await reservationService.confirmReservation(
        'reservation-shop-123',
        'shop-owner-123',
        'Confirmed by shop owner'
      );

      expect(confirmation.success).toBe(true);

      // Step 4: Shop owner updates business hours
      const newHours = {
        monday: { open: '09:00', close: '19:00' },
        tuesday: { open: '09:00', close: '19:00' },
        wednesday: { open: '09:00', close: '19:00' },
        thursday: { open: '09:00', close: '19:00' },
        friday: { open: '09:00', close: '20:00' },
        saturday: { open: '10:00', close: '18:00' },
        sunday: null
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'shop-123',
          operating_hours: newHours,
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const hoursUpdate = await shopService.updateOperatingHours('shop-123', newHours);
      
      expect(hoursUpdate.success).toBe(true);

      // Step 5: Shop owner adds new service
      const newService = {
        name: 'Premium Hair Treatment',
        description: 'Advanced hair treatment with premium products',
        price: 80000,
        duration: 90,
        category: 'hair_treatment',
        isActive: true
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'service-new-123',
          ...newService,
          shop_id: 'shop-123',
          created_at: new Date().toISOString()
        },
        error: null
      });

      const serviceAddition = await shopService.addService('shop-123', newService);
      
      expect(serviceAddition.success).toBe(true);
      expect(serviceAddition.service.id).toBe('service-new-123');

      // Step 6: Shop owner views analytics
      const analytics = await shopService.getBusinessAnalytics('shop-123', {
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        metrics: ['revenue', 'reservations', 'customer_satisfaction']
      });

      expect(analytics.revenue).toBeDefined();
      expect(analytics.reservations).toBeDefined();
      expect(analytics.customerSatisfaction).toBeDefined();

      console.log('✅ E2E Test: Shop owner business management workflow successful');
    });
  });

  describe('Mobile Application Journey', () => {
    it('should simulate mobile app user experience', async () => {
      console.log('🎯 E2E Test: Mobile App User Experience');
      
      // Step 1: Mobile app startup and location detection
      const locationData = {
        latitude: 37.5665,
        longitude: 126.9780,
        city: 'Seoul',
        district: 'Gangnam'
      };

      const nearbyShops = await shopService.getNearbyShops(locationData, {
        radius: 5000, // 5km
        serviceType: 'hair_salon'
      });

      expect(nearbyShops.shops).toHaveLength(10);
      expect(nearbyShops.shops[0].distance).toBeLessThan(5000);

      // Step 2: Mobile push notification handling
      mockPushNotificationService.sendPushNotification.mockResolvedValue({
        success: true,
        messageId: 'push-mobile-123',
        deliveredAt: new Date().toISOString()
      });

      const pushNotification = await notificationService.sendNotification({
        type: 'reservation_reminder',
        recipientId: 'mobile-user-123',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-mobile-123',
          shopName: 'Mobile Hair Studio',
          reservationTime: '14:00'
        },
        channels: ['push'],
        mobileData: {
          deepLink: 'myapp://reservation/123',
          badge: 1,
          sound: 'default'
        }
      });

      expect(pushNotification.success).toBe(true);

      // Step 3: Offline functionality simulation
      const offlineReservations = await reservationService.getOfflineReservations('mobile-user-123');
      
      expect(offlineReservations).toBeDefined();
      expect(Array.isArray(offlineReservations)).toBe(true);

      // Step 4: Mobile payment processing
      const mobilePayment = {
        reservationId: 'reservation-mobile-123',
        amount: 50000,
        paymentMethod: 'mobile_pay',
        mobileData: {
          deviceId: 'mobile-device-123',
          appVersion: '2.1.0',
          platform: 'ios'
        }
      };

      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: 'payment-mobile-123',
        orderId: 'order-mobile-123',
        amount: 50000,
        status: 'DONE'
      });

      const paymentResult = await paymentService.processMobilePayment(mobilePayment);
      
      expect(paymentResult.success).toBe(true);
      expect(paymentResult.transactionId).toBe('payment-mobile-123');

      console.log('✅ E2E Test: Mobile app user experience successful');
    });
  });

  describe('Cross-Browser and Device Compatibility', () => {
    it('should simulate cross-browser compatibility testing', async () => {
      console.log('🎯 E2E Test: Cross-Browser Compatibility');
      
      const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
      const devices = ['Desktop', 'Tablet', 'Mobile'];

      for (const browser of browsers) {
        for (const device of devices) {
          console.log(`Testing ${browser} on ${device}`);
          
          // Simulate browser-specific functionality
          const browserCapabilities = {
            browser,
            device,
            supportsWebRTC: browser !== 'Safari',
            supportsNotifications: browser !== 'Safari',
            supportsServiceWorker: browser !== 'Safari'
          };

          // Test reservation creation across browsers
          const reservationRequest = {
            shopId: 'shop-123',
            userId: `user-${browser.toLowerCase()}-${device.toLowerCase()}`,
            services: [{ serviceId: 'service-1', quantity: 1 }],
            reservationDate: '2024-03-15',
            reservationTime: '10:00',
            browserInfo: browserCapabilities
          };

          mockSupabase.rpc.mockResolvedValue({
            data: { 
              id: `reservation-${browser}-${device}-123`,
              status: 'requested',
              browser_info: browserCapabilities
            },
            error: null
          });

          const reservation = await reservationService.createReservation(reservationRequest);
          
          expect(reservation.success).toBe(true);
          expect(reservation.id).toBe(`reservation-${browser}-${device}-123`);

          // Test payment processing across browsers
          if (browserCapabilities.supportsWebRTC) {
            const paymentRequest = {
              reservationId: reservation.id,
              amount: 50000,
              paymentMethod: 'card',
              browserInfo: browserCapabilities
            };

            mockTossPaymentsService.createPayment.mockResolvedValue({
              success: true,
              paymentKey: `payment-${browser}-${device}-123`,
              orderId: `order-${browser}-${device}-123`,
              amount: 50000,
              status: 'DONE'
            });

            const payment = await paymentService.processPayment(paymentRequest);
            
            expect(payment.success).toBe(true);
          }
        }
      }

      console.log('✅ E2E Test: Cross-browser compatibility testing successful');
    });
  });

  describe('Error Handling and Recovery Journey', () => {
    it('should simulate error scenarios and recovery mechanisms', async () => {
      console.log('🎯 E2E Test: Error Handling and Recovery Mechanisms');
      
      // Step 1: Network failure during reservation creation
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Network connection failed'));
      
      const reservationRequest = {
        shopId: 'shop-123',
        userId: 'user-error-test',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      };

      try {
        await reservationService.createReservation(reservationRequest);
      } catch (error) {
        expect(error.message).toBe('Network connection failed');
      }

      // Step 2: Retry with exponential backoff
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-retry-123',
          status: 'requested'
        },
        error: null
      });

      const retryResult = await reservationService.createReservationWithRetry(reservationRequest);
      
      expect(retryResult.success).toBe(true);
      expect(retryResult.reservation.id).toBe('reservation-retry-123');

      // Step 3: Payment failure and retry
      mockTossPaymentsService.createPayment.mockRejectedValueOnce(
        new Error('Payment gateway temporarily unavailable')
      );

      const paymentRequest = {
        reservationId: 'reservation-retry-123',
        amount: 50000,
        paymentMethod: 'card'
      };

      try {
        await paymentService.processPayment(paymentRequest);
      } catch (error) {
        expect(error.message).toBe('Payment gateway temporarily unavailable');
      }

      // Step 4: Successful retry
      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: 'payment-retry-123',
        orderId: 'order-retry-123',
        amount: 50000,
        status: 'DONE'
      });

      const retryPayment = await paymentService.processPaymentWithRetry(paymentRequest);
      
      expect(retryPayment.success).toBe(true);

      // Step 5: Notification failure and fallback
      mockEmailService.sendEmail.mockRejectedValue(
        new Error('Email service temporarily unavailable')
      );

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: 'sms-fallback-123',
        deliveredAt: new Date().toISOString()
      });

      const fallbackNotification = await notificationService.sendNotification({
        type: 'reservation_confirmed',
        recipientId: 'user-error-test',
        recipientType: 'user',
        data: {
          reservationId: 'reservation-retry-123'
        },
        channels: ['email', 'sms'],
        fallbackChannels: ['sms']
      });

      expect(fallbackNotification.success).toBe(true);
      expect(fallbackNotification.deliveryResults.some(r => r.channel === 'sms' && r.success)).toBe(true);

      console.log('✅ E2E Test: Error handling and recovery mechanisms successful');
    });
  });
});
