/**
 * Conflict Resolution Service Tests
 * 
 * Comprehensive unit tests for conflict detection and resolution functionality
 */

import { conflictResolutionService } from '../../src/services/conflict-resolution.service';
import { getSupabaseClient } from '../../src/config/database';
import { timeSlotService } from '../../src/services/time-slot.service';
import { reservationStateMachine } from '../../src/services/reservation-state-machine.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/time-slot.service');
jest.mock('../../src/services/reservation-state-machine.service');
jest.mock('../../src/utils/logger');

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  map: jest.fn().mockReturnThis(),
  reduce: jest.fn().mockReturnThis()
};

const mockTimeSlotService = {
  getAvailableTimeSlots: jest.fn()
};

const mockReservationStateMachine = {
  transition: jest.fn()
};

describe('ConflictResolutionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    (timeSlotService as any) = mockTimeSlotService;
    (reservationStateMachine as any) = mockReservationStateMachine;
  });

  describe('detectConflicts', () => {
    it('should detect time overlaps correctly', async () => {
      // Mock reservations with time overlaps
      const mockReservations = [
        {
          id: 'res1',
          shop_id: 'shop1',
          reservation_date: '2024-01-15',
          reservation_time: '10:00:00',
          status: 'confirmed'
        },
        {
          id: 'res2',
          shop_id: 'shop1',
          reservation_date: '2024-01-15',
          reservation_time: '10:30:00',
          status: 'confirmed'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  then: jest.fn().mockResolvedValue({ data: mockReservations, error: null })
                })
              })
            })
          })
        })
      });

      const result = await conflictResolutionService.detectConflicts('shop1');

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].type).toBe('time_overlap');
      expect(result.severity).toBe('high');
    });

    it('should return no conflicts when none exist', async () => {
      const mockReservations = [
        {
          id: 'res1',
          shop_id: 'shop1',
          reservation_date: '2024-01-15',
          reservation_time: '10:00:00',
          status: 'confirmed'
        },
        {
          id: 'res2',
          shop_id: 'shop1',
          reservation_date: '2024-01-15',
          reservation_time: '11:30:00',
          status: 'confirmed'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  then: jest.fn().mockResolvedValue({ data: mockReservations, error: null })
                })
              })
            })
          })
        })
      });

      const result = await conflictResolutionService.detectConflicts('shop1');

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts.length).toBe(0);
      expect(result.severity).toBe('low');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  then: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
                })
              })
            })
          })
        })
      });

      await expect(conflictResolutionService.detectConflicts('shop1')).rejects.toThrow();
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict successfully', async () => {
      const mockConflict = {
        id: 'conflict1',
        type: 'time_overlap',
        severity: 'high',
        description: 'Time overlap detected',
        affectedReservations: ['res1', 'res2'],
        shopId: 'shop1',
        detectedAt: new Date().toISOString()
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockConflict, error: null })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        })
      });

      const request = {
        conflictId: 'conflict1',
        resolutionMethod: 'automatic_reschedule' as const,
        resolvedBy: 'user1',
        resolvedByRole: 'admin' as const,
        affectedReservations: [
          { reservationId: 'res1', action: 'reschedule' as const },
          { reservationId: 'res2', action: 'reschedule' as const }
        ]
      };

      const result = await conflictResolutionService.resolveConflict(request);

      expect(result.success).toBe(true);
      expect(result.conflictId).toBe('conflict1');
      expect(result.resolutionMethod).toBe('automatic_reschedule');
    });

    it('should handle non-existent conflict', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const request = {
        conflictId: 'nonexistent',
        resolutionMethod: 'automatic_reschedule' as const,
        resolvedBy: 'user1',
        resolvedByRole: 'admin' as const,
        affectedReservations: []
      };

      const result = await conflictResolutionService.resolveConflict(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Conflict not found');
    });
  });

  describe('calculatePriorityScores', () => {
    it('should calculate priority scores correctly', async () => {
      const mockReservation = {
        id: 'res1',
        user_id: 'user1',
        shop_id: 'shop1',
        reservation_date: '2024-01-15',
        reservation_time: '10:00:00',
        total_amount: 50000,
        status: 'confirmed'
      };

      const mockUser = {
        id: 'user1',
        user_role: 'admin',
        total_points: 25000
      };

      const mockPayment = {
        id: 'payment1',
        payment_status: 'fully_paid',
        amount: 50000
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn()
              .mockResolvedValueOnce({ data: mockReservation, error: null })
              .mockResolvedValueOnce({ data: mockUser, error: null })
              .mockResolvedValueOnce({ data: mockPayment, error: null })
          })
        })
      });

      const scores = await conflictResolutionService.calculatePriorityScores(['res1']);

      expect(scores.length).toBe(1);
      expect(scores[0].reservationId).toBe('res1');
      expect(scores[0].totalScore).toBeGreaterThan(0);
      expect(scores[0].factors.customerTier).toBe(100); // admin tier
      expect(scores[0].factors.paymentStatus).toBe(100); // fully_paid
    });

    it('should handle missing data gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const scores = await conflictResolutionService.calculatePriorityScores(['nonexistent']);

      expect(scores.length).toBe(0);
    });
  });

  describe('getConflictHistory', () => {
    it('should return conflict history for a shop', async () => {
      const mockConflicts = [
        {
          id: 'conflict1',
          type: 'time_overlap',
          severity: 'high',
          description: 'Time overlap detected',
          affected_reservations: ['res1', 'res2'],
          shop_id: 'shop1',
          detected_at: new Date().toISOString(),
          resolved_at: new Date().toISOString()
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockConflicts, error: null })
              })
            })
          })
        })
      });

      const history = await conflictResolutionService.getConflictHistory('shop1');

      expect(history.length).toBe(1);
      expect(history[0].id).toBe('conflict1');
      expect(history[0].type).toBe('time_overlap');
    });

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
              })
            })
          })
        })
      });

      const history = await conflictResolutionService.getConflictHistory('shop1');

      expect(history.length).toBe(0);
    });
  });

  describe('getConflictStats', () => {
    it('should calculate conflict statistics correctly', async () => {
      const mockConflicts = [
        {
          id: 'conflict1',
          type: 'time_overlap',
          severity: 'high',
          resolved_at: new Date().toISOString(),
          compensation: { amount: 10000 }
        },
        {
          id: 'conflict2',
          type: 'resource_shortage',
          severity: 'medium',
          resolved_at: null,
          compensation: null
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: mockConflicts, error: null })
            })
          })
        })
      });

      const stats = await conflictResolutionService.getConflictStats('shop1', '2024-01-01', '2024-01-31');

      expect(stats.totalConflicts).toBe(2);
      expect(stats.resolvedConflicts).toBe(1);
      expect(stats.unresolvedConflicts).toBe(1);
      expect(stats.totalCompensationAmount).toBe(10000);
    });

    it('should handle empty conflict list', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      });

      const stats = await conflictResolutionService.getConflictStats('shop1', '2024-01-01', '2024-01-31');

      expect(stats.totalConflicts).toBe(0);
      expect(stats.resolvedConflicts).toBe(0);
      expect(stats.unresolvedConflicts).toBe(0);
      expect(stats.totalCompensationAmount).toBe(0);
    });
  });

  describe('Priority Score Calculation', () => {
    it('should calculate booking time score correctly', () => {
      const service = conflictResolutionService as any;
      
      // Test different time ranges
      expect(service.calculateBookingTimeScore(25)).toBe(100); // 24h+
      expect(service.calculateBookingTimeScore(18)).toBe(80);  // 12-24h
      expect(service.calculateBookingTimeScore(8)).toBe(60);   // 6-12h
      expect(service.calculateBookingTimeScore(4)).toBe(40);   // 2-6h
      expect(service.calculateBookingTimeScore(1)).toBe(20);   // 0-2h
    });

    it('should calculate service value score correctly', () => {
      const service = conflictResolutionService as any;
      
      expect(service.calculateServiceValueScore(120000)).toBe(100); // 100k+
      expect(service.calculateServiceValueScore(75000)).toBe(80);   // 50k+
      expect(service.calculateServiceValueScore(30000)).toBe(60);   // 20k+
      expect(service.calculateServiceValueScore(15000)).toBe(40);   // 10k+
      expect(service.calculateServiceValueScore(5000)).toBe(20);    // <10k
    });

    it('should calculate loyalty score correctly', () => {
      const service = conflictResolutionService as any;
      
      expect(service.calculateLoyaltyScore(60000)).toBe(100);
      expect(service.calculateLoyaltyScore(25000)).toBe(80);
      expect(service.calculateLoyaltyScore(15000)).toBe(60);
      expect(service.calculateLoyaltyScore(7500)).toBe(40);
      expect(service.calculateLoyaltyScore(2000)).toBe(20);
    });
  });

  describe('Conflict Severity Calculation', () => {
    it('should calculate overall severity correctly', () => {
      const service = conflictResolutionService as any;
      
      const conflicts = [
        { severity: 'low' },
        { severity: 'medium' },
        { severity: 'high' }
      ];

      const severity = service.calculateOverallSeverity(conflicts);
      expect(severity).toBe('medium');
    });

    it('should return low severity for empty conflicts', () => {
      const service = conflictResolutionService as any;
      
      const severity = service.calculateOverallSeverity([]);
      expect(severity).toBe('low');
    });

    it('should return critical severity for high average', () => {
      const service = conflictResolutionService as any;
      
      const conflicts = [
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'high' }
      ];

      const severity = service.calculateOverallSeverity(conflicts);
      expect(severity).toBe('critical');
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate recommendations for critical conflicts', () => {
      const service = conflictResolutionService as any;
      
      const conflicts = [
        { type: 'time_overlap', severity: 'critical' },
        { type: 'resource_shortage', severity: 'high' }
      ];

      const recommendations = service.generateRecommendations(conflicts, 'critical');
      
      expect(recommendations).toContain('Immediate action required. Consider manual intervention.');
      expect(recommendations).toContain('Found 1 time overlap conflicts. Consider rescheduling.');
      expect(recommendations).toContain('Found 1 resource conflicts. Check staff availability.');
    });

    it('should generate recommendations for no conflicts', () => {
      const service = conflictResolutionService as any;
      
      const recommendations = service.generateRecommendations([], 'low');
      
      expect(recommendations).toContain('No conflicts detected. System is running smoothly.');
    });
  });
}); 