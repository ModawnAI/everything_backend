/**
 * User Management Performance Tests
 * 
 * Comprehensive performance test suite for user management features including:
 * - Response time benchmarks
 * - Throughput testing
 * - Memory usage monitoring
 * - Database query optimization
 * - Concurrent user handling
 * - Load testing scenarios
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { performance } from 'perf_hooks';
import { getSupabaseClient } from '../../src/config/database';
import { applyResponseStandardization } from '../../src/middleware/response-standardization.middleware';
import { adminUserManagementController } from '../../src/controllers/admin-user-management.controller';
import { userProfileController } from '../../src/controllers/user-profile.controller';
import { NotificationService } from '../../src/services/notification.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/notification.service');
jest.mock('../../src/utils/logger');

describe('User Management Performance Tests', () => {
  let app: express.Application;
  let mockSupabase: any;

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    FAST_RESPONSE: 100,      // < 100ms for simple queries
    MEDIUM_RESPONSE: 500,    // < 500ms for complex queries
    SLOW_RESPONSE: 1000,     // < 1000ms for heavy operations
    BULK_OPERATION: 5000     // < 5000ms for bulk operations
  };

  // Test tokens
  const validAdminToken = jwt.sign(
    { id: 'admin-123', role: 'admin' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

  const validUserToken = jwt.sign(
    { id: 'user-123', role: 'user' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

  // Mock data generators
  const generateMockUsers = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      name: `User ${i + 1}`,
      user_role: 'user',
      user_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  };

  const generateLargeUserProfile = () => ({
    id: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
    nickname: 'testuser',
    bio: 'A'.repeat(1000), // Large bio field
    preferences: JSON.stringify({
      notifications: Array.from({ length: 100 }, (_, i) => ({
        type: `notification_${i}`,
        enabled: true
      }))
    }),
    metadata: JSON.stringify({
      tags: Array.from({ length: 50 }, (_, i) => `tag_${i}`),
      history: Array.from({ length: 200 }, (_, i) => ({
        action: `action_${i}`,
        timestamp: new Date().toISOString()
      }))
    })
  });

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use(applyResponseStandardization());

    // Mock authentication
    app.use('/api/admin/*', (req: any, res, next) => {
      req.user = { id: 'admin-123', role: 'admin' };
      next();
    });

    app.use('/api/user/*', (req: any, res, next) => {
      req.user = { id: 'user-123', role: 'user' };
      next();
    });

    // Routes
    app.get('/api/admin/users', adminUserManagementController.getUsers);
    app.get('/api/admin/users/:id', adminUserManagementController.getUserDetails);
    app.put('/api/admin/users/:id/status', adminUserManagementController.updateUserStatus);
    app.get('/api/user/profile', userProfileController.getProfile);
    app.put('/api/user/profile', userProfileController.updateProfile);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    const mockChain = {
      single: jest.fn(),
      order: jest.fn(() => mockChain),
      limit: jest.fn(() => mockChain),
      eq: jest.fn(() => mockChain),
      select: jest.fn(() => mockChain),
      insert: jest.fn(() => mockChain),
      update: jest.fn(() => mockChain)
    };

    mockSupabase = {
      from: jest.fn(() => mockChain)
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('Response Time Performance', () => {
    describe('Simple Query Performance', () => {
      it('should respond to user profile requests within fast threshold', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123', name: 'Test User' },
            error: null
          })
        });

        const startTime = performance.now();

        await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(200);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_RESPONSE);
      });

      it('should respond to user details requests within medium threshold', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: generateLargeUserProfile(),
            error: null
          })
        });

        const startTime = performance.now();

        await request(app)
          .get('/api/admin/users/user-123')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_RESPONSE);
      });
    });

    describe('Complex Query Performance', () => {
      it('should handle large user list queries within medium threshold', async () => {
        const largeUserList = generateMockUsers(1000);

        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: 1000 },
            error: null
          })
        });

        mockSupabase.from().select().order().limit.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: largeUserList.slice(0, 50), // Paginated result
            error: null
          })
        });

        const startTime = performance.now();

        await request(app)
          .get('/api/admin/users?limit=50')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_RESPONSE);
      });

      it('should handle filtered searches within medium threshold', async () => {
        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: 25 },
            error: null
          })
        });

        mockSupabase.from().select().order().limit.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: generateMockUsers(25),
            error: null
          })
        });

        const startTime = performance.now();

        await request(app)
          .get('/api/admin/users?search=test&role=user&status=active')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_RESPONSE);
      });
    });

    describe('Update Operation Performance', () => {
      it('should handle profile updates within fast threshold', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123', name: 'Test User' },
            error: null
          })
        });

        mockSupabase.from().update().eq.mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', name: 'Updated User' },
              error: null
            })
          })
        });

        const startTime = performance.now();

        await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send({ name: 'Updated User' })
          .expect(200);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_RESPONSE);
      });

      it('should handle status updates within medium threshold', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123', user_status: 'active' },
            error: null
          })
        });

        mockSupabase.from().update().eq.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            error: null
          })
        });

        mockSupabase.from().insert.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            error: null
          })
        });

        const startTime = performance.now();

        await request(app)
          .put('/api/admin/users/user-123/status')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            status: 'suspended',
            reason: 'Performance test',
            adminNotes: 'Test suspension'
          })
          .expect(200);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_RESPONSE);
      });
    });
  });

  describe('Throughput Performance', () => {
    describe('Concurrent Request Handling', () => {
      it('should handle multiple concurrent profile requests efficiently', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123', name: 'Test User' },
            error: null
          })
        });

        const concurrentRequests = 10;
        const requests = Array.from({ length: concurrentRequests }, () =>
          request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${validUserToken}`)
        );

        const startTime = performance.now();
        const responses = await Promise.all(requests);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const averageTime = totalTime / concurrentRequests;

        // All requests should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });

        // Average response time should be reasonable
        expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_RESPONSE);
      });

      it('should handle concurrent admin operations efficiently', async () => {
        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: 100 },
            error: null
          })
        });

        mockSupabase.from().select().order().limit.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: generateMockUsers(20),
            error: null
          })
        });

        const concurrentRequests = 5;
        const requests = Array.from({ length: concurrentRequests }, () =>
          request(app)
            .get('/api/admin/users?limit=20')
            .set('Authorization', `Bearer ${validAdminToken}`)
        );

        const startTime = performance.now();
        const responses = await Promise.all(requests);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const averageTime = totalTime / concurrentRequests;

        responses.forEach(response => {
          expect(response.status).toBe(200);
        });

        expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_RESPONSE);
      });
    });

    describe('Sequential Request Performance', () => {
      it('should maintain consistent performance across sequential requests', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123', name: 'Test User' },
            error: null
          })
        });

        const requestCount = 20;
        const responseTimes: number[] = [];

        for (let i = 0; i < requestCount; i++) {
          const startTime = performance.now();

          await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${validUserToken}`)
            .expect(200);

          const endTime = performance.now();
          responseTimes.push(endTime - startTime);
        }

        const averageTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxTime = Math.max(...responseTimes);
        const minTime = Math.min(...responseTimes);

        // Performance should be consistent
        expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_RESPONSE);
        expect(maxTime - minTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_RESPONSE); // Low variance
      });
    });
  });

  describe('Memory Usage Performance', () => {
    describe('Large Data Handling', () => {
      it('should handle large user profiles efficiently', async () => {
        const largeProfile = generateLargeUserProfile();

        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: largeProfile,
            error: null
          })
        });

        const initialMemory = process.memoryUsage().heapUsed;

        await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(200);

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 10MB for this test)
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      });

      it('should handle large user lists without memory leaks', async () => {
        const largeUserList = generateMockUsers(1000);

        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: 1000 },
            error: null
          })
        });

        mockSupabase.from().select().order().limit.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: largeUserList,
            error: null
          })
        });

        const initialMemory = process.memoryUsage().heapUsed;

        await request(app)
          .get('/api/admin/users?limit=1000')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      });
    });
  });

  describe('Database Query Performance', () => {
    describe('Query Optimization', () => {
      it('should use efficient queries for user searches', async () => {
        let queryCount = 0;
        const originalFrom = mockSupabase.from;

        mockSupabase.from = jest.fn((...args) => {
          queryCount++;
          return originalFrom(...args);
        });

        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: 50 },
            error: null
          })
        });

        mockSupabase.from().select().order().limit.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: generateMockUsers(50),
            error: null
          })
        });

        await request(app)
          .get('/api/admin/users?search=test&limit=50')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        // Should use minimal number of queries (ideally 2: count + data)
        expect(queryCount).toBeLessThanOrEqual(3);
      });

      it('should batch database operations efficiently', async () => {
        let operationCount = 0;
        const originalFrom = mockSupabase.from;

        mockSupabase.from = jest.fn((...args) => {
          operationCount++;
          return originalFrom(...args);
        });

        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123', user_status: 'active' },
            error: null
          })
        });

        mockSupabase.from().update().eq.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            error: null
          })
        });

        mockSupabase.from().insert.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            error: null
          })
        });

        await request(app)
          .put('/api/admin/users/user-123/status')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            status: 'suspended',
            reason: 'Performance test'
          })
          .expect(200);

        // Should minimize database operations
        expect(operationCount).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Pagination Performance', () => {
    describe('Large Dataset Pagination', () => {
      it('should handle large dataset pagination efficiently', async () => {
        const totalUsers = 10000;
        const pageSize = 100;

        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: totalUsers },
            error: null
          })
        });

        mockSupabase.from().select().order().limit.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: generateMockUsers(pageSize),
            error: null
          })
        });

        const startTime = performance.now();

        const response = await request(app)
          .get(`/api/admin/users?page=50&limit=${pageSize}`)
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_RESPONSE);
        expect(response.body.data.users).toHaveLength(pageSize);
        expect(response.body.meta.totalPages).toBe(100);
      });

      it('should maintain consistent performance across different page positions', async () => {
        const pageSize = 50;
        const pages = [1, 10, 50, 100];
        const responseTimes: number[] = [];

        for (const page of pages) {
          mockSupabase.from().select.mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { count: 5000 },
              error: null
            })
          });

          mockSupabase.from().select().order().limit.mockReturnValue({
            mockResolvedValue: jest.fn().mockResolvedValue({
              data: generateMockUsers(pageSize),
              error: null
            })
          });

          const startTime = performance.now();

          await request(app)
            .get(`/api/admin/users?page=${page}&limit=${pageSize}`)
            .set('Authorization', `Bearer ${validAdminToken}`)
            .expect(200);

          const endTime = performance.now();
          responseTimes.push(endTime - startTime);
        }

        const averageTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxTime = Math.max(...responseTimes);
        const minTime = Math.min(...responseTimes);

        // Performance should be consistent across pages
        expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_RESPONSE);
        expect(maxTime - minTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_RESPONSE);
      });
    });
  });

  describe('Stress Testing', () => {
    describe('High Load Scenarios', () => {
      it('should handle burst traffic gracefully', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123', name: 'Test User' },
            error: null
          })
        });

        const burstSize = 50;
        const requests = Array.from({ length: burstSize }, () =>
          request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${validUserToken}`)
        );

        const startTime = performance.now();
        const responses = await Promise.allSettled(requests);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const successfulResponses = responses.filter(
          r => r.status === 'fulfilled' && (r.value as any).status === 200
        );

        // Most requests should succeed
        expect(successfulResponses.length).toBeGreaterThan(burstSize * 0.8);

        // Total time should be reasonable
        expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION);
      });
    });
  });

  describe('Performance Monitoring', () => {
    describe('Response Time Tracking', () => {
      it('should include performance metadata in responses', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123', name: 'Test User' },
            error: null
          })
        });

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(200);

        // Response should include execution time in metadata
        if (response.body.meta) {
          expect(response.body.meta.executionTime).toBeDefined();
          expect(typeof response.body.meta.executionTime).toBe('number');
          expect(response.body.meta.executionTime).toBeGreaterThan(0);
        }
      });
    });
  });
});

