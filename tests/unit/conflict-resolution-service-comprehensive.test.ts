/**
 * Comprehensive Conflict Resolution Service Unit Tests
 *
 * Enhanced unit tests for the conflict resolution service covering:
 * - Conflict detection algorithms
 * - Resolution strategy selection
 * - Automatic conflict resolution
 * - Manual conflict resolution
 * - Priority-based resolution
 * - Performance optimization
 *
 * TODO: 이 테스트 파일은 실제 ConflictResolutionService 인터페이스와 일치하지 않습니다.
 * - selectResolutionStrategy, autoResolveConflict 등의 메서드가 실제 서비스에 없습니다.
 * - detectConflicts 반환 타입이 배열 대신 { hasConflicts, conflicts, severity } 객체입니다.
 * 실제 서비스 인터페이스에 맞게 테스트를 재작성해야 합니다.
 */

import { ConflictResolutionService } from '../../src/services/conflict-resolution.service';
import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/time-slot.service');

import { getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';
import { timeSlotService } from '../../src/services/time-slot.service';

// Skip: 테스트가 실제 ConflictResolutionService 인터페이스와 일치하지 않음
// selectResolutionStrategy, autoResolveConflict 메서드가 서비스에 없고,
// detectConflicts의 반환 타입도 일치하지 않습니다.
describe.skip('Conflict Resolution Service - Comprehensive Tests', () => {
  let conflictResolutionService: ConflictResolutionService;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockLogger: jest.Mocked<typeof logger>;
  let mockTimeSlotService: jest.Mocked<typeof timeSlotService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup service
    conflictResolutionService = new ConflictResolutionService();
    testUtils = new ReservationTestUtils();

    // Setup mocks
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                in: jest.fn(() => ({
                  or: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockLogger = logger as jest.Mocked<typeof logger>;
    mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;
  });

  describe('Conflict Detection', () => {
    it('should detect time overlap conflicts', async () => {
      const reservations = [
        {
          id: 'reservation-1',
          shop_id: 'shop-123',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed',
          user_id: 'user-1',
          created_at: new Date('2024-03-15T09:00:00Z').toISOString()
        },
        {
          id: 'reservation-2',
          shop_id: 'shop-123',
          start_time: '10:30',
          end_time: '11:45',
          status: 'requested',
          user_id: 'user-2',
          created_at: new Date('2024-03-15T09:30:00Z').toISOString()
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({
                    data: reservations,
                    error: null
                  })
                })
              })
            })
          })
        })
      });

      const conflicts = await conflictResolutionService.detectConflicts('shop-123', '2024-03-15');

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('time_overlap');
      expect(conflicts[0].severity).toBe('high');
      expect(conflicts[0].reservations).toHaveLength(2);
    });

    it('should detect capacity conflicts', async () => {
      const reservations = [
        {
          id: 'reservation-1',
          shop_id: 'shop-123',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed',
          user_id: 'user-1',
          services: [{ serviceId: 'service-1', quantity: 2 }],
          created_at: new Date('2024-03-15T09:00:00Z').toISOString()
        },
        {
          id: 'reservation-2',
          shop_id: 'shop-123',
          start_time: '10:00',
          end_time: '11:15',
          status: 'requested',
          user_id: 'user-2',
          services: [{ serviceId: 'service-1', quantity: 3 }], // Exceeds capacity
          created_at: new Date('2024-03-15T09:30:00Z').toISOString()
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({
                    data: reservations,
                    error: null
                  })
                })
              })
            })
          })
        })
      });

      const conflicts = await conflictResolutionService.detectConflicts('shop-123', '2024-03-15');

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('capacity_exceeded');
      expect(conflicts[0].severity).toBe('high');
    });

    it('should detect resource conflicts', async () => {
      const reservations = [
        {
          id: 'reservation-1',
          shop_id: 'shop-123',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed',
          user_id: 'user-1',
          staff_id: 'staff-1', // Same staff member
          created_at: new Date('2024-03-15T09:00:00Z').toISOString()
        },
        {
          id: 'reservation-2',
          shop_id: 'shop-123',
          start_time: '10:30',
          end_time: '11:45',
          status: 'requested',
          user_id: 'user-2',
          staff_id: 'staff-1', // Same staff member
          created_at: new Date('2024-03-15T09:30:00Z').toISOString()
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({
                    data: reservations,
                    error: null
                  })
                })
              })
            })
          })
        })
      });

      const conflicts = await conflictResolutionService.detectConflicts('shop-123', '2024-03-15');

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('resource_conflict');
      expect(conflicts[0].severity).toBe('medium');
    });
  });

  describe('Resolution Strategy Selection', () => {
    it('should select first-come-first-served strategy for time conflicts', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            user_id: 'user-1',
            status: 'confirmed'
          },
          {
            id: 'reservation-2',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            user_id: 'user-2',
            status: 'requested'
          }
        ]
      };

      const strategy = await conflictResolutionService.selectResolutionStrategy(conflict);

      expect(strategy.type).toBe('first_come_first_served');
      expect(strategy.winnerReservationId).toBe('reservation-1');
      expect(strategy.loserReservationId).toBe('reservation-2');
    });

    it('should select priority-based strategy for VIP users', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            user_id: 'user-1',
            status: 'confirmed',
            user_tier: 'regular'
          },
          {
            id: 'reservation-2',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            user_id: 'user-2',
            status: 'requested',
            user_tier: 'vip'
          }
        ]
      };

      const strategy = await conflictResolutionService.selectResolutionStrategy(conflict);

      expect(strategy.type).toBe('priority_based');
      expect(strategy.winnerReservationId).toBe('reservation-2');
      expect(strategy.loserReservationId).toBe('reservation-1');
    });

    it('should select alternative slot strategy for capacity conflicts', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'capacity_exceeded',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            shop_id: 'shop-123',
            start_time: '10:00',
            end_time: '11:15',
            user_id: 'user-1',
            status: 'confirmed'
          },
          {
            id: 'reservation-2',
            shop_id: 'shop-123',
            start_time: '10:00',
            end_time: '11:15',
            user_id: 'user-2',
            status: 'requested'
          }
        ]
      };

      mockTimeSlotService.getAlternativeSlots.mockResolvedValue([
        { startTime: '11:00', endTime: '12:15', available: true },
        { startTime: '14:00', endTime: '15:15', available: true }
      ]);

      const strategy = await conflictResolutionService.selectResolutionStrategy(conflict);

      expect(strategy.type).toBe('alternative_slot');
      expect(strategy.alternativeSlots).toBeDefined();
      expect(strategy.alternativeSlots.length).toBeGreaterThan(0);
    });
  });

  describe('Automatic Conflict Resolution', () => {
    it('should automatically resolve conflicts with clear winners', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            user_id: 'user-1',
            status: 'confirmed'
          },
          {
            id: 'reservation-2',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            user_id: 'user-2',
            status: 'requested'
          }
        ]
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, resolved_conflicts: 1 },
        error: null
      });

      const result = await conflictResolutionService.autoResolveConflict(conflict);

      expect(result.success).toBe(true);
      expect(result.resolvedConflicts).toBe(1);
      expect(result.action).toBe('cancelled_later_reservation');
    });

    it('should handle resolution failures gracefully', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            user_id: 'user-1',
            status: 'confirmed'
          },
          {
            id: 'reservation-2',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            user_id: 'user-2',
            status: 'requested'
          }
        ]
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Resolution failed' }
      });

      const result = await conflictResolutionService.autoResolveConflict(conflict);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Resolution failed');
    });

    it('should log resolution actions', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            user_id: 'user-1',
            status: 'confirmed'
          },
          {
            id: 'reservation-2',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            user_id: 'user-2',
            status: 'requested'
          }
        ]
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, resolved_conflicts: 1 },
        error: null
      });

      await conflictResolutionService.autoResolveConflict(conflict);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Conflict automatically resolved',
        expect.objectContaining({
          conflictId: 'conflict-1',
          resolutionType: 'first_come_first_served'
        })
      );
    });
  });

  describe('Manual Conflict Resolution', () => {
    it('should allow manual resolution by admin', async () => {
      const resolutionRequest = {
        conflictId: 'conflict-1',
        resolutionType: 'manual_override',
        winnerReservationId: 'reservation-2',
        loserReservationId: 'reservation-1',
        reason: 'Customer request',
        adminId: 'admin-123'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, resolved_conflicts: 1 },
        error: null
      });

      const result = await conflictResolutionService.manualResolveConflict(resolutionRequest);

      expect(result.success).toBe(true);
      expect(result.resolvedConflicts).toBe(1);
    });

    it('should validate admin permissions for manual resolution', async () => {
      const resolutionRequest = {
        conflictId: 'conflict-1',
        resolutionType: 'manual_override',
        winnerReservationId: 'reservation-2',
        loserReservationId: 'reservation-1',
        reason: 'Customer request',
        adminId: 'user-123' // Not an admin
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient permissions' }
      });

      const result = await conflictResolutionService.manualResolveConflict(resolutionRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
    });

    it('should log manual resolution actions', async () => {
      const resolutionRequest = {
        conflictId: 'conflict-1',
        resolutionType: 'manual_override',
        winnerReservationId: 'reservation-2',
        loserReservationId: 'reservation-1',
        reason: 'Customer request',
        adminId: 'admin-123'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, resolved_conflicts: 1 },
        error: null
      });

      await conflictResolutionService.manualResolveConflict(resolutionRequest);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Conflict manually resolved by admin',
        expect.objectContaining({
          conflictId: 'conflict-1',
          adminId: 'admin-123',
          reason: 'Customer request'
        })
      );
    });
  });

  describe('Priority-Based Resolution', () => {
    it('should prioritize VIP users over regular users', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            user_id: 'user-1',
            user_tier: 'regular',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            status: 'confirmed'
          },
          {
            id: 'reservation-2',
            user_id: 'user-2',
            user_tier: 'vip',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            status: 'requested'
          }
        ]
      };

      const strategy = await conflictResolutionService.selectResolutionStrategy(conflict);

      expect(strategy.type).toBe('priority_based');
      expect(strategy.winnerReservationId).toBe('reservation-2');
      expect(strategy.loserReservationId).toBe('reservation-1');
    });

    it('should prioritize confirmed reservations over requested ones', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            user_id: 'user-1',
            user_tier: 'regular',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            status: 'requested'
          },
          {
            id: 'reservation-2',
            user_id: 'user-2',
            user_tier: 'regular',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            status: 'confirmed'
          }
        ]
      };

      const strategy = await conflictResolutionService.selectResolutionStrategy(conflict);

      expect(strategy.type).toBe('status_based');
      expect(strategy.winnerReservationId).toBe('reservation-2');
      expect(strategy.loserReservationId).toBe('reservation-1');
    });

    it('should handle multiple priority levels', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            user_id: 'user-1',
            user_tier: 'premium',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            status: 'requested'
          },
          {
            id: 'reservation-2',
            user_id: 'user-2',
            user_tier: 'vip',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            status: 'requested'
          },
          {
            id: 'reservation-3',
            user_id: 'user-3',
            user_tier: 'regular',
            created_at: new Date('2024-03-15T09:15:00Z').toISOString(),
            status: 'requested'
          }
        ]
      };

      const strategy = await conflictResolutionService.selectResolutionStrategy(conflict);

      expect(strategy.type).toBe('priority_based');
      expect(strategy.winnerReservationId).toBe('reservation-2'); // VIP wins
      expect(strategy.loserReservationId).toBe('reservation-3'); // Regular loses
    });
  });

  describe('Performance Optimization', () => {
    it('should batch process multiple conflicts efficiently', async () => {
      const conflicts = Array(50).fill(0).map((_, index) => ({
        id: `conflict-${index}`,
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: `reservation-${index}-1`,
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            user_id: `user-${index}-1`,
            status: 'confirmed'
          },
          {
            id: `reservation-${index}-2`,
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            user_id: `user-${index}-2`,
            status: 'requested'
          }
        ]
      }));

      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, resolved_conflicts: 1 },
        error: null
      });

      const startTime = performance.now();
      const results = await Promise.allSettled(
        conflicts.map(conflict => conflictResolutionService.autoResolveConflict(conflict))
      );
      const endTime = performance.now();

      expect(results).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should cache resolution strategies for similar conflicts', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            user_id: 'user-1',
            status: 'confirmed'
          },
          {
            id: 'reservation-2',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            user_id: 'user-2',
            status: 'requested'
          }
        ]
      };

      // First call
      const start1 = performance.now();
      await conflictResolutionService.selectResolutionStrategy(conflict);
      const end1 = performance.now();
      const firstCallTime = end1 - start1;

      // Second call (should use cache)
      const start2 = performance.now();
      await conflictResolutionService.selectResolutionStrategy(conflict);
      const end2 = performance.now();
      const secondCallTime = end2 - start2;

      expect(secondCallTime).toBeLessThan(firstCallTime);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockRejectedValue(new Error('Database connection failed'))
                })
              })
            })
          })
        })
      });

      await expect(
        conflictResolutionService.detectConflicts('shop-123', '2024-03-15')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle empty conflict lists', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          })
        })
      });

      const conflicts = await conflictResolutionService.detectConflicts('shop-123', '2024-03-15');

      expect(conflicts).toHaveLength(0);
    });

    it('should handle invalid conflict data', async () => {
      const invalidConflict = {
        id: 'conflict-1',
        type: 'invalid_type',
        severity: 'unknown',
        reservations: []
      };

      await expect(
        conflictResolutionService.selectResolutionStrategy(invalidConflict)
      ).rejects.toThrow('Invalid conflict type');
    });

    it('should handle resolution timeout scenarios', async () => {
      const conflict = {
        id: 'conflict-1',
        type: 'time_overlap',
        severity: 'high',
        reservations: [
          {
            id: 'reservation-1',
            created_at: new Date('2024-03-15T09:00:00Z').toISOString(),
            user_id: 'user-1',
            status: 'confirmed'
          },
          {
            id: 'reservation-2',
            created_at: new Date('2024-03-15T09:30:00Z').toISOString(),
            user_id: 'user-2',
            status: 'requested'
          }
        ]
      };

      mockSupabase.rpc.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await conflictResolutionService.autoResolveConflict(conflict);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });
  });
});
