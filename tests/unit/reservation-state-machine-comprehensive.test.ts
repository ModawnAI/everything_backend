/**
 * Comprehensive Reservation State Machine Unit Tests
 * 
 * Enhanced unit tests for the reservation state machine service covering:
 * - State transition validation with business rules
 * - Automatic state progression based on time and events
 * - State change audit logging with timestamps and reasons
 * - Rollback mechanisms for invalid state transitions
 * - Business rule enforcement for each transition
 * - Edge cases and boundary conditions
 */

import { ReservationStateMachine, StateTransition, StateChangeLog } from '../../src/services/reservation-state-machine.service';
import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';
import { ReservationStatus, Reservation } from '../../src/types/database.types';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

describe('Reservation State Machine - Comprehensive Tests', () => {
  let stateMachine: ReservationStateMachine;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup service
    stateMachine = new ReservationStateMachine();
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

    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('State Transition Validation', () => {
    it('should validate valid transitions', async () => {
      const validTransitions = [
        { from: 'requested', to: 'confirmed', changedBy: 'shop' },
        { from: 'confirmed', to: 'completed', changedBy: 'shop' },
        { from: 'requested', to: 'cancelled_by_user', changedBy: 'user' },
        { from: 'confirmed', to: 'cancelled_by_shop', changedBy: 'shop' },
        { from: 'confirmed', to: 'no_show', changedBy: 'system' }
      ];

      for (const transition of validTransitions) {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'reservation-123', status: transition.from },
                error: null
              })
            })
          })
        });

        const result = await stateMachine.validateTransition(
          'reservation-123',
          transition.from as ReservationStatus,
          transition.to as ReservationStatus,
          transition.changedBy as 'user' | 'shop' | 'system' | 'admin',
          'user-123'
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject invalid transitions', async () => {
      const invalidTransitions = [
        { from: 'completed', to: 'confirmed', changedBy: 'user' },
        { from: 'cancelled_by_user', to: 'confirmed', changedBy: 'shop' },
        { from: 'no_show', to: 'confirmed', changedBy: 'user' },
        { from: 'requested', to: 'completed', changedBy: 'user' }
      ];

      for (const transition of invalidTransitions) {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'reservation-123', status: transition.from },
                error: null
              })
            })
          })
        });

        const result = await stateMachine.validateTransition(
          'reservation-123',
          transition.from as ReservationStatus,
          transition.to as ReservationStatus,
          transition.changedBy as 'user' | 'shop' | 'admin',
          'user-123'
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should enforce business rules for transitions', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { 
                id: 'reservation-123', 
                status: 'confirmed',
                reservation_date: '2024-03-15',
                start_time: '10:00',
                payment_status: 'pending'
              },
              error: null
            })
          })
        })
      });

      const result = await stateMachine.validateTransition(
        'reservation-123',
        'confirmed',
        'completed',
        'shop',
        'shop-123'
      );

      expect(result.businessRules).toContain('Payment must be completed before marking as completed');
    });

    it('should validate time-based transitions', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateStr = pastDate.toISOString().split('T')[0];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { 
                id: 'reservation-123', 
                status: 'confirmed',
                reservation_date: pastDateStr,
                start_time: '10:00'
              },
              error: null
            })
          })
        })
      });

      const result = await stateMachine.validateTransition(
        'reservation-123',
        'confirmed',
        'completed',
        'system',
        'system'
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('State Transition Execution', () => {
    it('should execute valid transitions successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'reservation-123', status: 'requested' },
              error: null
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-123', 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const result = await stateMachine.executeTransition(
        'reservation-123',
        'confirmed',
        'shop',
        'shop-123',
        'Customer confirmed appointment'
      );

      expect(result.success).toBe(true);
      expect(result.reservation?.status).toBe('confirmed');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle transition failures gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'reservation-123', status: 'requested' },
              error: null
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Invalid transition' }
      });

      const result = await stateMachine.executeTransition(
        'reservation-123',
        'invalid_status',
        'shop',
        'shop-123'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid transition');
    });

    it('should log state changes with audit trail', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'reservation-123', status: 'requested' },
              error: null
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-123', 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      await stateMachine.executeTransition(
        'reservation-123',
        'confirmed',
        'shop',
        'shop-123',
        'Customer confirmed appointment',
        { source: 'mobile_app', ip_address: '192.168.1.1' }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Reservation state transition executed',
        expect.objectContaining({
          reservationId: 'reservation-123',
          fromStatus: 'requested',
          toStatus: 'confirmed',
          changedBy: 'shop',
          changedById: 'shop-123'
        })
      );
    });
  });

  describe('Automatic State Progression', () => {
    it('should automatically transition confirmed to no_show after time threshold', async () => {
      const pastTime = new Date();
      pastTime.setMinutes(pastTime.getMinutes() - 30); // 30 minutes ago
      const pastTimeStr = pastTime.toISOString().substring(11, 16);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [{
                    id: 'reservation-123',
                    status: 'confirmed',
                    reservation_date: new Date().toISOString().split('T')[0],
                    start_time: pastTimeStr
                  }],
                  error: null
                })
              })
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-123', 
          status: 'no_show',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const result = await stateMachine.processAutomaticTransitions();

      expect(result.processedCount).toBe(1);
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].toStatus).toBe('no_show');
    });

    it('should batch process multiple automatic transitions', async () => {
      const pastTime = new Date();
      pastTime.setMinutes(pastTime.getMinutes() - 30);
      const pastTimeStr = pastTime.toISOString().substring(11, 16);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'reservation-1',
                      status: 'confirmed',
                      reservation_date: new Date().toISOString().split('T')[0],
                      start_time: pastTimeStr
                    },
                    {
                      id: 'reservation-2',
                      status: 'confirmed',
                      reservation_date: new Date().toISOString().split('T')[0],
                      start_time: pastTimeStr
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-1', 
          status: 'no_show',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const result = await stateMachine.processAutomaticTransitions();

      expect(result.processedCount).toBe(2);
    });
  });

  describe('Business Rule Enforcement', () => {
    it('should enforce payment requirements for completion', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { 
                id: 'reservation-123', 
                status: 'confirmed',
                payment_status: 'pending',
                total_amount: 50000,
                paid_amount: 0
              },
              error: null
            })
          })
        })
      });

      const result = await stateMachine.validateTransition(
        'reservation-123',
        'confirmed',
        'completed',
        'shop',
        'shop-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payment must be completed before marking as completed');
    });

    it('should enforce cancellation time limits', async () => {
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 1); // 1 hour from now
      const futureTimeStr = futureTime.toISOString().substring(11, 16);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { 
                id: 'reservation-123', 
                status: 'confirmed',
                reservation_date: new Date().toISOString().split('T')[0],
                start_time: futureTimeStr
              },
              error: null
            })
          })
        })
      });

      const result = await stateMachine.validateTransition(
        'reservation-123',
        'confirmed',
        'cancelled_by_user',
        'user',
        'user-123'
      );

      expect(result.isValid).toBe(true); // Should allow cancellation with 1 hour notice
    });

    it('should enforce minimum advance booking time', async () => {
      const nearTime = new Date();
      nearTime.setMinutes(nearTime.getMinutes() + 30); // 30 minutes from now
      const nearTimeStr = nearTime.toISOString().substring(11, 16);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { 
                id: 'reservation-123', 
                status: 'requested',
                reservation_date: new Date().toISOString().split('T')[0],
                start_time: nearTimeStr
              },
              error: null
            })
          })
        })
      });

      const result = await stateMachine.validateTransition(
        'reservation-123',
        'requested',
        'confirmed',
        'shop',
        'shop-123'
      );

      expect(result.warnings).toContain('Reservation is less than 2 hours away');
    });
  });

  describe('State History and Audit Logging', () => {
    it('should retrieve state change history', async () => {
      const mockHistory = [
        {
          id: 'log-1',
          reservation_id: 'reservation-123',
          from_status: 'requested',
          to_status: 'confirmed',
          changed_by: 'shop',
          changed_by_id: 'shop-123',
          reason: 'Customer confirmed',
          created_at: new Date().toISOString()
        },
        {
          id: 'log-2',
          reservation_id: 'reservation-123',
          from_status: 'confirmed',
          to_status: 'completed',
          changed_by: 'shop',
          changed_by_id: 'shop-123',
          reason: 'Service completed',
          created_at: new Date().toISOString()
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockHistory,
              error: null
            })
          })
        })
      });

      const history = await stateMachine.getStateChangeHistory('reservation-123');

      expect(history).toHaveLength(2);
      expect(history[0].fromStatus).toBe('requested');
      expect(history[1].toStatus).toBe('completed');
    });

    it('should handle empty state history', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      const history = await stateMachine.getStateChangeHistory('reservation-123');

      expect(history).toHaveLength(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Database connection failed'))
          })
        })
      });

      const result = await stateMachine.validateTransition(
        'reservation-123',
        'requested',
        'confirmed',
        'shop',
        'shop-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Database connection failed');
    });

    it('should handle invalid reservation IDs', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await stateMachine.executeTransition(
        'invalid-reservation-id',
        'confirmed',
        'shop',
        'shop-123'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reservation not found');
    });

    it('should handle concurrent state changes', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'reservation-123', status: 'confirmed' }, // Status changed by another process
              error: null
            })
          })
        })
      });

      const result = await stateMachine.executeTransition(
        'reservation-123',
        'confirmed',
        'completed',
        'shop',
        'shop-123'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reservation state has changed');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle batch state transitions efficiently', async () => {
      const reservations = Array(100).fill(0).map((_, index) => ({
        id: `reservation-${index}`,
        status: 'confirmed' as ReservationStatus
      }));

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'reservation-0', status: 'confirmed' },
              error: null
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-0', status: 'completed' },
        error: null
      });

      const startTime = performance.now();
      
      const results = await Promise.allSettled(
        reservations.map(reservation => 
          stateMachine.executeTransition(
            reservation.id,
            'completed',
            'shop',
            'shop-123'
          )
        )
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle high-frequency state changes', async () => {
      const stateChanges = [
        { from: 'requested', to: 'confirmed' },
        { from: 'confirmed', to: 'completed' },
        { from: 'completed', to: 'confirmed' }, // Invalid - should fail
        { from: 'requested', to: 'cancelled_by_user' }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'reservation-123', status: 'requested' },
              error: null
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'confirmed' },
        error: null
      });

      const results = await Promise.allSettled(
        stateChanges.map(change => 
          stateMachine.executeTransition(
            'reservation-123',
            change.to as ReservationStatus,
            'shop',
            'shop-123'
          )
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with External Systems', () => {
    it('should trigger notifications on state changes', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'reservation-123', status: 'requested' },
              error: null
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-123', 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      await stateMachine.executeTransition(
        'reservation-123',
        'confirmed',
        'shop',
        'shop-123',
        'Customer confirmed appointment'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('State change notification triggered')
      );
    });

    it('should handle notification failures gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'reservation-123', status: 'requested' },
              error: null
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-123', 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      // Mock notification service failure
      mockLogger.info.mockImplementation(() => {
        throw new Error('Notification service unavailable');
      });

      const result = await stateMachine.executeTransition(
        'reservation-123',
        'confirmed',
        'shop',
        'shop-123'
      );

      expect(result.success).toBe(true); // State change should succeed even if notification fails
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to trigger notification')
      );
    });
  });
});
