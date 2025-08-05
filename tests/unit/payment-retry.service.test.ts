/**
 * Payment Retry Service Tests
 * 
 * Comprehensive unit tests for payment retry functionality including:
 * - Retry queue creation and management
 * - Retry attempt processing and scheduling
 * - Analytics and reporting
 * - Manual retry capabilities
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { paymentRetryService } from '../../src/services/payment-retry.service';
import { tossPaymentsService } from '../../src/services/toss-payments.service';
import { paymentConfirmationService } from '../../src/services/payment-confirmation.service';
import { getSupabaseClient } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/toss-payments.service');
jest.mock('../../src/services/payment-confirmation.service');
jest.mock('../../src/utils/logger');

const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn()
};

(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

describe('PaymentRetryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRetryQueueItem', () => {
    const validRequest = {
      paymentId: 'payment-123',
      retryType: 'payment_confirmation' as const,
      failureReason: 'Network timeout',
      failureCode: 'NETWORK_ERROR',
      metadata: { source: 'webhook' }
    };

    it('should create a retry queue item successfully', async () => {
      // Mock database function response
      mockSupabase.rpc.mockResolvedValue({
        data: 'retry-queue-123',
        error: null
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await paymentRetryService.createRetryQueueItem(validRequest);

      expect(result).toBe('retry-queue-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_payment_retry_queue_item', {
        p_payment_id: validRequest.paymentId,
        p_retry_type: validRequest.retryType,
        p_failure_reason: validRequest.failureReason,
        p_failure_code: validRequest.failureCode
      });
    });

    it('should handle database function errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(paymentRetryService.createRetryQueueItem(validRequest))
        .rejects
        .toThrow('Failed to create retry queue item: Database error');
    });
  });

  describe('processRetryAttempts', () => {
    it('should process retry attempts successfully', async () => {
      const mockRetryItems = [
        {
          id: 'retry-1',
          payment_id: 'payment-123',
          retry_type: 'payment_confirmation',
          attempt_number: 1,
          max_attempts: 3
        }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: mockRetryItems,
                  error: null
                })
              })
            })
          })
        })
      });

      // Mock getRetryQueueItem
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockRetryItems[0],
              error: null
            })
          })
        })
      });

      // Mock updateRetryStatus
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      // Mock recordRetryAttemptStart
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'history-1' },
              error: null
            })
          })
        })
      });

      // Mock recordRetryAttemptResult
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      // Mock updateRetryStatus for completion
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      // Mock updateRetrySuccessCount
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { success_count: 0 },
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      // Mock sendRetrySuccessNotification
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await paymentRetryService.processRetryAttempts();

      expect(result).toEqual({
        processed: 1,
        successful: 1,
        failed: 0
      });
    });

    it('should handle no retry items to process', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      });

      const result = await paymentRetryService.processRetryAttempts();

      expect(result).toEqual({
        processed: 0,
        successful: 0,
        failed: 0
      });
    });
  });

  describe('getUserRetryQueue', () => {
    const userId = 'user-123';

    it('should return user retry queue successfully', async () => {
      const mockRetryItems = [
        {
          id: 'retry-1',
          payment_id: 'payment-123',
          retry_type: 'payment_confirmation',
          retry_status: 'pending',
          attempt_number: 1,
          max_attempts: 3,
          next_retry_at: new Date().toISOString(),
          retry_count: 0,
          success_count: 0,
          created_at: new Date().toISOString()
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockRetryItems,
                error: null
              })
            })
          })
        })
      });

      const result = await paymentRetryService.getUserRetryQueue(userId);

      expect(result).toEqual(mockRetryItems);
    });

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
              })
            })
          })
        })
      });

      await expect(paymentRetryService.getUserRetryQueue(userId))
        .rejects
        .toThrow('Failed to get user retry queue: Database error');
    });
  });

  describe('getRetryHistory', () => {
    const retryQueueId = 'retry-queue-123';

    it('should return retry history successfully', async () => {
      const mockHistoryItems = [
        {
          id: 'history-1',
          retry_queue_id: retryQueueId,
          payment_id: 'payment-123',
          attempt_number: 1,
          retry_status: 'success',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          processing_time: 1000,
          created_at: new Date().toISOString()
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockHistoryItems,
              error: null
            })
          })
        })
      });

      const result = await paymentRetryService.getRetryHistory(retryQueueId);

      expect(result).toEqual(mockHistoryItems);
    });
  });

  describe('getRetryAnalytics', () => {
    const timeRange = {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-31T23:59:59Z'
    };

    it('should return retry analytics successfully', async () => {
      const mockOverallStats = [
        { retry_status: 'success', processing_time: 1000 },
        { retry_status: 'failed', processing_time: 2000 },
        { retry_status: 'success', processing_time: 1500 }
      ];

      const mockTypeBreakdown = [
        { retry_status: 'success', payment_retry_queue: { retry_type: 'payment_confirmation' } },
        { retry_status: 'failed', payment_retry_queue: { retry_type: 'payment_confirmation' } },
        { retry_status: 'success', payment_retry_queue: { retry_type: 'webhook_delivery' } }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({
              data: mockOverallStats,
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({
              data: mockTypeBreakdown,
              error: null
            })
          })
        })
      });

      const result = await paymentRetryService.getRetryAnalytics(timeRange);

      expect(result).toEqual({
        totalRetries: 3,
        successfulRetries: 2,
        failedRetries: 1,
        successRate: 66.66666666666666,
        averageProcessingTime: 1500,
        retryTypeBreakdown: {
          payment_confirmation: { total: 2, successful: 1, failed: 1, successRate: 50 },
          webhook_delivery: { total: 1, successful: 1, failed: 0, successRate: 100 },
          refund_processing: { total: 0, successful: 0, failed: 0, successRate: 0 },
          split_payment: { total: 0, successful: 0, failed: 0, successRate: 0 }
        }
      });
    });
  });

  describe('manualRetry', () => {
    const retryQueueId = 'retry-queue-123';
    const adminId = 'admin-123';

    it('should perform manual retry successfully', async () => {
      // Mock admin user
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: adminId, user_role: 'admin' },
              error: null
            })
          })
        })
      });

      // Mock getRetryQueueItem
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: retryQueueId,
                retry_status: 'failed',
                attempt_number: 3,
                max_attempts: 3
              },
              error: null
            })
          })
        })
      });

      // Mock update retry status
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      // Mock processRetryAttempt (simplified for test)
      jest.spyOn(paymentRetryService as any, 'processRetryAttempt').mockResolvedValue(true);

      const result = await paymentRetryService.manualRetry(retryQueueId, adminId);

      expect(result).toBe(true);
    });

    it('should throw error for non-admin user', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: adminId, user_role: 'user' },
              error: null
            })
          })
        })
      });

      await expect(paymentRetryService.manualRetry(retryQueueId, adminId))
        .rejects
        .toThrow('Unauthorized: Admin access required');
    });

    it('should throw error for invalid retry status', async () => {
      // Mock admin user
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: adminId, user_role: 'admin' },
              error: null
            })
          })
        })
      });

      // Mock getRetryQueueItem with invalid status
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: retryQueueId,
                retry_status: 'completed',
                attempt_number: 1,
                max_attempts: 3
              },
              error: null
            })
          })
        })
      });

      await expect(paymentRetryService.manualRetry(retryQueueId, adminId))
        .rejects
        .toThrow('Retry cannot be manually retried in current status: completed');
    });
  });

  describe('calculateNextRetryDelay', () => {
    it('should calculate retry delay with exponential backoff', () => {
      const calculateDelay = (paymentRetryService as any).calculateNextRetryDelay;
      
      const delay1 = calculateDelay(1, 300, 3600, 2.0);
      const delay2 = calculateDelay(2, 300, 3600, 2.0);
      const delay3 = calculateDelay(3, 300, 3600, 2.0);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay3).toBeLessThanOrEqual(3600); // Max delay
    });

    it('should respect maximum delay limit', () => {
      const calculateDelay = (paymentRetryService as any).calculateNextRetryDelay;
      
      const delay = calculateDelay(10, 300, 3600, 2.0);
      
      expect(delay).toBeLessThanOrEqual(3600);
    });
  });
}); 