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
import { customerNotificationService } from './customer-notification.service';
import { queryCacheService } from './query-cache.service';
import { batchQueryService } from './batch-query.service';
import { websocketService, ReservationUpdate } from './websocket.service';
import { PointService } from './point.service';

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
    paymentMethod?: 'card' | 'bank_transfer' | 'cash' | 'points' | 'mixed';
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

    // Fetch and validate user's booking preferences (REQUIRED for reservation)
    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .select('booking_preferences')
      .eq('id', userId)
      .single();

    if (userError) {
      logger.error('Failed to fetch user booking preferences', {
        userId,
        error: userError.message
      });
      throw new Error('Failed to verify user profile information');
    }

    const bookingPreferences = userData?.booking_preferences || {};

    // Validate that user has filled out required booking preferences
    // UPDATED: Make skin type and allergy info optional (not everyone needs to provide this)
    if (!bookingPreferences.skinType || !bookingPreferences.allergyInfo) {
      logger.info('User booking preferences incomplete but allowing reservation', {
        userId,
        hasPreferences: !!userData?.booking_preferences,
        hasSkinType: !!bookingPreferences.skinType,
        hasAllergyInfo: !!bookingPreferences.allergyInfo,
        note: 'Skin type and allergy info are optional - proceeding with reservation'
      });
      // Don't throw error - these fields are now optional
      // Users can still make reservations without this info
    }

    logger.info('User booking preferences validated', {
      userId,
      skinType: bookingPreferences.skinType,
      hasAllergyInfo: !!bookingPreferences.allergyInfo,
      hasPreferredStylist: !!bookingPreferences.preferredStylist,
      hasSpecialRequests: !!bookingPreferences.specialRequests
    });

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
      return await this.createReservationWithLock(request, pricingInfo, bookingPreferences);
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

    // NOTE: 예약 목록 캐시 우회됨 - 캐시 무효화 불필요
    // 실시간 업데이트를 위해 getUserReservations()는 항상 직접 DB 쿼리

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

    // Send notification to customer for new reservation (v3.1 flow)
    try {
      // Fetch shop details for the notification
      const { data: shopData } = await this.supabase
        .from('shops')
        .select('id, name')
        .eq('id', shopId)
        .single();

      // Fetch service details from reservation_services
      const { data: reservationServices } = await this.supabase
        .from('reservation_services')
        .select(`
          quantity,
          unit_price,
          total_price,
          shop_services(name)
        `)
        .eq('reservation_id', reservation.id);

      // Prepare service details for notification
      const serviceDetails = (reservationServices || []).map((rs: any) => ({
        serviceName: rs.shop_services?.name || 'Service',
        quantity: rs.quantity || 1,
        unitPrice: rs.unit_price || 0,
        totalPrice: rs.total_price || 0
      }));

      await customerNotificationService.notifyCustomerOfReservationUpdate({
        customerId: userId,
        reservationId: reservation.id,
        shopName: shopData?.name || 'Unknown Shop',
        reservationDate: reservationDate,
        reservationTime: reservationTime,
        totalAmount: pricingInfo.totalAmount,
        depositAmount: pricingInfo.depositAmount || 0,
        remainingAmount: pricingInfo.remainingAmount || pricingInfo.totalAmount,
        services: serviceDetails,
        specialRequests: specialRequests,
        notificationType: 'reservation_requested',
        additionalData: {
          confirmationNotes: undefined
        }
      });

      logger.info('Customer notification sent for new reservation', {
        reservationId: reservation.id,
        customerId: userId,
        shopId,
        shopName: shopData?.name
      });
    } catch (customerNotificationError) {
      // Log error but don't fail the reservation
      logger.error('Failed to send customer notification', {
        error: customerNotificationError instanceof Error ? customerNotificationError.message : 'Unknown error',
        reservationId: reservation.id,
        customerId: userId,
        shopId
      });
    }

    // Send real-time WebSocket notification to shop owner
    try {
      if (websocketService) {
        // Fetch customer details for the notification
        const { data: customer } = await this.supabase
          .from('users')
          .select('id, name, nickname, email, phone_number, profile_image_url')
          .eq('id', reservation.userId)
          .single();

        const reservationUpdate: ReservationUpdate = {
          reservationId: reservation.id,
          status: reservation.status,
          shopId: reservation.shopId,
          userId: reservation.userId,
          updateType: 'created',
          timestamp: new Date().toISOString(),
          data: {
            reservationDate: reservation.reservationDate,
            reservationTime: reservation.reservationTime,
            totalAmount: reservation.totalAmount,
            depositAmount: pricingInfo?.depositAmount,
            remainingAmount: pricingInfo?.remainingAmount,
            specialRequests: reservation.specialRequests,
            services: request.services,
            customer: customer ? {
              id: customer.id,
              name: customer.name || customer.nickname || 'Unknown',
              nickname: customer.nickname,
              email: customer.email,
              phoneNumber: customer.phone_number,
              profileImageUrl: customer.profile_image_url
            } : undefined
          }
        };

        websocketService.broadcastReservationUpdate(reservationUpdate);

        logger.info('Real-time WebSocket notification sent to shop owner with customer info', {
          reservationId: reservation.id,
          shopId: reservation.shopId,
          customerName: customer?.name || customer?.nickname
        });
      }
    } catch (wsError) {
      // Log WebSocket error but don't fail the reservation creation
      logger.error('Failed to send WebSocket notification', {
        error: wsError instanceof Error ? wsError.message : 'Unknown error',
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
  private async createReservationWithLock(request: CreateReservationRequest, pricingInfo?: any, bookingPreferences?: any): Promise<Reservation> {
    const { shopId, userId, services, reservationDate, reservationTime, specialRequests, pointsToUse = 0, paymentInfo } = request;

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

        // Handle case where RPC returns just the ID or different structure
        let reservationId: string | undefined;
        let reservationData: any = reservation;

        // Check if reservation is just the ID (string or UUID)
        if (typeof reservation === 'string') {
          reservationId = reservation;
        }
        // Check if reservation has 'id' property directly
        else if (reservation.id) {
          reservationId = reservation.id;
        }
        // Check if reservation is wrapped in another object
        else if ((reservation as any).data?.id) {
          reservationId = (reservation as any).data.id;
          reservationData = (reservation as any).data;
        }
        // Check if it's an array with first element
        else if (Array.isArray(reservation) && reservation[0]?.id) {
          reservationId = reservation[0].id;
          reservationData = reservation[0];
        }

        if (!reservationId) {
          logger.error('Could not extract reservation ID from RPC response', {
            type: typeof reservation,
            keys: reservation ? Object.keys(reservation) : []
          });
          throw new Error('Failed to get reservation ID from database');
        }

        logger.info('Reservation created successfully', {
          reservationId,
          shopId,
          userId,
          reservationDate,
          reservationTime
        });

        // Ensure we have a proper reservation object with id
        if (typeof reservationData === 'string') {
          // If RPC only returned the ID, fetch the full reservation
          const { data: fullReservation, error: fetchError } = await this.supabase
            .from('reservations')
            .select('*')
            .eq('id', reservationId)
            .single();

          if (fetchError || !fullReservation) {
            logger.error('Failed to fetch created reservation', { error: fetchError?.message, reservationId });
            throw new Error('Failed to retrieve created reservation');
          }
          reservationData = fullReservation;
        } else if (!reservationData.id) {
          reservationData.id = reservationId;
        }

        // Update reservation with booking preferences snapshot
        if (bookingPreferences && Object.keys(bookingPreferences).length > 0) {
          const { error: updateError } = await this.supabase
            .from('reservations')
            .update({ booking_preferences: bookingPreferences })
            .eq('id', reservationId);

          if (updateError) {
            logger.error('Failed to store booking preferences with reservation', {
              reservationId,
              error: updateError.message
            });
            // Don't fail the reservation, just log the error
          } else {
            logger.info('Booking preferences stored with reservation', {
              reservationId,
              skinType: bookingPreferences.skinType,
              hasAllergyInfo: !!bookingPreferences.allergyInfo
            });
            // Add booking_preferences to the returned reservation object
            reservationData.booking_preferences = bookingPreferences;
          }
        }

        // ============================================
        // Insert reservation services
        // ============================================
        if (services && services.length > 0) {
          try {
            const serviceRecords = services.map((service: any) => ({
              reservation_id: reservationId,
              service_id: service.serviceId || service.id,
              quantity: service.quantity || 1,
              unit_price: service.price || service.unitPrice || 0,
              total_price: (service.price || service.unitPrice || 0) * (service.quantity || 1),
              version: 1
            }));

            const { error: servicesError } = await this.supabase
              .from('reservation_services')
              .insert(serviceRecords);

            if (servicesError) {
              logger.error('Failed to insert reservation services', {
                reservationId,
                servicesCount: services.length,
                error: servicesError.message
              });
              // Don't fail the reservation, just log the error
            } else {
              logger.info('Reservation services inserted', {
                reservationId,
                servicesCount: services.length
              });
            }
          } catch (serviceInsertError) {
            logger.error('Error inserting reservation services', {
              reservationId,
              error: serviceInsertError instanceof Error ? serviceInsertError.message : 'Unknown error'
            });
          }
        }

        // ============================================
        // Deduct points if used
        // ============================================
        if (pointsToUse && pointsToUse > 0) {
          try {
            const pointService = new PointService();

            await pointService.deductPoints(
              userId,
              pointsToUse,
              'spent',
              'purchase',
              `예약 ${reservationId}에 포인트 사용`,
              reservationId
            );

            // Update reservation with points_used value
            await this.supabase
              .from('reservations')
              .update({ points_used: pointsToUse })
              .eq('id', reservationId);

            logger.info('Points deducted for reservation', {
              reservationId,
              userId,
              pointsUsed: pointsToUse
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to deduct points for reservation', {
              reservationId,
              userId,
              pointsToUse,
              error: errorMessage
            });
            // If points deduction fails, delete the reservation
            await this.supabase
              .from('reservations')
              .delete()
              .eq('id', reservationId);

            // Include actual error message for debugging
            throw new Error(`포인트 차감에 실패했습니다: ${errorMessage}`);
          }
        }

        // ============================================
        // Create payment record
        // ============================================
        // TODO: PortOne 결제 연동 시 실제 결제 후 payment 레코드 생성
        // 현재는 테스트용으로 예약 생성 시 바로 payment 레코드 생성
        // ============================================
        if (paymentInfo && paymentInfo.depositAmount && paymentInfo.depositAmount > 0) {
          try {
            // Map frontend payment method to database enum
            const dbPaymentMethod = paymentInfo.paymentMethod === 'bank_transfer'
              ? 'bank_transfer'
              : paymentInfo.paymentMethod || 'cash';

            // For non-cash payments, create payment record
            if (dbPaymentMethod !== 'cash') {
              const { data: paymentRecord, error: paymentError } = await this.supabase
                .from('payments')
                .insert({
                  reservation_id: reservationId,
                  user_id: userId,
                  payment_method: dbPaymentMethod, // 'card' or 'bank_transfer'
                  payment_status: 'completed', // 테스트용: 바로 completed (실제로는 pending → completed)
                  amount: paymentInfo.depositAmount,
                  currency: 'KRW',
                  payment_provider: 'manual', // TODO: PortOne 연동 시 'portone'으로 변경
                  provider_order_id: `manual_${reservationId}_${Date.now()}`,
                  is_deposit: paymentInfo.depositRequired || false,
                  payment_stage: paymentInfo.depositRequired ? 'deposit' : 'single',
                  metadata: {
                    createdAt: new Date().toISOString(),
                    isTestPayment: true, // 테스트 결제 표시
                    paymentInfo: paymentInfo
                  }
                })
                .select('id')
                .single();

              if (paymentError) {
                logger.error('Failed to create payment record', {
                  reservationId,
                  error: paymentError.message,
                  paymentInfo
                });
                // Don't fail the reservation, just log the error
              } else {
                logger.info('Payment record created successfully', {
                  reservationId,
                  paymentId: paymentRecord.id,
                  amount: paymentInfo.depositAmount,
                  method: dbPaymentMethod
                });
              }
            } else {
              logger.info('Cash payment selected - no payment record created', {
                reservationId,
                remainingAmount: paymentInfo.remainingAmount
              });
            }
          } catch (error) {
            logger.error('Error creating payment record', {
              reservationId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Don't fail the reservation
          }
        }

        return reservationData as Reservation;

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
  async getReservationById(reservationId: string): Promise<any | null> {
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
              booking_preferences,
              created_at,
              updated_at,
              shops(
                id,
                name,
                description,
                phone_number,
                email,
                address,
                detailed_address,
                postal_code,
                latitude,
                longitude,
                main_category,
                operating_hours,
                kakao_channel_url
              ),
              reservation_services(
                id,
                quantity,
                unit_price,
                total_price,
                shop_services(
                  id,
                  name,
                  description,
                  category,
                  duration_minutes
                )
              ),
              payments(
                id,
                amount,
                payment_method,
                payment_status,
                paid_at,
                portone_transaction_id
              )
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
            bookingPreferences: data.booking_preferences,
            createdAt: data.created_at,
            updatedAt: data.updated_at,

            // Shop details
            shop: data.shops && !Array.isArray(data.shops) ? {
              id: (data.shops as any).id,
              name: (data.shops as any).name,
              description: (data.shops as any).description,
              phoneNumber: (data.shops as any).phone_number,
              email: (data.shops as any).email,
              address: (data.shops as any).address,
              detailedAddress: (data.shops as any).detailed_address,
              postalCode: (data.shops as any).postal_code,
              latitude: (data.shops as any).latitude,
              longitude: (data.shops as any).longitude,
              mainCategory: (data.shops as any).main_category,
              operatingHours: (data.shops as any).operating_hours,
              kakaoChannelUrl: (data.shops as any).kakao_channel_url
            } : null,

            // Services details
            services: data.reservation_services?.map((rs: any) => ({
              id: rs.id,
              serviceId: rs.shop_services?.id,
              serviceName: rs.shop_services?.name,
              description: rs.shop_services?.description,
              category: rs.shop_services?.category,
              durationMinutes: rs.shop_services?.duration_minutes,
              quantity: rs.quantity,
              unitPrice: rs.unit_price,
              totalPrice: rs.total_price
            })) || [],

            // Payment details
            payments: data.payments?.map((p: any) => ({
              id: p.id,
              amount: p.amount,
              paymentMethod: p.payment_method,
              paymentStatus: p.payment_status,
              paidAt: p.paid_at,
              transactionId: p.portone_transaction_id
            })) || []
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
   * NOTE: Cache bypassed for real-time updates (admin changes, push notifications)
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
      const startTime = Date.now();

      // 캐시 우회: 예약 데이터는 실시간성이 중요하므로 직접 쿼리
      // admin에서 예약 변경 시 푸시 알림과 함께 즉시 반영되어야 함
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
          booking_preferences,
          created_at,
          updated_at,
          shops(
            id,
            name,
            address,
            phone_number
          ),
          reservation_services(
            id,
            quantity,
            unit_price,
            total_price,
            shop_services(
              id,
              name,
              category,
              price_min,
              price_max,
              duration_minutes
            )
          )
        `, { count: 'exact' })
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
        // Map "past" to:
        // 1. Any reservation with a date before today (regardless of status)
        // 2. Any completed/cancelled/no_show reservation (regardless of date)
        else if ((filters.status as string) === 'past') {
          const today = new Date().toISOString().split('T')[0];
          // Use OR filter: past date OR completed/cancelled/no_show status
          // Note: cancelled statuses are 'cancelled_by_shop' and 'cancelled_by_user' in the database
          query = query.or(`reservation_date.lt.${today},status.in.(completed,cancelled_by_shop,cancelled_by_user,no_show)`);
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

      // Sort by created_at (reservation request time) descending - most recent request first
      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + limit - 1);

      const { data: reservations, error, count } = await query;

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
        bookingPreferences: reservation.booking_preferences,
        createdAt: reservation.created_at,
        updatedAt: reservation.updated_at,
        // Include shop information (Supabase returns single FK relation as object or array)
        shop: reservation.shops ? {
          id: (reservation.shops as any).id ?? (reservation.shops as any)?.[0]?.id,
          name: (reservation.shops as any).name ?? (reservation.shops as any)?.[0]?.name,
          address: (reservation.shops as any).address ?? (reservation.shops as any)?.[0]?.address,
          phone: (reservation.shops as any).phone_number ?? (reservation.shops as any)?.[0]?.phone_number
        } : undefined,
        // Include services information
        services: (reservation.reservation_services || []).map((rs: any) => ({
          id: rs.id,
          quantity: rs.quantity,
          unitPrice: rs.unit_price,
          totalPrice: rs.total_price,
          service: rs.shop_services ? {
            id: rs.shop_services.id,
            name: rs.shop_services.name,
            category: rs.shop_services.category,
            priceMin: rs.shop_services.price_min,
            priceMax: rs.shop_services.price_max,
            durationMinutes: rs.shop_services.duration_minutes
          } : undefined
        }))
      })) || [];

      logger.info('getUserReservations query completed (cache bypassed)', {
        userId,
        duration: Date.now() - startTime,
        count: formattedReservations.length
      });

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

      // NOTE: 예약 목록 캐시 우회됨 - 캐시 무효화 불필요
      // 실시간 업데이트를 위해 getUserReservations()는 항상 직접 DB 쿼리

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