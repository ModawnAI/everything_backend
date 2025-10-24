import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ReservationStatus } from '../types/database.types';

export interface OptimisticLockResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  conflictDetected?: boolean;
  currentVersion?: number;
  expectedVersion?: number;
}

export interface ConcurrentBookingConfig {
  maxRetries: number;
  retryDelayMs: number;
  lockTimeoutMs: number;
  conflictRetryDelayMs: number;
}

export class ConcurrentBookingPreventionService {
  private supabase = getSupabaseClient();
  private defaultConfig: ConcurrentBookingConfig = {
    maxRetries: 3,
    retryDelayMs: 100,
    lockTimeoutMs: 5000,
    conflictRetryDelayMs: 200
  };

  constructor(private config: Partial<ConcurrentBookingConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Execute operation with optimistic locking
   * Retries on version conflicts
   */
  async executeWithOptimisticLock<T>(
    operation: (currentData: any) => Promise<T>,
    fetchCurrentData: () => Promise<{ data: any; version: number } | null>,
    tableName: string,
    recordId: string
  ): Promise<OptimisticLockResult<T>> {
    const maxRetries = this.config.maxRetries!;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Optimistic lock attempt ${attempt}/${maxRetries}`, {
          tableName,
          recordId,
          attempt
        });

        // Fetch current data with version
        const currentData = await fetchCurrentData();
        if (!currentData) {
          return {
            success: false,
            error: `Record not found: ${recordId}`
          };
        }

        // Execute operation with current data
        const result = await operation(currentData.data);

        // Verify version hasn't changed during operation
        const verificationData = await fetchCurrentData();
        if (!verificationData || verificationData.version !== currentData.version) {
          throw new Error(`Version conflict detected. Expected: ${currentData.version}, Got: ${verificationData?.version}`);
        }

        logger.info('Optimistic lock operation successful', {
          tableName,
          recordId,
          version: currentData.version,
          attempt
        });

        return {
          success: true,
          data: result
        };

      } catch (error: any) {
        lastError = error;
        
        if (error.message.includes('Version conflict')) {
          logger.warn(`Version conflict on attempt ${attempt}`, {
            tableName,
            recordId,
            attempt,
            error: error.message
          });

          if (attempt < maxRetries) {
            // Wait before retry on version conflict
            await this.delay(this.config.conflictRetryDelayMs!);
            continue;
          } else {
            return {
              success: false,
              conflictDetected: true,
              error: 'Maximum retries exceeded due to version conflicts',
              currentVersion: error.currentVersion,
              expectedVersion: error.expectedVersion
            };
          }
        } else {
          // Non-conflict error, don't retry
          logger.error('Non-conflict error in optimistic lock operation', {
            tableName,
            recordId,
            attempt,
            error: error.message
          });
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Operation failed after maximum retries'
    };
  }

  /**
   * Update reservation with optimistic locking
   */
  async updateReservationWithLock(
    reservationId: string,
    updates: any,
    expectedVersion: number
  ): Promise<OptimisticLockResult> {
    const fetchCurrentData = async () => {
      const { data, error } = await this.supabase
        .from('reservations')
        .select('*, version')
        .eq('id', reservationId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        data,
        version: data.version
      };
    };

    const operation = async (currentData: any) => {
      // Check version matches expected
      if (currentData.version !== expectedVersion) {
        throw new Error(`Version mismatch. Expected: ${expectedVersion}, Current: ${currentData.version}`);
      }

      // Prepare update data with version increment
      const updateData = {
        ...updates,
        version: expectedVersion + 1
      };

      const { data, error } = await this.supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .eq('version', expectedVersion) // This ensures atomic update
        .select()
        .single();

      if (error) {
        throw new Error(`Update failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('No rows updated - version conflict detected');
      }

      return data;
    };

    return this.executeWithOptimisticLock(
      operation,
      fetchCurrentData,
      'reservations',
      reservationId
    );
  }

  /**
   * Update reservation service with optimistic locking
   */
  async updateReservationServiceWithLock(
    serviceId: string,
    updates: any,
    expectedVersion: number
  ): Promise<OptimisticLockResult> {
    const fetchCurrentData = async () => {
      const { data, error } = await this.supabase
        .from('reservation_services')
        .select('*, version')
        .eq('id', serviceId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        data,
        version: data.version
      };
    };

    const operation = async (currentData: any) => {
      if (currentData.version !== expectedVersion) {
        throw new Error(`Version mismatch. Expected: ${expectedVersion}, Current: ${currentData.version}`);
      }

      const updateData = {
        ...updates,
        version: expectedVersion + 1
      };

      const { data, error } = await this.supabase
        .from('reservation_services')
        .update(updateData)
        .eq('id', serviceId)
        .eq('version', expectedVersion)
        .select()
        .single();

      if (error) {
        throw new Error(`Update failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('No rows updated - version conflict detected');
      }

      return data;
    };

    return this.executeWithOptimisticLock(
      operation,
      fetchCurrentData,
      'reservation_services',
      serviceId
    );
  }

  /**
   * Update payment with optimistic locking
   */
  async updatePaymentWithLock(
    paymentId: string,
    updates: any,
    expectedVersion: number
  ): Promise<OptimisticLockResult> {
    const fetchCurrentData = async () => {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*, version')
        .eq('id', paymentId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        data,
        version: data.version
      };
    };

    const operation = async (currentData: any) => {
      if (currentData.version !== expectedVersion) {
        throw new Error(`Version mismatch. Expected: ${expectedVersion}, Current: ${currentData.version}`);
      }

      const updateData = {
        ...updates,
        version: expectedVersion + 1
      };

      const { data, error } = await this.supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .eq('version', expectedVersion)
        .select()
        .single();

      if (error) {
        throw new Error(`Update failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('No rows updated - version conflict detected');
      }

      return data;
    };

    return this.executeWithOptimisticLock(
      operation,
      fetchCurrentData,
      'payments',
      paymentId
    );
  }

  /**
   * Check for concurrent booking conflicts
   */
  async checkBookingConflicts(
    shopId: string,
    reservationDate: string,
    reservationTime: string,
    excludeReservationId?: string
  ): Promise<{
    hasConflicts: boolean;
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
        .in('status', ['requested', 'confirmed']);

      if (excludeReservationId) {
        query = query.neq('id', excludeReservationId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to check conflicts: ${error.message}`);
      }

      const conflictingReservations = data?.map(reservation => ({
        id: reservation.id,
        status: reservation.status,
        reservationTime: reservation.reservation_time,
        duration: (reservation as any).reservation_services?.[0]?.shop_services?.duration_minutes || 60
      })) || [];

      return {
        hasConflicts: conflictingReservations.length > 0,
        conflictingReservations
      };

    } catch (error) {
      logger.error('Error checking booking conflicts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        reservationDate,
        reservationTime
      });
      throw error;
    }
  }

  /**
   * Utility method to delay execution
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): ConcurrentBookingConfig {
    return { ...this.config } as ConcurrentBookingConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConcurrentBookingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const concurrentBookingPreventionService = new ConcurrentBookingPreventionService();
