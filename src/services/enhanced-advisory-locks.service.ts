import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ReservationStatus } from '../types/database.types';

export interface AdvisoryLockMetrics {
  shopId: string;
  operationType: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  avgLockDurationMs: number;
  maxLockDurationMs: number;
  totalConflicts: number;
  avgRetryCount: number;
  maxRetryCount: number;
}

export interface AdvisoryLockConfig {
  enableMetrics: boolean;
  lockTimeoutMs: number;
  maxDeadlockRetries: number;
  defaultRetryDelayMs: number;
}

export interface CreateReservationWithLockRequest {
  shopId: string;
  userId: string;
  reservationDate: string;
  reservationTime: string;
  specialRequests?: string;
  pointsUsed?: number;
  services: Array<{
    serviceId: string;
    quantity: number;
  }>;
  depositAmount?: number;
  remainingAmount?: number;
  lockTimeoutMs?: number;
  enableMetrics?: boolean;
}

export interface CreateReservationWithLockResult {
  success: boolean;
  reservationId?: string;
  totalAmount?: number;
  depositAmount?: number;
  remainingAmount?: number;
  pointsUsed?: number;
  lockDurationMs?: number;
  retryCount?: number;
  metricsId?: string;
  error?: string;
  conflictDetected?: boolean;
}

export class EnhancedAdvisoryLocksService {
  private supabase = getSupabaseClient();
  private defaultConfig: AdvisoryLockConfig = {
    enableMetrics: true,
    lockTimeoutMs: 10000,
    maxDeadlockRetries: 3,
    defaultRetryDelayMs: 100
  };

  constructor(private config: Partial<AdvisoryLockConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Create reservation with enhanced advisory locks
   */
  async createReservationWithLock(
    request: CreateReservationWithLockRequest
  ): Promise<CreateReservationWithLockResult> {
    try {
      logger.info('Creating reservation with enhanced advisory locks', {
        shopId: request.shopId,
        userId: request.userId,
        reservationDate: request.reservationDate,
        reservationTime: request.reservationTime,
        servicesCount: request.services.length
      });

      const { data, error } = await this.supabase.rpc('create_reservation_with_lock_enhanced', {
        p_shop_id: request.shopId,
        p_user_id: request.userId,
        p_reservation_date: request.reservationDate,
        p_reservation_time: request.reservationTime,
        p_special_requests: request.specialRequests || null,
        p_points_used: request.pointsUsed || 0,
        p_services: JSON.stringify(request.services),
        p_lock_timeout: request.lockTimeoutMs || this.config.lockTimeoutMs,
        p_deposit_amount: request.depositAmount || null,
        p_remaining_amount: request.remainingAmount || null,
        p_enable_metrics: request.enableMetrics !== undefined ? request.enableMetrics : this.config.enableMetrics
      });

      if (error) {
        logger.error('Failed to create reservation with enhanced advisory locks', {
          error: error.message,
          shopId: request.shopId,
          userId: request.userId
        });

        // Parse error message to determine conflict type
        const isConflict = error.message.includes('SLOT_CONFLICT') || error.message.includes('conflict');
        const isLockTimeout = error.message.includes('ADVISORY_LOCK_TIMEOUT');

        return {
          success: false,
          error: error.message,
          conflictDetected: isConflict,
          retryCount: isLockTimeout ? this.config.maxDeadlockRetries : 0
        };
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: 'Reservation creation failed without specific error'
        };
      }

      logger.info('Reservation created successfully with enhanced advisory locks', {
        reservationId: data.reservation_id,
        shopId: request.shopId,
        userId: request.userId,
        lockDurationMs: data.lock_duration_ms,
        retryCount: data.retry_count
      });

      return {
        success: true,
        reservationId: data.reservation_id,
        totalAmount: data.total_amount,
        depositAmount: data.deposit_amount,
        remainingAmount: data.remaining_amount,
        pointsUsed: data.points_used,
        lockDurationMs: data.lock_duration_ms,
        retryCount: data.retry_count,
        metricsId: data.metrics_id
      };

    } catch (error) {
      logger.error('Unexpected error in createReservationWithLock', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: request.shopId,
        userId: request.userId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get advisory lock metrics for monitoring
   */
  async getAdvisoryLockMetrics(
    shopId?: string,
    hoursBack: number = 24,
    operationType?: string
  ): Promise<AdvisoryLockMetrics[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_advisory_lock_metrics', {
        p_shop_id: shopId || null,
        p_hours_back: hoursBack,
        p_operation_type: operationType || null
      });

      if (error) {
        logger.error('Failed to get advisory lock metrics', {
          error: error.message,
          shopId,
          hoursBack,
          operationType
        });
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Error getting advisory lock metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        hoursBack,
        operationType
      });
      throw error;
    }
  }

  /**
   * Cleanup old advisory lock metrics
   */
  async cleanupOldMetrics(daysToKeep: number = 30): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('cleanup_advisory_lock_metrics', {
        p_days_to_keep: daysToKeep
      });

      if (error) {
        logger.error('Failed to cleanup advisory lock metrics', {
          error: error.message,
          daysToKeep
        });
        throw error;
      }

      const deletedCount = data || 0;
      logger.info('Advisory lock metrics cleanup completed', {
        deletedCount,
        daysToKeep
      });

      return deletedCount;

    } catch (error) {
      logger.error('Error cleaning up advisory lock metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        daysToKeep
      });
      throw error;
    }
  }

  /**
   * Check if a time slot is available (without creating reservation)
   */
  async checkSlotAvailability(
    shopId: string,
    reservationDate: string,
    reservationTime: string,
    excludeReservationId?: string
  ): Promise<{
    available: boolean;
    conflictingReservations: Array<{
      id: string;
      status: ReservationStatus;
      reservationTime: string;
      duration: number;
    }>;
  }> {
    try {
      let query = this.supabase
        .from('reservations')
        .select(`
          id,
          status,
          reservation_time,
          reservation_services!inner(
            shop_services!inner(
              duration_minutes
            )
          )
        `)
        .eq('shop_id', shopId)
        .eq('reservation_date', reservationDate)
        .in('status', ['requested', 'confirmed', 'in_progress']);

      if (excludeReservationId) {
        query = query.neq('id', excludeReservationId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to check slot availability: ${error.message}`);
      }

      const conflictingReservations = data?.map(reservation => ({
        id: reservation.id,
        status: reservation.status,
        reservationTime: reservation.reservation_time,
        duration: (reservation as any).reservation_services?.[0]?.shop_services?.duration_minutes || 60
      })) || [];

      return {
        available: conflictingReservations.length === 0,
        conflictingReservations
      };

    } catch (error) {
      logger.error('Error checking slot availability', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        reservationDate,
        reservationTime
      });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AdvisoryLockConfig {
    return { ...this.config } as AdvisoryLockConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AdvisoryLockConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Generate advisory lock key (for testing/debugging)
   */
  generateAdvisoryLockKey(
    shopId: string,
    reservationDate: string,
    reservationTime: string
  ): string {
    // This mimics the database function logic for generating lock keys
    const keyString = `${shopId}-${reservationDate}-${reservationTime}`;
    const hash = require('crypto').createHash('md5').update(keyString).digest('hex');
    const lockKey = parseInt(hash.substring(0, 8), 16);
    return lockKey.toString();
  }
}

export const enhancedAdvisoryLocksService = new EnhancedAdvisoryLocksService();
