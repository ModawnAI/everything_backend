/**
 * Reservation Service
 * 
 * Handles reservation creation and management with concurrent booking prevention
 * Implements database locking, transaction management, and retry logic
 */

import { getSupabaseClient } from '../config/database';
import { timeSlotService } from './time-slot.service';
import { logger } from '../utils/logger';

export interface CreateReservationRequest {
  shopId: string;
  userId: string;
  services: Array<{
    serviceId: string;
    quantity: number;
  }>;
  reservationDate: string;
  reservationTime: string;
  specialRequests?: string;
  pointsToUse?: number;
}

export interface Reservation {
  id: string;
  shopId: string;
  userId: string;
  reservationDate: string;
  reservationTime: string;
  status: ReservationStatus;
  totalAmount: number;
  pointsUsed: number;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationService {
  serviceId: string;
  quantity: number;
  price: number;
  durationMinutes: number;
}

export type ReservationStatus = 
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface LockAcquisitionResult {
  success: boolean;
  reservation?: Reservation;
  error?: string;
  retryAfter?: number;
}

export class ReservationService {
  private supabase = getSupabaseClient();
  private readonly LOCK_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 5000; // 5 seconds
  private readonly DEADLOCK_RETRY_DELAY = 2000; // 2 seconds

  /**
   * Create a new reservation with concurrent booking prevention
   */
  async createReservation(request: CreateReservationRequest): Promise<Reservation> {
    const { shopId, userId, services, reservationDate, reservationTime, specialRequests, pointsToUse = 0 } = request;

    // Validate inputs
    this.validateCreateReservationRequest(request);

    // Check if slot is still available
    const isAvailable = await timeSlotService.isSlotAvailable(
      shopId,
      reservationDate,
      reservationTime,
      services.map(s => s.serviceId)
    );

    if (!isAvailable) {
      throw new Error('Selected time slot is no longer available');
    }

    // Acquire lock and create reservation with enhanced retry logic
    return await this.withEnhancedRetry(async () => {
      return await this.createReservationWithLock(request);
    });
  }

  /**
   * Create reservation with enhanced database locking
   */
  private async createReservationWithLock(request: CreateReservationRequest): Promise<Reservation> {
    const { shopId, userId, services, reservationDate, reservationTime, specialRequests, pointsToUse = 0 } = request;

    // Enhanced timeout handling with retry logic
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Attempting reservation creation with lock', {
          shopId,
          userId,
          reservationDate,
          reservationTime,
          attempt,
          maxRetries
        });

        const { data: reservation, error } = await this.supabase.rpc('create_reservation_with_lock', {
          p_shop_id: shopId,
          p_user_id: userId,
          p_reservation_date: reservationDate,
          p_reservation_time: reservationTime,
          p_special_requests: specialRequests,
          p_points_used: pointsToUse || 0,
          p_services: JSON.stringify(services),
          p_lock_timeout: this.LOCK_TIMEOUT
        });

        if (error) {
          lastError = error;
          
          // Enhanced error handling for different lock scenarios
          if (error.message?.includes('SLOT_CONFLICT')) {
            throw new Error('Time slot is no longer available due to concurrent booking');
          } else if (error.message?.includes('ADVISORY_LOCK_TIMEOUT')) {
            if (attempt < maxRetries) {
              logger.warn('Advisory lock timeout, retrying', { attempt, maxRetries });
              await this.delay(100 * attempt); // Exponential backoff
              continue;
            }
            throw new Error('Unable to acquire time slot lock - please try again');
          } else if (error.message?.includes('LOCK_TIMEOUT')) {
            if (attempt < maxRetries) {
              logger.warn('Lock timeout, retrying', { attempt, maxRetries });
              await this.delay(200 * attempt); // Exponential backoff
              continue;
            }
            throw new Error('Lock acquisition timeout - please try again');
          } else if (error.message?.includes('DEADLOCK_RETRY_EXCEEDED')) {
            throw new Error('System is busy - please try again in a moment');
          } else if (error.message?.includes('deadlock')) {
            if (attempt < maxRetries) {
              logger.warn('Deadlock detected, retrying', { attempt, maxRetries });
              await this.delay(300 * attempt); // Exponential backoff
              continue;
            }
            throw new Error('Deadlock detected - please try again');
          } else if (error.message?.includes('SERVICE_NOT_FOUND')) {
            throw new Error('One or more services are not available');
          } else if (error.message?.includes('INVALID_QUANTITY')) {
            throw new Error('Invalid service quantity');
          } else if (error.message?.includes('INVALID_POINTS')) {
            throw new Error('Invalid points usage');
          } else if (error.message?.includes('INSUFFICIENT_AMOUNT')) {
            throw new Error('Points used cannot exceed total amount');
          } else {
            logger.error('Reservation creation failed', {
              error: error.message,
              shopId,
              userId,
              reservationDate,
              reservationTime,
              attempt
            });
            throw new Error('Reservation creation failed - please try again');
          }
        }

        if (!reservation) {
          throw new Error('Failed to create reservation');
        }

        logger.info('Reservation created successfully', {
          reservationId: reservation.id,
          shopId,
          userId,
          reservationDate,
          reservationTime
        });

        return reservation as Reservation;

      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          logger.warn('Reservation creation attempt failed, retrying', {
            attempt,
            maxRetries,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          await this.delay(100 * attempt); // Exponential backoff
          continue;
        }
        
        // If all retries failed, throw the last error
        throw error;
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error('Reservation creation failed after all retries');
  }

  /**
   * Helper method for delays with exponential backoff
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced retry logic with deadlock detection and exponential backoff
   */
  private async withEnhancedRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= this.MAX_RETRIES) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        // Check if we should retry based on error type
        if (!this.shouldRetry(error as Error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateRetryDelay(retryCount, error as Error);
        
        logger.warn('Retrying reservation operation', {
          retryCount,
          delay,
          error: (error as Error).message,
          maxRetries: this.MAX_RETRIES
        });

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // If we've exhausted all retries, throw the last error
    throw lastError || new Error('Reservation operation failed after maximum retries');
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'lock_timeout',
      'deadlock',
      'SLOT_CONFLICT'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Calculate retry delay with exponential backoff and deadlock handling
   */
  private calculateRetryDelay(retryCount: number, error: Error): number {
    const errorMessage = error.message.toLowerCase();
    
    // Special handling for deadlocks
    if (errorMessage.includes('deadlock')) {
      return this.DEADLOCK_RETRY_DELAY;
    }

    // Exponential backoff with jitter
    const baseDelay = this.BASE_RETRY_DELAY * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
    const delay = Math.min(baseDelay + jitter, this.MAX_RETRY_DELAY);

    return delay;
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate reservation creation request
   */
  private validateCreateReservationRequest(request: CreateReservationRequest): void {
    const { shopId, userId, services, reservationDate, reservationTime } = request;

    if (!shopId || !userId) {
      throw new Error('Shop ID and User ID are required');
    }

    if (!services || services.length === 0) {
      throw new Error('At least one service is required');
    }

    if (!reservationDate || !reservationTime) {
      throw new Error('Reservation date and time are required');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(reservationDate)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(reservationTime)) {
      throw new Error('Invalid time format. Use HH:MM');
    }

    // Validate services
    for (const service of services) {
      if (!service.serviceId) {
        throw new Error('Service ID is required for all services');
      }
      if (!service.quantity || service.quantity <= 0) {
        throw new Error('Service quantity must be greater than 0');
      }
    }

    // Validate points usage
    if (request.pointsToUse && request.pointsToUse < 0) {
      throw new Error('Points used cannot be negative');
    }
  }

  /**
   * Get reservation by ID
   */
  async getReservationById(reservationId: string): Promise<Reservation | null> {
    try {
      const { data: reservation, error } = await this.supabase
        .from('reservations')
        .select(`
          id,
          shop_id,
          user_id,
          reservation_date,
          reservation_time,
          status,
          total_amount,
          points_used,
          special_requests,
          created_at,
          updated_at
        `)
        .eq('id', reservationId)
        .single();

      if (error) {
        logger.error('Error fetching reservation', { reservationId, error: error.message });
        return null;
      }

      if (!reservation) {
        return null;
      }

      return {
        id: reservation.id,
        shopId: reservation.shop_id,
        userId: reservation.user_id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        status: reservation.status,
        totalAmount: reservation.total_amount,
        pointsUsed: reservation.points_used,
        specialRequests: reservation.special_requests,
        createdAt: reservation.created_at,
        updatedAt: reservation.updated_at
      };
    } catch (error) {
      logger.error('Error in getReservationById', { reservationId, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Get user reservations with filtering
   */
  async getUserReservations(
    userId: string,
    filters: {
      status?: ReservationStatus;
      startDate?: string;
      endDate?: string;
      shopId?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    reservations: Reservation[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      let query = this.supabase
        .from('reservations')
        .select(`
          id,
          shop_id,
          user_id,
          reservation_date,
          reservation_time,
          status,
          total_amount,
          points_used,
          special_requests,
          created_at,
          updated_at
        `, { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.startDate) {
        query = query.gte('reservation_date', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('reservation_date', filters.endDate);
      }

      if (filters.shopId) {
        query = query.eq('shop_id', filters.shopId);
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1);

      const { data: reservations, error, count } = await query;

      if (error) {
        logger.error('Error fetching user reservations', { userId, error: error.message });
        throw new Error('Failed to fetch reservations');
      }

      const formattedReservations = reservations?.map(reservation => ({
        id: reservation.id,
        shopId: reservation.shop_id,
        userId: reservation.user_id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        status: reservation.status,
        totalAmount: reservation.total_amount,
        pointsUsed: reservation.points_used,
        specialRequests: reservation.special_requests,
        createdAt: reservation.created_at,
        updatedAt: reservation.updated_at
      })) || [];

      return {
        reservations: formattedReservations,
        total: count || 0,
        page,
        limit
      };
    } catch (error) {
      logger.error('Error in getUserReservations', { userId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Cancel reservation
   */
  async cancelReservation(reservationId: string, userId: string, reason?: string): Promise<Reservation> {
    try {
      // Check if user can cancel the reservation
      const canCancel = await this.canCancelReservation(reservationId, userId);
      if (!canCancel.canCancel) {
        throw new Error(canCancel.reason || 'Cannot cancel this reservation');
      }

      const { data: reservation, error } = await this.supabase
        .from('reservations')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', reservationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error cancelling reservation', { reservationId, userId, error: error.message });
        throw new Error('Failed to cancel reservation');
      }

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      logger.info('Reservation cancelled successfully', {
        reservationId,
        userId,
        reason
      });

      return {
        id: reservation.id,
        shopId: reservation.shop_id,
        userId: reservation.user_id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        status: reservation.status,
        totalAmount: reservation.total_amount,
        pointsUsed: reservation.points_used,
        specialRequests: reservation.special_requests,
        createdAt: reservation.created_at,
        updatedAt: reservation.updated_at
      };
    } catch (error) {
      logger.error('Error in cancelReservation', { reservationId, userId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Check if user can cancel a reservation
   */
  async canCancelReservation(reservationId: string, userId: string): Promise<{
    canCancel: boolean;
    reason?: string;
  }> {
    try {
      const reservation = await this.getReservationById(reservationId);
      
      if (!reservation) {
        return { canCancel: false, reason: 'Reservation not found' };
      }

      if (reservation.userId !== userId) {
        return { canCancel: false, reason: 'You can only cancel your own reservations' };
      }

      // Check if reservation is in a cancellable state
      const cancellableStatuses: ReservationStatus[] = ['requested', 'confirmed'];
      if (!cancellableStatuses.includes(reservation.status)) {
        return { canCancel: false, reason: 'Reservation cannot be cancelled in its current state' };
      }

      // Check if reservation is within cancellation window (e.g., 24 hours before)
      const reservationDateTime = new Date(`${reservation.reservationDate}T${reservation.reservationTime}`);
      const now = new Date();
      const hoursUntilReservation = (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilReservation < 24) {
        return { canCancel: false, reason: 'Reservation cannot be cancelled within 24 hours of appointment' };
      }

      return { canCancel: true };
    } catch (error) {
      logger.error('Error in canCancelReservation', { reservationId, userId, error: (error as Error).message });
      return { canCancel: false, reason: 'Error checking cancellation eligibility' };
    }
  }

  /**
   * Legacy retry method for backward compatibility
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    return this.withEnhancedRetry(operation);
  }
}

export const reservationService = new ReservationService(); 