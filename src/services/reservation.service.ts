/**
 * Reservation Service
 * 
 * Handles reservation creation and management with concurrent booking prevention
 * Implements database locking, transaction management, and retry logic
 */

import { getSupabaseClient } from '../config/database';
import { timeSlotService } from './time-slot.service';
import { logger } from '../utils/logger';
import { shopOwnerNotificationService, ShopOwnerNotificationPayload } from './shop-owner-notification.service';
import { queryCacheService } from './query-cache.service';
import { batchQueryService } from './batch-query.service';

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
  // v3.1 Flow - Payment and Deposit Management
  paymentInfo?: {
    depositAmount?: number;
    remainingAmount?: number;
    paymentMethod?: 'card' | 'cash' | 'points' | 'mixed';
    depositRequired?: boolean;
  };
  // v3.1 Flow - Request-specific metadata
  requestMetadata?: {
    source?: 'mobile_app' | 'web_app' | 'admin_panel';
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
  };
  // v3.1 Flow - Notification preferences
  notificationPreferences?: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
  };
}

export interface Reservation {
  id: string;
  shopId: string;
  userId: string;
  reservationDate: string;
  reservationTime: string;
  status: ReservationStatus;
  totalAmount: number;
  depositAmount: number;
  remainingAmount?: number;
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
   * Create a new reservation with concurrent booking prevention and v3.1 flow support
   */
  async createReservation(request: CreateReservationRequest): Promise<Reservation> {
    const { 
      shopId, 
      userId, 
      services, 
      reservationDate, 
      reservationTime, 
      specialRequests, 
      pointsToUse = 0,
      paymentInfo,
      requestMetadata,
      notificationPreferences
    } = request;

    // Validate inputs with v3.1 flow support
    this.validateCreateReservationRequest(request);

    // Check if slot is still available using enhanced validation
    const slotValidation = await timeSlotService.validateSlotAvailability(
      shopId,
      reservationDate,
      reservationTime,
      services.map(s => s.serviceId)
    );

    if (!slotValidation.available) {
      logger.warn('Slot validation failed:', {
        shopId,
        reservationDate,
        reservationTime,
        conflictReason: slotValidation.conflictReason,
        conflictingReservations: slotValidation.conflictingReservations
      });
      throw new Error(`Selected time slot is no longer available: ${slotValidation.conflictReason}`);
    }

    // Log v3.1 flow metadata for tracking
    if (requestMetadata) {
      logger.info('Reservation request with v3.1 metadata:', {
        shopId,
        userId,
        source: requestMetadata.source,
        userAgent: requestMetadata.userAgent,
        ipAddress: requestMetadata.ipAddress
      });
    }

    // Calculate pricing with v3.1 flow support
    const pricingInfo = await this.calculatePricingWithDeposit(request);

    // Acquire lock and create reservation with enhanced retry logic
    const reservation = await this.withEnhancedRetry(async () => {
      return await this.createReservationWithLock(request, pricingInfo);
    });

    // Log successful v3.1 flow reservation creation
    logger.info('v3.1 flow reservation created successfully:', {
      reservationId: reservation.id,
      shopId,
      userId,
      status: reservation.status,
      totalAmount: reservation.totalAmount,
      depositAmount: paymentInfo?.depositAmount,
      remainingAmount: paymentInfo?.remainingAmount
    });

    // Send notification to shop owner for new reservation request (v3.1 flow)
    try {
      await this.notifyShopOwnerOfNewRequest(reservation, request, pricingInfo);
    } catch (notificationError) {
      // Log notification error but don't fail the reservation creation
      logger.error('Failed to send shop owner notification', {
        error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
        reservationId: reservation.id,
        shopId
      });
    }

    return reservation;
  }

  /**
   * Calculate pricing with deposit/remaining balance support for v3.1 flow
   * Enhanced with service-specific deposit policies and business rules
   */
  public async calculatePricingWithDeposit(request: CreateReservationRequest): Promise<{
    totalAmount: number;
    depositAmount: number;
    remainingAmount: number;
    depositRequired: boolean;
    depositCalculationDetails: {
      serviceDeposits: Array<{
        serviceId: string;
        serviceName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        depositAmount: number;
        depositPercentage?: number;
        depositType: 'fixed' | 'percentage' | 'default';
      }>;
      totalServiceDeposit: number;
      appliedDiscounts: Array<{
        type: 'points' | 'promotion';
        amount: number;
      }>;
      finalCalculation: {
        subtotal: number;
        totalDiscounts: number;
        amountAfterDiscounts: number;
        totalDeposit: number;
        remainingAmount: number;
      };
    };
  }> {
    const { services, pointsToUse = 0, paymentInfo } = request;

    // Business rules for deposit calculation
    const DEPOSIT_BUSINESS_RULES = {
      DEFAULT_DEPOSIT_PERCENTAGE: 25, // 25% default deposit (PRD: 20-30% range)
      MIN_DEPOSIT_PERCENTAGE: 20,     // Minimum 20% deposit
      MAX_DEPOSIT_PERCENTAGE: 30,     // Maximum 30% deposit
      MIN_DEPOSIT_AMOUNT: 10000,      // Minimum 10,000 won deposit
      MAX_DEPOSIT_AMOUNT: 100000,     // Maximum 100,000 won deposit
    };

    // Calculate total amount and service-specific deposits
    let totalAmount = 0;
    let totalServiceDeposit = 0;
    const serviceDeposits: Array<{
      serviceId: string;
      serviceName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      depositAmount: number;
      depositPercentage?: number;
      depositType: 'fixed' | 'percentage' | 'default';
    }> = [];

    // Get service details with deposit policies - OPTIMIZED: Single batch query instead of N queries
    const serviceIds = services.map(s => s.serviceId);

    const servicesData = await queryCacheService.getCachedQuery(
      `services:${serviceIds.sort().join(',')}`,
      async () => {
        const { data, error } = await this.supabase
          .from('shop_services')
          .select('id, price_min, name, deposit_amount, deposit_percentage')
          .in('id', serviceIds);

        if (error) {
          throw new Error(`Failed to fetch services: ${error.message}`);
        }

        return data || [];
      },
      {
        namespace: 'service',
        ttl: 1800, // 30 minutes
      }
    );

    // Create a map for O(1) lookups
    const servicesMap = new Map(servicesData.map(s => [s.id, s]));

    // Process each service using the batched data
    for (const service of services) {
      const serviceData = servicesMap.get(service.serviceId);

      if (!serviceData) {
        throw new Error(`Service with ID ${service.serviceId} not found`);
      }

      const unitPrice = serviceData.price_min;
      const totalPrice = unitPrice * service.quantity;
      totalAmount += totalPrice;

      // Calculate service-specific deposit
      let serviceDepositAmount = 0;
      let depositType: 'fixed' | 'percentage' | 'default' = 'default';
      let depositPercentage: number | undefined;

      if (serviceData.deposit_amount !== null && serviceData.deposit_amount > 0) {
        // Fixed deposit amount per service
        serviceDepositAmount = serviceData.deposit_amount * service.quantity;
        depositType = 'fixed';
      } else if (serviceData.deposit_percentage !== null && serviceData.deposit_percentage > 0) {
        // Percentage-based deposit
        depositPercentage = Number(serviceData.deposit_percentage);
        serviceDepositAmount = Math.round((totalPrice * depositPercentage) / 100);
        depositType = 'percentage';
      } else {
        // Default deposit calculation (25% of service price)
        depositPercentage = DEPOSIT_BUSINESS_RULES.DEFAULT_DEPOSIT_PERCENTAGE;
        serviceDepositAmount = Math.round((totalPrice * depositPercentage) / 100);
        depositType = 'default';
      }

      // Apply business rules constraints
      serviceDepositAmount = Math.max(
        DEPOSIT_BUSINESS_RULES.MIN_DEPOSIT_AMOUNT,
        Math.min(serviceDepositAmount, DEPOSIT_BUSINESS_RULES.MAX_DEPOSIT_AMOUNT)
      );

      // Ensure deposit doesn't exceed service total
      serviceDepositAmount = Math.min(serviceDepositAmount, totalPrice);

      totalServiceDeposit += serviceDepositAmount;

      serviceDeposits.push({
        serviceId: service.serviceId,
        serviceName: serviceData.name,
        quantity: service.quantity,
        unitPrice,
        totalPrice,
        depositAmount: serviceDepositAmount,
        depositPercentage,
        depositType
      });
    }

    // Apply points discount
    const pointsDiscount = Math.min(pointsToUse || 0, totalAmount);
    const amountAfterPoints = Math.max(0, totalAmount - pointsDiscount);

    // Apply deposit calculation based on payment info and business rules
    let depositAmount = 0;
    let remainingAmount = amountAfterPoints;
    let depositRequired = false;

    if (paymentInfo) {
      if (paymentInfo.depositAmount !== undefined) {
        // User explicitly provided deposit amount
        depositAmount = Math.max(0, Math.min(paymentInfo.depositAmount, amountAfterPoints));
        remainingAmount = amountAfterPoints - depositAmount;
        depositRequired = depositAmount < amountAfterPoints;
      } else if (paymentInfo.depositRequired) {
        // User requested deposit but didn't specify amount - use calculated service deposits
        depositAmount = Math.min(totalServiceDeposit, amountAfterPoints);
        remainingAmount = amountAfterPoints - depositAmount;
        depositRequired = true;
      } else {
        // No deposit required, full payment upfront
        depositAmount = amountAfterPoints;
        remainingAmount = 0;
      }
    } else {
      // Default behavior - use calculated service deposits
      depositAmount = Math.min(totalServiceDeposit, amountAfterPoints);
      remainingAmount = amountAfterPoints - depositAmount;
      depositRequired = depositAmount < amountAfterPoints;
    }

    // Prepare applied discounts
    const appliedDiscounts: Array<{
      type: 'points' | 'promotion';
      amount: number;
    }> = [];

    if (pointsDiscount > 0) {
      appliedDiscounts.push({
        type: 'points',
        amount: pointsDiscount
      });
    }

    return {
      totalAmount: amountAfterPoints,
      depositAmount,
      remainingAmount,
      depositRequired,
      depositCalculationDetails: {
        serviceDeposits,
        totalServiceDeposit,
        appliedDiscounts,
        finalCalculation: {
          subtotal: totalAmount,
          totalDiscounts: pointsDiscount,
          amountAfterDiscounts: amountAfterPoints,
          totalDeposit: depositAmount,
          remainingAmount
        }
      }
    };
  }

  /**
   * Create reservation with enhanced database locking and v3.1 flow support
   */
  private async createReservationWithLock(request: CreateReservationRequest, pricingInfo?: any): Promise<Reservation> {
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

        // Calculate total_amount from deposit + remaining
        const depositAmount = pricingInfo?.depositAmount || 0;
        const remainingAmount = pricingInfo?.remainingAmount || 0;
        const totalAmount = depositAmount + remainingAmount;

        const { data: reservation, error } = await this.supabase.rpc('create_reservation_with_lock', {
          p_user_id: userId,
          p_shop_id: shopId,
          p_reservation_date: reservationDate,
          p_reservation_time: reservationTime,
          p_total_amount: totalAmount,
          p_deposit_amount: depositAmount,
          p_special_requests: specialRequests || null
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
            console.log('❌ [RESERVATION-SERVICE] RPC Error Details:', {
              error: error,
              errorMessage: error.message,
              errorCode: error.code,
              errorDetails: error.details,
              errorHint: error.hint,
              shopId,
              userId,
              reservationDate,
              reservationTime,
              attempt
            });

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
   * Validate reservation creation request with v3.1 flow support
   */
  private validateCreateReservationRequest(request: CreateReservationRequest): void {
    const { shopId, userId, services, reservationDate, reservationTime, paymentInfo, requestMetadata, notificationPreferences } = request;

    // Basic validation
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

    // v3.1 Flow - Validate payment information
    if (paymentInfo) {
      // Validate deposit amount
      if (paymentInfo.depositAmount !== undefined && paymentInfo.depositAmount < 0) {
        throw new Error('Deposit amount cannot be negative');
      }

      // Validate remaining amount
      if (paymentInfo.remainingAmount !== undefined && paymentInfo.remainingAmount < 0) {
        throw new Error('Remaining amount cannot be negative');
      }

      // Validate payment method
      if (paymentInfo.paymentMethod && !['card', 'cash', 'points', 'mixed'].includes(paymentInfo.paymentMethod)) {
        throw new Error('Invalid payment method. Must be one of: card, cash, points, mixed');
      }

      // Validate deposit logic
      if (paymentInfo.depositRequired && paymentInfo.depositAmount !== undefined && paymentInfo.depositAmount <= 0) {
        throw new Error('Deposit amount must be greater than 0 when deposit is required');
      }
    }

    // v3.1 Flow - Validate request metadata
    if (requestMetadata) {
      // Validate source
      if (requestMetadata.source && !['mobile_app', 'web_app', 'admin_panel'].includes(requestMetadata.source)) {
        throw new Error('Invalid request source. Must be one of: mobile_app, web_app, admin_panel');
      }

      // Validate IP address format (basic validation)
      if (requestMetadata.ipAddress && !this.isValidIpAddress(requestMetadata.ipAddress)) {
        throw new Error('Invalid IP address format');
      }
    }

    // v3.1 Flow - Validate notification preferences
    if (notificationPreferences) {
      // All notification preferences are boolean and optional, no additional validation needed
      // The validation is handled by TypeScript types
    }
  }

  /**
   * Basic IP address validation
   */
  private isValidIpAddress(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Send notification to shop owner about new reservation request (v3.1 flow)
   */
  private async notifyShopOwnerOfNewRequest(
    reservation: Reservation,
    request: CreateReservationRequest,
    pricingInfo: any
  ): Promise<void> {
    try {
      // Get service details for notification
      const serviceDetails = await this.getServiceDetailsForNotification(request.services);

      // Prepare notification payload
      const notificationPayload: ShopOwnerNotificationPayload = {
        shopId: reservation.shopId,
        reservationId: reservation.id,
        reservationDate: reservation.reservationDate,
        reservationTime: reservation.reservationTime,
        services: serviceDetails,
        totalAmount: reservation.totalAmount,
        depositAmount: pricingInfo?.depositAmount,
        remainingAmount: pricingInfo?.remainingAmount,
        specialRequests: reservation.specialRequests,
        paymentMethod: request.paymentInfo?.paymentMethod,
        notificationPreferences: request.notificationPreferences
      };

      // Send notification to shop owner
      await shopOwnerNotificationService.notifyShopOwnerOfNewRequest(notificationPayload);

      logger.info('Shop owner notification sent successfully', {
        reservationId: reservation.id,
        shopId: reservation.shopId
      });

    } catch (error) {
      logger.error('Failed to send shop owner notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: reservation.id,
        shopId: reservation.shopId
      });
      throw error;
    }
  }

  /**
   * Get service details for notification
   * Optimized: Uses cached batch query
   */
  private async getServiceDetailsForNotification(services: Array<{serviceId: string; quantity: number}>): Promise<Array<{serviceId: string; serviceName: string; quantity: number}>> {
    try {
      const serviceIds = services.map(s => s.serviceId);

      // Use cached batch query
      const serviceData = await queryCacheService.getCachedQuery(
        `services:names:${serviceIds.sort().join(',')}`,
        async () => {
          const { data, error } = await this.supabase
            .from('shop_services')
            .select('id, name')
            .in('id', serviceIds);

          if (error) {
            throw error;
          }

          return data || [];
        },
        {
          namespace: 'service',
          ttl: 1800, // 30 minutes
        }
      );

      const servicesMap = new Map(serviceData.map(s => [s.id, s]));

      return services.map(service => ({
        serviceId: service.serviceId,
        serviceName: servicesMap.get(service.serviceId)?.name || 'Unknown Service',
        quantity: service.quantity
      }));

    } catch (error) {
      logger.error('Error fetching service details for notification', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return services.map(s => ({ serviceId: s.serviceId, serviceName: 'Unknown Service', quantity: s.quantity }));
    }
  }

  /**
   * Get reservation by ID
   * Optimized: Added caching for frequently accessed reservations
   */
  async getReservationById(reservationId: string): Promise<Reservation | null> {
    try {
      const reservation = await queryCacheService.getCachedQuery(
        `${reservationId}`,
        async () => {
          const { data, error } = await this.supabase
            .from('reservations')
            .select(`
              id,
              shop_id,
              user_id,
              reservation_date,
              reservation_time,
              status,
              total_amount,
              deposit_amount,
              remaining_amount,
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

          if (!data) {
            return null;
          }

          return {
            id: data.id,
            shopId: data.shop_id,
            userId: data.user_id,
            reservationDate: data.reservation_date,
            reservationTime: data.reservation_time,
            status: data.status,
            totalAmount: data.total_amount,
            depositAmount: data.deposit_amount,
            remainingAmount: data.remaining_amount,
            pointsUsed: data.points_used,
            specialRequests: data.special_requests,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        },
        {
          namespace: 'reservation',
          ttl: 600, // 10 minutes
        }
      );

      return reservation;
    } catch (error) {
      logger.error('Error in getReservationById', { reservationId, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Get user reservations with filtering
   * Optimized: Added caching for frequently accessed reservation lists
   */
  async getUserReservations(
    userId: string,
    filters: {
      status?: ReservationStatus | 'upcoming' | 'past';  // Allow "upcoming" and "past" as application-level filters
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
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      // Create cache key based on query parameters
      const cacheKey = `list:${userId}:${filters.status || 'all'}:${filters.startDate || ''}:${filters.endDate || ''}:${filters.shopId || 'all'}:${page}:${limit}`;

      const result = await queryCacheService.getCachedQuery(
        cacheKey,
        async () => {
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
              deposit_amount,
              remaining_amount,
              points_used,
              special_requests,
              created_at,
              updated_at
            `, { count: 'planned' })
            .eq('user_id', userId);

          // Apply filters
          if (filters.status) {
            // Map "upcoming" to database statuses (requested or confirmed) with future dates
            if ((filters.status as string) === 'upcoming') {
              const today = new Date().toISOString().split('T')[0];
              query = query
                .in('status', ['requested', 'confirmed'])
                .gte('reservation_date', today);
            }
            // Map "past" to any reservation with a date before today
            else if ((filters.status as string) === 'past') {
              const today = new Date().toISOString().split('T')[0];
              query = query.lt('reservation_date', today);
            }
            else {
              query = query.eq('status', filters.status as ReservationStatus);
            }
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

          console.log('[SERVICE-DEBUG-0] Query filters applied:', {
            userId,
            status: filters.status,
            shopId: filters.shopId,
            startDate: filters.startDate,
            endDate: filters.endDate,
            page,
            limit,
            offset,
            range: `${offset} to ${offset + limit - 1}`
          });

          query = query.range(offset, offset + limit - 1);

          console.log('[SERVICE-DEBUG-1] Executing Supabase query...');
          const { data: reservations, error, count } = await query;
          console.log('[SERVICE-DEBUG-2] Query result:', {
            hasData: !!reservations,
            dataLength: reservations?.length,
            hasError: !!error,
            errorMessage: error?.message,
            errorDetails: error?.details,
            errorHint: error?.hint,
            count
          });

          if (error) {
            logger.error('Error fetching user reservations', {
              userId,
              error: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            throw new Error(`Failed to fetch reservations: ${error.message}`);
          }

          const formattedReservations = reservations?.map(reservation => ({
            id: reservation.id,
            shopId: reservation.shop_id,
            userId: reservation.user_id,
            reservationDate: reservation.reservation_date,
            reservationTime: reservation.reservation_time,
            status: reservation.status,
            totalAmount: reservation.total_amount,
            depositAmount: reservation.deposit_amount,
            remainingAmount: reservation.remaining_amount,
            pointsUsed: reservation.points_used,
            specialRequests: reservation.special_requests,
            createdAt: reservation.created_at,
            updatedAt: reservation.updated_at
          })) || [];

          return {
            reservations: formattedReservations,
            total: count || 0
          };
        },
        {
          namespace: 'reservation',
          ttl: 300, // 5 minutes
        }
      );

      return {
        reservations: result.reservations,
        total: result.total,
        page,
        limit
      };
    } catch (error) {
      logger.error('Error in getUserReservations', { userId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Cancel reservation with enhanced automatic refund processing
   */
  async cancelReservation(
    reservationId: string, 
    userId: string, 
    reason?: string,
    cancellationType: 'user_request' | 'shop_request' | 'no_show' | 'admin_force' = 'user_request',
    refundPreference?: 'full_refund' | 'partial_refund' | 'no_refund'
  ): Promise<Reservation> {
    try {
      // Check if user can cancel the reservation
      const canCancel = await this.canCancelReservation(reservationId, userId);
      if (!canCancel.canCancel) {
        throw new Error(canCancel.reason || 'Cannot cancel this reservation');
      }

      // Process automatic refunds with dynamic calculation before cancelling reservation
      let refundResult = null;
      let refundCalculation = null;
      try {
        // Import services for dynamic refund processing
        const { refundService } = await import('./refund.service');
        const { timezoneRefundService } = await import('./timezone-refund.service');

        // Calculate dynamic refund amount
        const dynamicRefundRequest = {
          reservationId,
          userId,
          cancellationType,
          cancellationReason: reason,
          refundPreference
        };

        refundCalculation = await timezoneRefundService.calculateRefundAmount(dynamicRefundRequest);
        
        logger.info('Dynamic refund calculation completed', {
          reservationId,
          refundAmount: refundCalculation.refundAmount,
          refundPercentage: refundCalculation.refundPercentage,
          isEligible: refundCalculation.isEligible,
          cancellationWindow: refundCalculation.cancellationWindow
        });

        // Process refunds if eligible
        if (refundCalculation.isEligible && refundCalculation.refundAmount > 0) {
          refundResult = await refundService.processDynamicRefund(dynamicRefundRequest);
          
          logger.info('Automatic refund processing completed', {
            reservationId,
            refundAmount: refundCalculation.refundAmount,
            refundPercentage: refundCalculation.refundPercentage,
            refundId: refundResult.refundId,
            refundStatus: refundResult.status
          });
        } else {
          logger.info('Refund not eligible or amount is zero', {
            reservationId,
            reason: refundCalculation.reason,
            isEligible: refundCalculation.isEligible,
            refundAmount: refundCalculation.refundAmount
          });
        }

      } catch (refundError) {
        logger.error('Failed to process automatic refunds during cancellation', {
          reservationId,
          error: refundError instanceof Error ? refundError.message : 'Unknown error',
          cancellationType,
          refundPreference
        });
        // Continue with cancellation even if refund fails - can be handled separately
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

      // Create comprehensive cancellation audit trail
      await this.createCancellationAuditTrail({
        reservationId,
        userId,
        reason,
        cancellationType,
        refundPreference,
        refundCalculation,
        refundResult,
        canCancelResult: canCancel
      });

      logger.info('Reservation cancelled successfully with enhanced refund processing', {
        reservationId,
        userId,
        reason,
        cancellationType,
        refundProcessed: !!refundResult,
        refundAmount: refundCalculation?.refundAmount || 0,
        refundPercentage: refundCalculation?.refundPercentage || 0,
        refundEligibility: refundCalculation?.isEligible || false
      });

      return {
        id: reservation.id,
        shopId: reservation.shop_id,
        userId: reservation.user_id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        status: reservation.status,
        totalAmount: reservation.total_amount,
        depositAmount: reservation.deposit_amount,
        remainingAmount: reservation.remaining_amount,
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
   * Create comprehensive cancellation audit trail with refund processing details
   */
  private async createCancellationAuditTrail(params: {
    reservationId: string;
    userId: string;
    reason?: string;
    cancellationType: string;
    refundPreference?: string;
    refundCalculation?: any;
    refundResult?: any;
    canCancelResult?: any;
  }): Promise<void> {
    try {
      const { formatKoreanDateTime, getCurrentKoreanTime } = await import('../utils/korean-timezone');
      
      await this.supabase
        .from('enhanced_cancellation_audit_log')
        .insert({
          reservation_id: params.reservationId,
          user_id: params.userId,
          cancellation_type: params.cancellationType,
          cancellation_reason: params.reason,
          refund_preference: params.refundPreference,
          refund_amount: params.refundCalculation?.refundAmount || 0,
          refund_percentage: params.refundCalculation?.refundPercentage || 0,
          refund_eligible: params.refundCalculation?.isEligible || false,
          refund_window: params.refundCalculation?.cancellationWindow || 'unknown',
          refund_processed: !!params.refundResult,
          refund_id: params.refundResult?.refundId || null,
          refund_status: params.refundResult?.status || 'not_processed',
          cancellation_eligible: params.canCancelResult?.canCancel || false,
          cancellation_reason_detail: params.canCancelResult?.reason || null,
          korean_current_time: params.refundCalculation?.koreanTimeInfo?.currentTime || formatKoreanDateTime(getCurrentKoreanTime()),
          korean_reservation_time: params.refundCalculation?.koreanTimeInfo?.reservationTime || 'unknown',
          timezone: params.refundCalculation?.koreanTimeInfo?.timeZone || 'Asia/Seoul (KST)',
          business_rules: params.refundCalculation?.businessRules || null,
          refund_calculation_details: params.refundCalculation || null,
          refund_processing_details: params.refundResult || null,
          created_at: formatKoreanDateTime(getCurrentKoreanTime())
        });

      logger.info('Enhanced cancellation audit trail created', {
        reservationId: params.reservationId,
        cancellationType: params.cancellationType,
        refundAmount: params.refundCalculation?.refundAmount || 0,
        refundProcessed: !!params.refundResult
      });

    } catch (error) {
      logger.error('Failed to create enhanced cancellation audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservationId
      });
      // Don't throw - audit trail failure shouldn't break cancellation
    }
  }

  /**
   * Check if user can cancel a reservation with Korean timezone-aware calculations
   */
  async canCancelReservation(reservationId: string, userId: string): Promise<{
    canCancel: boolean;
    reason?: string;
    refundEligibility?: {
      isEligible: boolean;
      refundPercentage: number;
      hoursUntilReservation: number;
      cancellationWindow: string;
      reason: string;
      koreanTimeInfo: {
        currentTime: string;
        reservationTime: string;
        timeZone: string;
      };
    };
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

      // Import Korean timezone utilities
      const { calculateRefundEligibility, getCurrentKoreanTime } = await import('../utils/korean-timezone');
      
      // Calculate refund eligibility using Korean timezone
      const refundEligibility = calculateRefundEligibility(
        new Date(reservation.reservationDate),
        reservation.reservationTime,
        getCurrentKoreanTime()
      );

      // Determine if cancellation is allowed based on refund eligibility
      // Allow cancellation if at least 2 hours before reservation (even with reduced refund)
      const canCancel = refundEligibility.hoursUntilReservation >= 2;
      
      if (!canCancel) {
        return { 
          canCancel: false, 
          reason: refundEligibility.reason,
          refundEligibility 
        };
      }

      return { 
        canCancel: true,
        refundEligibility 
      };
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