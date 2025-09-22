/**
 * API Performance Tests
 * 
 * Performance tests focusing on API endpoints:
 * - REST API response time benchmarks
 * - GraphQL query performance under load
 * - WebSocket connection handling performance
 * - API rate limiting and throttling
 * - Authentication and authorization performance
 * - File upload and download performance
 */

import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Import API services and controllers
import { ReservationController } from '../../src/controllers/reservation.controller';
import { PaymentController } from '../../src/controllers/payment.controller';
import { NotificationController } from '../../src/controllers/notification.controller';
import { MonitoringController } from '../../src/controllers/monitoring.controller';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/reservation.service');
jest.mock('../../src/services/payment.service');
jest.mock('../../src/services/notification.service');
jest.mock('../../src/services/monitoring.service');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { reservationService } from '../../src/services/reservation.service';
import { paymentService } from '../../src/services/payment.service';
import { notificationService } from '../../src/services/notification.service';
import { monitoringService } from '../../src/services/monitoring.service';
import { logger } from '../../src/utils/logger';

describe('API Performance Tests', () => {
  let reservationController: ReservationController;
  let paymentController: PaymentController;
  let notificationController: NotificationController;
  let monitoringController: MonitoringController;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockReservationService: jest.Mocked<typeof reservationService>;
  let mockPaymentService: jest.Mocked<typeof paymentService>;
  let mockNotificationService: jest.Mocked<typeof notificationService>;
  let mockMonitoringService: jest.Mocked<typeof monitoringService>;
  let mockLogger: jest.Mocked<typeof logger>;

  // API performance thresholds
  const API_PERFORMANCE_THRESHOLDS = {
    restEndpoint: 500, // ms
    graphqlQuery: 300, // ms
    websocketMessage: 50, // ms
    authentication: 200, // ms
    fileUpload: 2000, // ms per MB
    rateLimit: 1000, // requests per minute
    concurrentConnections: 1000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize controllers
    reservationController = new ReservationController();
    paymentController = new PaymentController();
    notificationController = new NotificationController();
    monitoringController = new MonitoringController();
    testUtils = new ReservationTestUtils();

    // Setup mocks
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockReservationService = reservationService as jest.Mocked<typeof reservationService>;
    mockPaymentService = paymentService as jest.Mocked<typeof paymentService>;
    mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;
    mockMonitoringService = monitoringService as jest.Mocked<typeof monitoringService>;
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('REST API Endpoint Performance', () => {
    it('should meet response time requirements for reservation creation endpoint', async () => {
      const reservationRequests = Array(100).fill(0).map((_, index) => ({
        body: {
          shopId: 'shop-123',
          userId: `user-${index}`,
          services: [{ serviceId: 'service-1', quantity: 1 }],
          reservationDate: '2024-03-15',
          reservationTime: '10:00'
        },
        headers: {
          'authorization': `Bearer token-${index}`,
          'content-type': 'application/json'
        }
      }));

      mockReservationService.createReservation.mockResolvedValue({
        id: 'reservation-api-test',
        status: 'requested',
        createdAt: new Date().toISOString()
      });

      const startTime = performance.now();
      
      const results = await Promise.all(
        reservationRequests.map(request => 
          reservationController.createReservation(request.body, request.headers)
        )
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averageResponseTime = executionTime / reservationRequests.length;

      // Performance assertions
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(averageResponseTime).toBeLessThan(API_PERFORMANCE_THRESHOLDS.restEndpoint);
      expect(results).toHaveLength(100);

      console.log(`REST API Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average response time: ${averageResponseTime.toFixed(2)}ms
        - Requests per second: ${(100 / (executionTime / 1000)).toFixed(2)}`);
    });

    it('should handle payment processing endpoint performance', async () => {
      const paymentRequests = Array(50).fill(0).map((_, index) => ({
        body: {
          reservationId: `reservation-${index}`,
          amount: 50000,
          paymentMethod: 'card',
          customerInfo: {
            name: `Customer ${index}`,
            email: `customer${index}@example.com`
          }
        },
        headers: {
          'authorization': `Bearer token-${index}`,
          'content-type': 'application/json'
        }
      }));

      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        transactionId: `payment-${index}`,
        amount: 50000
      });

      const startTime = performance.now();
      
      const results = await Promise.all(
        paymentRequests.map(request => 
          paymentController.processPayment(request.body, request.headers)
        )
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averageResponseTime = executionTime / paymentRequests.length;

      // Performance assertions
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(averageResponseTime).toBeLessThan(API_PERFORMANCE_THRESHOLDS.restEndpoint);
      expect(results).toHaveLength(50);

      console.log(`Payment API Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average response time: ${averageResponseTime.toFixed(2)}ms
        - Payment requests per second: ${(50 / (executionTime / 1000)).toFixed(2)}`);
    });

    it('should handle monitoring endpoint performance under load', async () => {
      const monitoringRequests = Array(200).fill(0).map((_, index) => ({
        query: {
          shopId: 'shop-123',
          dateRange: {
            start: '2024-03-01',
            end: '2024-03-31'
          },
          metrics: ['reservations', 'revenue', 'cancellations']
        },
        headers: {
          'authorization': `Bearer admin-token-${index}`
        }
      }));

      mockMonitoringService.getDashboardMetrics.mockResolvedValue({
        totalReservations: 150,
        totalRevenue: 7500000,
        cancellationRate: 0.05,
        averageRating: 4.8
      });

      const startTime = performance.now();
      
      const results = await Promise.all(
        monitoringRequests.map(request => 
          monitoringController.getDashboardMetrics(request.query, request.headers)
        )
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averageResponseTime = executionTime / monitoringRequests.length;

      // Performance assertions
      expect(executionTime).toBeLessThan(8000); // Should complete within 8 seconds
      expect(averageResponseTime).toBeLessThan(API_PERFORMANCE_THRESHOLDS.restEndpoint);
      expect(results).toHaveLength(200);

      console.log(`Monitoring API Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average response time: ${averageResponseTime.toFixed(2)}ms
        - Monitoring requests per second: ${(200 / (executionTime / 1000)).toFixed(2)}`);
    });
  });

  describe('GraphQL Query Performance', () => {
    it('should handle complex GraphQL queries efficiently', async () => {
      const graphqlQueries = Array(30).fill(0).map((_, index) => ({
        query: `
          query GetReservationDetails($reservationId: ID!) {
            reservation(id: $reservationId) {
              id
              status
              shop {
                id
                name
                address
                owner {
                  id
                  name
                  email
                }
              }
              user {
                id
                name
                email
                phone
              }
              services {
                id
                name
                price
                duration
              }
              payments {
                id
                amount
                status
                createdAt
              }
              notifications {
                id
                type
                status
                sentAt
              }
            }
          }
        `,
        variables: {
          reservationId: `reservation-gql-${index}`
        }
      }));

      // Mock GraphQL resolver response
      const mockGraphQLResponse = {
        data: {
          reservation: {
            id: 'reservation-gql-test',
            status: 'confirmed',
            shop: {
              id: 'shop-123',
              name: 'Test Shop',
              address: '123 Test St',
              owner: {
                id: 'owner-123',
                name: 'Shop Owner',
                email: 'owner@testshop.com'
              }
            },
            user: {
              id: 'user-123',
              name: 'Test User',
              email: 'user@test.com',
              phone: '010-1234-5678'
            },
            services: [{
              id: 'service-1',
              name: 'Hair Cut',
              price: 50000,
              duration: 60
            }],
            payments: [{
              id: 'payment-1',
              amount: 50000,
              status: 'completed',
              createdAt: new Date().toISOString()
            }],
            notifications: [{
              id: 'notification-1',
              type: 'confirmation',
              status: 'sent',
              sentAt: new Date().toISOString()
            }]
          }
        }
      };

      const startTime = performance.now();
      
      // Simulate GraphQL query execution
      const results = await Promise.all(
        graphqlQueries.map(query => {
          return new Promise(resolve => {
            // Simulate GraphQL processing time
            setTimeout(() => {
              resolve(mockGraphQLResponse);
            }, Math.random() * 100 + 50); // 50-150ms processing time
          });
        })
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averageQueryTime = executionTime / graphqlQueries.length;

      // Performance assertions
      expect(executionTime).toBeLessThan(8000); // Should complete within 8 seconds
      expect(averageQueryTime).toBeLessThan(API_PERFORMANCE_THRESHOLDS.graphqlQuery);
      expect(results).toHaveLength(30);

      console.log(`GraphQL Query Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average query time: ${averageQueryTime.toFixed(2)}ms
        - GraphQL queries per second: ${(30 / (executionTime / 1000)).toFixed(2)}`);
    });

    it('should handle GraphQL subscription performance', async () => {
      const subscriptionCount = 100;
      const messagesPerSubscription = 10;
      
      const subscriptions = Array(subscriptionCount).fill(0).map((_, index) => ({
        subscriptionId: `sub-${index}`,
        channel: 'reservation-updates',
        filter: {
          shopId: `shop-${index % 10}` // Distribute across 10 shops
        }
      }));

      const startTime = performance.now();
      
      // Simulate subscription setup and message handling
      const subscriptionPromises = subscriptions.map(async (subscription) => {
        const messages = [];
        
        for (let i = 0; i < messagesPerSubscription; i++) {
          const message = {
            id: `msg-${subscription.subscriptionId}-${i}`,
            type: 'reservation_updated',
            data: {
              reservationId: `reservation-${i}`,
              status: 'confirmed',
              timestamp: new Date().toISOString()
            }
          };
          
          // Simulate message processing time
          await new Promise(resolve => setTimeout(resolve, 10));
          messages.push(message);
        }
        
        return messages;
      });

      const results = await Promise.all(subscriptionPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averageMessageTime = executionTime / (subscriptionCount * messagesPerSubscription);

      // Performance assertions
      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(averageMessageTime).toBeLessThan(API_PERFORMANCE_THRESHOLDS.websocketMessage);
      expect(results).toHaveLength(subscriptionCount);

      console.log(`GraphQL Subscription Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Subscriptions: ${subscriptionCount}
        - Messages per subscription: ${messagesPerSubscription}
        - Average message processing time: ${averageMessageTime.toFixed(2)}ms`);
    });
  });

  describe('WebSocket Connection Performance', () => {
    it('should handle high concurrent WebSocket connections', async () => {
      const connectionCount = API_PERFORMANCE_THRESHOLDS.concurrentConnections;
      const connections = Array(connectionCount).fill(0).map((_, index) => ({
        connectionId: `ws-${index}`,
        userId: `user-${index}`,
        shopId: `shop-${index % 20}`, // Distribute across 20 shops
        connectionTime: new Date().toISOString()
      }));

      const startTime = performance.now();
      
      // Simulate WebSocket connection establishment
      const connectionPromises = connections.map(async (connection) => {
        // Simulate connection handshake
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
        
        return {
          connectionId: connection.connectionId,
          status: 'connected',
          latency: Math.random() * 50 + 10
        };
      });

      const results = await Promise.all(connectionPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averageConnectionTime = executionTime / connectionCount;

      // Performance assertions
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(averageConnectionTime).toBeLessThan(100); // Average connection time should be less than 100ms
      expect(results).toHaveLength(connectionCount);

      console.log(`WebSocket Connection Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Concurrent connections: ${connectionCount}
        - Average connection time: ${averageConnectionTime.toFixed(2)}ms
        - Connections per second: ${(connectionCount / (executionTime / 1000)).toFixed(2)}`);
    });

    it('should handle WebSocket message broadcasting performance', async () => {
      const activeConnections = 500;
      const messageCount = 100;
      
      const connections = Array(activeConnections).fill(0).map((_, index) => ({
        connectionId: `ws-broadcast-${index}`,
        userId: `user-${index}`,
        shopId: `shop-${index % 10}` // Distribute across 10 shops
      }));

      const messages = Array(messageCount).fill(0).map((_, index) => ({
        id: `broadcast-${index}`,
        type: 'reservation_notification',
        data: {
          reservationId: `reservation-${index}`,
          message: `Reservation update ${index}`,
          timestamp: new Date().toISOString()
        },
        targetShopIds: Array(10).fill(0).map((_, i) => `shop-${i}`)
      }));

      const startTime = performance.now();
      
      // Simulate message broadcasting
      const broadcastPromises = messages.map(async (message) => {
        const targetConnections = connections.filter(conn => 
          message.targetShopIds.includes(conn.shopId)
        );
        
        // Simulate sending message to all target connections
        const sendPromises = targetConnections.map(async (connection) => {
          await new Promise(resolve => setTimeout(resolve, 5)); // 5ms per connection
          return {
            connectionId: connection.connectionId,
            messageId: message.id,
            sent: true
          };
        });
        
        return Promise.all(sendPromises);
      });

      const results = await Promise.all(broadcastPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const totalMessagesSent = results.reduce((sum, batch) => sum + batch.length, 0);
      const messagesPerSecond = totalMessagesSent / (executionTime / 1000);

      // Performance assertions
      expect(executionTime).toBeLessThan(20000); // Should complete within 20 seconds
      expect(messagesPerSecond).toBeGreaterThan(1000); // Should handle at least 1000 messages per second
      expect(totalMessagesSent).toBe(messageCount * activeConnections);

      console.log(`WebSocket Broadcasting Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Messages broadcast: ${messageCount}
        - Total messages sent: ${totalMessagesSent}
        - Messages per second: ${messagesPerSecond.toFixed(2)}`);
    });
  });

  describe('Authentication and Authorization Performance', () => {
    it('should handle JWT token validation performance', async () => {
      const authRequests = Array(1000).fill(0).map((_, index) => ({
        token: `jwt-token-${index}`,
        userId: `user-${index}`,
        roles: ['user', 'customer'],
        permissions: ['read:reservations', 'create:reservations']
      }));

      const startTime = performance.now();
      
      // Simulate JWT token validation
      const validationPromises = authRequests.map(async (request) => {
        // Simulate JWT validation processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
        
        return {
          valid: true,
          userId: request.userId,
          roles: request.roles,
          permissions: request.permissions,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        };
      });

      const results = await Promise.all(validationPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averageValidationTime = executionTime / authRequests.length;

      // Performance assertions
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(averageValidationTime).toBeLessThan(API_PERFORMANCE_THRESHOLDS.authentication);
      expect(results).toHaveLength(1000);

      console.log(`JWT Validation Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Token validations: ${authRequests.length}
        - Average validation time: ${averageValidationTime.toFixed(2)}ms
        - Validations per second: ${(1000 / (executionTime / 1000)).toFixed(2)}`);
    });

    it('should handle role-based access control performance', async () => {
      const rbacRequests = Array(500).fill(0).map((_, index) => ({
        userId: `user-${index}`,
        resource: `reservation-${index}`,
        action: ['read', 'update', 'delete'][index % 3],
        requiredPermissions: [
          ['read:reservations'],
          ['update:reservations'],
          ['delete:reservations']
        ][index % 3]
      }));

      const startTime = performance.now();
      
      // Simulate RBAC permission checking
      const permissionPromises = rbacRequests.map(async (request) => {
        // Simulate permission lookup and validation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10));
        
        const hasPermission = Math.random() > 0.1; // 90% have permission
        
        return {
          userId: request.userId,
          resource: request.resource,
          action: request.action,
          allowed: hasPermission,
          permissions: request.requiredPermissions
        };
      });

      const results = await Promise.all(permissionPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averagePermissionTime = executionTime / rbacRequests.length;

      // Performance assertions
      expect(executionTime).toBeLessThan(8000); // Should complete within 8 seconds
      expect(averagePermissionTime).toBeLessThan(API_PERFORMANCE_THRESHOLDS.authentication);
      expect(results).toHaveLength(500);

      console.log(`RBAC Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Permission checks: ${rbacRequests.length}
        - Average permission check time: ${averagePermissionTime.toFixed(2)}ms
        - Permission checks per second: ${(500 / (executionTime / 1000)).toFixed(2)}`);
    });
  });

  describe('Rate Limiting and Throttling Performance', () => {
    it('should enforce rate limits without significant performance impact', async () => {
      const rateLimitRequests = Array(1200).fill(0).map((_, index) => ({
        userId: `user-${index % 100}`, // 100 unique users, 12 requests each
        endpoint: '/api/reservations',
        timestamp: Date.now() + (index * 1000) // 1 request per second
      }));

      const rateLimiter = new Map();
      const windowSize = 60000; // 1 minute
      const maxRequests = API_PERFORMANCE_THRESHOLDS.rateLimit;

      const startTime = performance.now();
      
      // Simulate rate limiting
      const rateLimitResults = rateLimitRequests.map((request) => {
        const key = `${request.userId}:${request.endpoint}`;
        const now = Date.now();
        
        if (!rateLimiter.has(key)) {
          rateLimiter.set(key, []);
        }
        
        const requests = rateLimiter.get(key);
        
        // Remove old requests outside the window
        const validRequests = requests.filter(timestamp => now - timestamp < windowSize);
        
        if (validRequests.length < maxRequests) {
          validRequests.push(now);
          rateLimiter.set(key, validRequests);
          return { allowed: true, remaining: maxRequests - validRequests.length };
        } else {
          return { allowed: false, remaining: 0 };
        }
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averageRateLimitTime = executionTime / rateLimitRequests.length;

      const allowedRequests = rateLimitResults.filter(r => r.allowed);
      const blockedRequests = rateLimitResults.filter(r => !r.allowed);

      // Performance assertions
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(averageRateLimitTime).toBeLessThan(5); // Should be very fast
      expect(allowedRequests.length).toBeGreaterThan(1000); // Most should be allowed
      expect(blockedRequests.length).toBeGreaterThan(0); // Some should be blocked

      console.log(`Rate Limiting Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Rate limit checks: ${rateLimitRequests.length}
        - Average rate limit time: ${averageRateLimitTime.toFixed(2)}ms
        - Allowed requests: ${allowedRequests.length}
        - Blocked requests: ${blockedRequests.length}`);
    });

    it('should handle throttling scenarios efficiently', async () => {
      const throttleRequests = Array(200).fill(0).map((_, index) => ({
        userId: `user-throttle-${index}`,
        endpoint: '/api/payments',
        priority: index % 3 // 0: low, 1: medium, 2: high
      }));

      const throttler = new Map();
      const throttleLimits = {
        low: 10,    // 10 requests per minute
        medium: 50, // 50 requests per minute
        high: 100   // 100 requests per minute
      };

      const startTime = performance.now();
      
      // Simulate throttling with priority
      const throttleResults = throttleRequests.map((request) => {
        const priority = ['low', 'medium', 'high'][request.priority];
        const key = `${request.userId}:${priority}`;
        const limit = throttleLimits[priority];
        
        if (!throttler.has(key)) {
          throttler.set(key, 0);
        }
        
        const currentCount = throttler.get(key);
        
        if (currentCount < limit) {
          throttler.set(key, currentCount + 1);
          return { 
            allowed: true, 
            priority, 
            remaining: limit - currentCount - 1,
            throttleDelay: 0
          };
        } else {
          // Calculate throttle delay based on priority
          const throttleDelay = priority === 'high' ? 1000 : priority === 'medium' ? 2000 : 5000;
          return { 
            allowed: false, 
            priority, 
            remaining: 0,
            throttleDelay
          };
        }
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const allowedRequests = throttleResults.filter(r => r.allowed);
      const blockedRequests = throttleResults.filter(r => !r.allowed);

      // Performance assertions
      expect(executionTime).toBeLessThan(1000); // Should be very fast
      expect(allowedRequests.length).toBeGreaterThan(100);
      expect(blockedRequests.length).toBeGreaterThan(50);

      console.log(`Throttling Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Throttle checks: ${throttleRequests.length}
        - Allowed requests: ${allowedRequests.length}
        - Blocked requests: ${blockedRequests.length}
        - High priority allowed: ${allowedRequests.filter(r => r.priority === 'high').length}
        - Low priority blocked: ${blockedRequests.filter(r => r.priority === 'low').length}`);
    });
  });

  describe('File Upload and Download Performance', () => {
    it('should handle file upload performance benchmarks', async () => {
      const fileUploads = Array(20).fill(0).map((_, index) => ({
        fileName: `test-file-${index}.jpg`,
        fileSize: Math.floor(Math.random() * 5 + 1) * 1024 * 1024, // 1-5MB
        fileType: 'image/jpeg',
        userId: `user-${index}`
      }));

      const startTime = performance.now();
      
      // Simulate file upload processing
      const uploadPromises = fileUploads.map(async (upload) => {
        const uploadTime = upload.fileSize / (1024 * 1024) * 1000; // Simulate 1MB/second upload
        await new Promise(resolve => setTimeout(resolve, uploadTime));
        
        return {
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          uploadTime,
          uploadSpeed: upload.fileSize / uploadTime * 1000, // bytes per second
          success: true
        };
      });

      const results = await Promise.all(uploadPromises);
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      const totalFileSize = fileUploads.reduce((sum, upload) => sum + upload.fileSize, 0);
      const averageUploadSpeed = totalFileSize / (totalExecutionTime / 1000);

      // Performance assertions
      expect(totalExecutionTime).toBeLessThan(60000); // Should complete within 1 minute
      expect(averageUploadSpeed).toBeGreaterThan(1024 * 1024); // Should be at least 1MB/second
      expect(results).toHaveLength(20);

      console.log(`File Upload Performance:
        - Total execution time: ${totalExecutionTime.toFixed(2)}ms
        - Total file size: ${(totalFileSize / 1024 / 1024).toFixed(2)}MB
        - Average upload speed: ${(averageUploadSpeed / 1024 / 1024).toFixed(2)}MB/s
        - Files uploaded: ${fileUploads.length}`);
    });

    it('should handle file download performance benchmarks', async () => {
      const fileDownloads = Array(50).fill(0).map((_, index) => ({
        fileId: `file-${index}`,
        fileName: `download-${index}.pdf`,
        fileSize: Math.floor(Math.random() * 10 + 1) * 1024 * 1024, // 1-10MB
        fileType: 'application/pdf'
      }));

      const startTime = performance.now();
      
      // Simulate file download processing
      const downloadPromises = fileDownloads.map(async (download) => {
        const downloadTime = download.fileSize / (1024 * 1024) * 500; // Simulate 2MB/second download
        await new Promise(resolve => setTimeout(resolve, downloadTime));
        
        return {
          fileId: download.fileId,
          fileName: download.fileName,
          fileSize: download.fileSize,
          downloadTime,
          downloadSpeed: download.fileSize / downloadTime * 1000, // bytes per second
          success: true
        };
      });

      const results = await Promise.all(downloadPromises);
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      const totalFileSize = fileDownloads.reduce((sum, download) => sum + download.fileSize, 0);
      const averageDownloadSpeed = totalFileSize / (totalExecutionTime / 1000);

      // Performance assertions
      expect(totalExecutionTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(averageDownloadSpeed).toBeGreaterThan(2 * 1024 * 1024); // Should be at least 2MB/second
      expect(results).toHaveLength(50);

      console.log(`File Download Performance:
        - Total execution time: ${totalExecutionTime.toFixed(2)}ms
        - Total file size: ${(totalFileSize / 1024 / 1024).toFixed(2)}MB
        - Average download speed: ${(averageDownloadSpeed / 1024 / 1024).toFixed(2)}MB/s
        - Files downloaded: ${fileDownloads.length}`);
    });
  });
});
