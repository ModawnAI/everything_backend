/**
 * No-Show Detection Service Unit Tests
 * 
 * Comprehensive test suite for the no-show detection service covering:
 * - Automatic no-show detection
 * - Manual override functionality
 * - Statistics calculation
 * - Configuration management
 * - Penalty application
 * - Notification sending
 */

import { NoShowDetectionService, ManualOverrideRequest, NoShowConfig } from '../../src/services/no-show-detection.service';
import { ReservationStateMachine } from '../../src/services/reservation-state-machine.service';
import { ReservationStatus, Reservation } from '../../src/types/database.types';

// Mock the Supabase client
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: null,
                  error: null
                }))
              }))
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: null,
            error: null
          }))
        })),
        insert: jest.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }))
}));

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock the ReservationStateMachine
jest.mock('../../src/services/reservation-state-machine.service');

describe('NoShowDetectionService', () => {
  let noShowDetectionService: NoShowDetectionService;
  let mockSupabase: any;
  let mockStateMachine: jest.Mocked<ReservationStateMachine>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh instance
    noShowDetectionService = new NoShowDetectionService();
    
    // Get the mocked Supabase client
    const { getSupabaseClient } = require('../../src/config/database');
    mockSupabase = getSupabaseClient();
    
    // Mock the state machine
    mockStateMachine = {
      executeTransition: jest.fn(),
      validateTransition: jest.fn(),
      getAvailableTransitions: jest.fn(),
      processAutomaticTransitions: jest.fn(),
      getStateChangeHistory: jest.fn(),
      rollbackStateChange: jest.fn()
    } as any;
    
    // Replace the state machine instance
    (noShowDetectionService as any).stateMachine = mockStateMachine;
  });

  describe('Configuration Management', () => {
    test('should return default configuration', () => {
      const config = noShowDetectionService.getConfiguration();
      
      expect(config).toEqual({
        defaultGracePeriod: 30,
        serviceTypeGracePeriods: {
          nail: 45,
          eyelash: 60,
          waxing: 30,
          eyebrow_tattoo: 60,
          hair: 45,
        },
        penaltyPoints: 50,
        maxPenaltyPoints: 200,
        notificationDelay: 15,
        autoDetectionEnabled: true,
        manualOverrideEnabled: true,
      });
    });

    test('should update configuration successfully', async () => {
      const newConfig: Partial<NoShowConfig> = {
        defaultGracePeriod: 45,
        penaltyPoints: 75,
        autoDetectionEnabled: false
      };

      const result = await noShowDetectionService.updateConfiguration(newConfig);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);

      const updatedConfig = noShowDetectionService.getConfiguration();
      expect(updatedConfig.defaultGracePeriod).toBe(45);
      expect(updatedConfig.penaltyPoints).toBe(75);
      expect(updatedConfig.autoDetectionEnabled).toBe(false);
    });

    test('should reject invalid configuration', async () => {
      const invalidConfig = {
        defaultGracePeriod: -10,
        penaltyPoints: -5
      };

      const result = await noShowDetectionService.updateConfiguration(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Default grace period must be positive');
      expect(result.errors).toContain('Penalty points must be positive');
    });
  });

  describe('Grace Period Calculation', () => {
    test('should return service-specific grace period', () => {
      const nailGracePeriod = (noShowDetectionService as any).getGracePeriodForService('nail');
      const eyelashGracePeriod = (noShowDetectionService as any).getGracePeriodForService('eyelash');
      const defaultGracePeriod = (noShowDetectionService as any).getGracePeriodForService('unknown');

      expect(nailGracePeriod).toBe(45);
      expect(eyelashGracePeriod).toBe(60);
      expect(defaultGracePeriod).toBe(30);
    });
  });

  describe('No-Show Detection Logic', () => {
    test('should detect no-show for confirmed reservation past grace period', async () => {
      const reservation: Reservation = {
        id: 'res-1',
        user_id: 'user-1',
        shop_id: 'shop-1',
        reservation_date: '2024-01-15',
        reservation_time: '09:00:00',
        reservation_datetime: '2024-01-15T09:00:00Z',
        status: 'confirmed',
        total_amount: 100,
        deposit_amount: 20,
        points_used: 0,
        points_earned: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z'
      };

      // Mock current time to be 45 minutes after reservation time
      const mockDate = new Date('2024-01-15T09:45:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const isNoShow = await (noShowDetectionService as any).shouldMarkAsNoShow(reservation, 30);

      expect(isNoShow).toBe(true);
    });

    test('should not detect no-show for confirmed reservation within grace period', async () => {
      const reservation: Reservation = {
        id: 'res-1',
        user_id: 'user-1',
        shop_id: 'shop-1',
        reservation_date: '2024-01-15',
        reservation_time: '09:00:00',
        reservation_datetime: '2024-01-15T09:00:00Z',
        status: 'confirmed',
        total_amount: 100,
        deposit_amount: 20,
        points_used: 0,
        points_earned: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z'
      };

      // Mock current time to be 15 minutes after reservation time
      const mockDate = new Date('2024-01-15T09:15:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const isNoShow = await (noShowDetectionService as any).shouldMarkAsNoShow(reservation, 30);

      expect(isNoShow).toBe(false);
    });

    test('should not detect no-show for non-confirmed reservations', async () => {
      const reservation: Reservation = {
        id: 'res-1',
        user_id: 'user-1',
        shop_id: 'shop-1',
        reservation_date: '2024-01-15',
        reservation_time: '09:00:00',
        reservation_datetime: '2024-01-15T09:00:00Z',
        status: 'requested',
        total_amount: 100,
        deposit_amount: 20,
        points_used: 0,
        points_earned: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z'
      };

      const mockDate = new Date('2024-01-15T09:45:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const isNoShow = await (noShowDetectionService as any).shouldMarkAsNoShow(reservation, 30);

      expect(isNoShow).toBe(false);
    });
  });

  describe('Penalty Application', () => {
    test('should apply penalty successfully', async () => {
      const userId = 'user-1';
      const penaltyPoints = 50;

      // Mock user data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { available_points: 100, total_points: 200 },
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        }),
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const result = await (noShowDetectionService as any).applyNoShowPenalty(userId, penaltyPoints);

      expect(result.success).toBe(true);
      expect(result.penaltyApplied).toBe(50);
      expect(result.errors).toEqual([]);
    });

    test('should handle user not found', async () => {
      const userId = 'user-1';
      const penaltyPoints = 50;

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' }
            })
          })
        })
      });

      const result = await (noShowDetectionService as any).applyNoShowPenalty(userId, penaltyPoints);

      expect(result.success).toBe(false);
      expect(result.penaltyApplied).toBe(0);
      expect(result.errors).toContain('User not found or error fetching user data');
    });

    test('should not apply penalty if user has no points', async () => {
      const userId = 'user-1';
      const penaltyPoints = 50;

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { available_points: 0, total_points: 0 },
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        }),
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const result = await (noShowDetectionService as any).applyNoShowPenalty(userId, penaltyPoints);

      expect(result.success).toBe(true);
      expect(result.penaltyApplied).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Notification Sending', () => {
    test('should send notification successfully', async () => {
      const reservation: Reservation = {
        id: 'res-1',
        user_id: 'user-1',
        shop_id: 'shop-1',
        reservation_date: '2024-01-15',
        reservation_time: '09:00:00',
        reservation_datetime: '2024-01-15T09:00:00Z',
        status: 'confirmed',
        total_amount: 100,
        deposit_amount: 20,
        points_used: 0,
        points_earned: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z'
      };

      const penaltyApplied = 50;

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const result = await (noShowDetectionService as any).sendNoShowNotification(reservation, penaltyApplied);

      expect(result).toBe(true);
    });

    test('should handle notification error', async () => {
      const reservation: Reservation = {
        id: 'res-1',
        user_id: 'user-1',
        shop_id: 'shop-1',
        reservation_date: '2024-01-15',
        reservation_time: '09:00:00',
        reservation_datetime: '2024-01-15T09:00:00Z',
        status: 'confirmed',
        total_amount: 100,
        deposit_amount: 20,
        points_used: 0,
        points_earned: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z'
      };

      const penaltyApplied = 50;

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      const result = await (noShowDetectionService as any).sendNoShowNotification(reservation, penaltyApplied);

      expect(result).toBe(false);
    });
  });

  describe('Manual Override', () => {
    test('should mark reservation as attended', async () => {
      const request: ManualOverrideRequest = {
        reservationId: 'res-1',
        overrideBy: 'shop',
        overrideById: 'shop-owner-1',
        reason: 'Customer arrived late but attended',
        action: 'mark_attended'
      };

      // Mock reservation fetch
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'res-1',
                status: 'confirmed',
                user_id: 'user-1',
                shop_id: 'shop-1'
              },
              error: null
            })
          })
        })
      });

      // Mock state machine transition
      mockStateMachine.executeTransition.mockResolvedValue({
        success: true,
        reservation: {
          id: 'res-1',
          user_id: 'user-1',
          shop_id: 'shop-1',
          reservation_date: '2024-01-15',
          reservation_time: '09:00:00',
          reservation_datetime: '2024-01-15T09:00:00Z',
          status: 'completed',
          total_amount: 100,
          deposit_amount: 20,
          points_used: 0,
          points_earned: 0,
          created_at: '2024-01-15T08:00:00Z',
          updated_at: '2024-01-15T08:00:00Z'
        },
        errors: [],
        warnings: []
      });

      const result = await noShowDetectionService.manualOverride(request);

      expect(result.success).toBe(true);
      expect(result.reservation?.status).toBe('completed');
      expect(result.errors).toEqual([]);
    });

    test('should mark reservation as no-show', async () => {
      const request: ManualOverrideRequest = {
        reservationId: 'res-1',
        overrideBy: 'admin',
        overrideById: 'admin-1',
        reason: 'Customer confirmed no-show',
        action: 'mark_no_show'
      };

      // Mock reservation fetch
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'res-1',
                status: 'confirmed',
                user_id: 'user-1',
                shop_id: 'shop-1'
              },
              error: null
            })
          })
        })
      });

      // Mock state machine transition
      mockStateMachine.executeTransition.mockResolvedValue({
        success: true,
        reservation: {
          id: 'res-1',
          user_id: 'user-1',
          shop_id: 'shop-1',
          reservation_date: '2024-01-15',
          reservation_time: '09:00:00',
          reservation_datetime: '2024-01-15T09:00:00Z',
          status: 'no_show',
          total_amount: 100,
          deposit_amount: 20,
          points_used: 0,
          points_earned: 0,
          created_at: '2024-01-15T08:00:00Z',
          updated_at: '2024-01-15T08:00:00Z'
        },
        errors: [],
        warnings: []
      });

      const result = await noShowDetectionService.manualOverride(request);

      expect(result.success).toBe(true);
      expect(result.reservation?.status).toBe('no_show');
      expect(result.errors).toEqual([]);
    });

    test('should handle reservation not found', async () => {
      const request: ManualOverrideRequest = {
        reservationId: 'res-1',
        overrideBy: 'shop',
        overrideById: 'shop-owner-1',
        reason: 'Test',
        action: 'mark_attended'
      };

      // Mock reservation not found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      const result = await noShowDetectionService.manualOverride(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reservation not found or not in confirmed status');
    });

    test('should handle invalid action', async () => {
      const request: ManualOverrideRequest = {
        reservationId: 'res-1',
        overrideBy: 'shop',
        overrideById: 'shop-owner-1',
        reason: 'Test',
        action: 'invalid_action' as any
      };

      const result = await noShowDetectionService.manualOverride(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid action specified');
    });
  });

  describe('Statistics Calculation', () => {
    test('should calculate statistics correctly', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const shopId = 'shop-1';

      const mockReservations = [
        { id: 'res-1', status: 'confirmed' },
        { id: 'res-2', status: 'no_show' },
        { id: 'res-3', status: 'completed' },
        { id: 'res-4', status: 'no_show' }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockReservations,
                error: null
              })
            })
          })
        })
      });

      const statistics = await noShowDetectionService.getNoShowStatistics(startDate, endDate, shopId);

      expect(statistics.totalReservations).toBe(4);
      expect(statistics.noShowCount).toBe(2);
      expect(statistics.noShowRate).toBe(50);
      expect(statistics.totalPenaltyPoints).toBe(100); // 2 no-shows * 50 points
      expect(statistics.period).toEqual({
        start: startDate,
        end: endDate
      });
    });

    test('should handle empty results', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      const statistics = await noShowDetectionService.getNoShowStatistics(startDate, endDate);

      expect(statistics.totalReservations).toBe(0);
      expect(statistics.noShowCount).toBe(0);
      expect(statistics.noShowRate).toBe(0);
      expect(statistics.totalPenaltyPoints).toBe(0);
    });
  });

  describe('Automatic Detection Process', () => {
    test('should process automatic detection successfully', async () => {
      const mockReservations = [
        {
          id: 'res-1',
          user_id: 'user-1',
          shop_id: 'shop-1',
          reservation_datetime: '2024-01-15T09:00:00Z',
          status: 'confirmed',
          reservation_services: [{ shop_services: { category: 'nail' } }]
        }
      ];

      // Mock getReservationsForNoShowDetection
      jest.spyOn(noShowDetectionService as any, 'getReservationsForNoShowDetection')
        .mockResolvedValue(mockReservations);

      // Mock shouldMarkAsNoShow
      jest.spyOn(noShowDetectionService as any, 'shouldMarkAsNoShow')
        .mockResolvedValue(true);

      // Mock applyNoShowPenalty
      jest.spyOn(noShowDetectionService as any, 'applyNoShowPenalty')
        .mockResolvedValue({
          success: true,
          penaltyApplied: 50,
          errors: []
        });

      // Mock sendNoShowNotification
      jest.spyOn(noShowDetectionService as any, 'sendNoShowNotification')
        .mockResolvedValue(true);

             // Mock state machine
       mockStateMachine.executeTransition.mockResolvedValue({
         success: true,
         reservation: {
           id: 'res-1',
           user_id: 'user-1',
           shop_id: 'shop-1',
           reservation_date: '2024-01-15',
           reservation_time: '09:00:00',
           reservation_datetime: '2024-01-15T09:00:00Z',
           status: 'no_show',
           total_amount: 100,
           deposit_amount: 20,
           points_used: 0,
           points_earned: 0,
           created_at: '2024-01-15T08:00:00Z',
           updated_at: '2024-01-15T08:00:00Z'
         },
         errors: [],
         warnings: []
       });

      // Mock logNoShowAction
      jest.spyOn(noShowDetectionService as any, 'logNoShowAction')
        .mockResolvedValue(undefined);

      const result = await noShowDetectionService.processAutomaticNoShowDetection();

      expect(result.processed).toBe(1);
      expect(result.noShowsDetected).toBe(1);
      expect(result.errors).toEqual([]);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].isNoShow).toBe(true);
      expect(result.results[0].penaltyApplied).toBe(50);
    });

    test('should handle disabled automatic detection', async () => {
      // Disable automatic detection
      await noShowDetectionService.updateConfiguration({ autoDetectionEnabled: false });

      const result = await noShowDetectionService.processAutomaticNoShowDetection();

      expect(result.processed).toBe(0);
      expect(result.noShowsDetected).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.results).toEqual([]);
    });

    test('should handle errors during processing', async () => {
      const mockReservations = [
        {
          id: 'res-1',
          user_id: 'user-1',
          shop_id: 'shop-1',
          reservation_datetime: '2024-01-15T09:00:00Z',
          status: 'confirmed',
          reservation_services: [{ shop_services: { category: 'nail' } }]
        }
      ];

      jest.spyOn(noShowDetectionService as any, 'getReservationsForNoShowDetection')
        .mockResolvedValue(mockReservations);

      jest.spyOn(noShowDetectionService as any, 'shouldMarkAsNoShow')
        .mockRejectedValue(new Error('Test error'));

      const result = await noShowDetectionService.processAutomaticNoShowDetection();

      expect(result.processed).toBe(1);
      expect(result.noShowsDetected).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Error processing reservation res-1');
    });
  });
}); 