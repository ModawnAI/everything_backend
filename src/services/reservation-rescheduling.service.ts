/**
 * Reservation Rescheduling Service
 * 
 * Handles flexible rescheduling of reservations with:
 * - Availability checking for new time slots
 * - Validation for rescheduling restrictions
 * - Conflict detection when moving reservations
 * - Automatic notification system
 * - Fee calculation for last-minute rescheduling
 */

import { getSupabaseClient } from '../config/database';
import { timeSlotService } from './time-slot.service';
import { reservationStateMachine } from './reservation-state-machine.service';
import { logger } from '../utils/logger';
import { Reservation, ReservationStatus, ReservationRescheduleHistory } from '../types/database.types';

export interface RescheduleRequest {
  reservationId: string;
  newDate: string;
  newTime: string;
  reason?: string;
  requestedBy: 'user' | 'shop' | 'admin';
  requestedById: string;
}

export interface RescheduleValidation {
  canReschedule: boolean;
  errors: string[];
  warnings: string[];
  restrictions: string[];
  fees?: {
    rescheduleFee: number;
    reason: string;
  } | undefined;
}

export interface RescheduleResult {
  success: boolean;
  reservation?: Reservation;
  errors: string[];
  warnings: string[];
  fees?: {
    rescheduleFee: number;
    reason: string;
  } | undefined;
  notifications: {
    user: boolean;
    shop: boolean;
    admin: boolean;
  };
}

export interface RescheduleConfig {
  maxReschedulesPerReservation: number;
  minNoticePeriodHours: number;
  maxRescheduleAdvanceDays: number;
  rescheduleFees: {
    lastMinuteFee: number; // Fee for rescheduling within 24 hours
    sameDayFee: number; // Fee for rescheduling on the same day
    noShowRescheduleFee: number; // Fee for rescheduling after no-show
  };
  allowedStatuses: string[];
  restrictedStatuses: string[];
}

export interface RescheduleHistory {
  id: string;
  reservationId: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  reason?: string | undefined;
  requestedBy: 'user' | 'shop' | 'admin';
  requestedById: string;
  fees?: number | undefined;
  timestamp: string;
}

export class ReservationReschedulingService {
  private supabase = getSupabaseClient();

  // Default configuration
  private readonly defaultConfig: RescheduleConfig = {
    maxReschedulesPerReservation: 3,
    minNoticePeriodHours: 2,
    maxRescheduleAdvanceDays: 30,
    rescheduleFees: {
      lastMinuteFee: 5000, // 5,000 won
      sameDayFee: 10000, // 10,000 won
      noShowRescheduleFee: 15000 // 15,000 won
    },
    allowedStatuses: ['requested', 'confirmed'],
    restrictedStatuses: ['completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show']
  };

  constructor(private config: Partial<RescheduleConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
    
    // Initialize monitoring and metrics
    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring and metrics for rescheduling operations
   */
  private initializeMonitoring(): void {
    logger.info('Initializing Reservation Rescheduling Service monitoring', {
      service: 'ReservationReschedulingService',
      config: {
        maxReschedulesPerReservation: this.config.maxReschedulesPerReservation,
        minNoticePeriodHours: this.config.minNoticePeriodHours,
        maxRescheduleAdvanceDays: this.config.maxRescheduleAdvanceDays,
        allowedStatuses: this.config.allowedStatuses
      }
    });
  }

  /**
   * Log rescheduling operation metrics
   */
  private logReschedulingMetrics(
    operation: string,
    details: any,
    success: boolean,
    duration?: number
  ): void {
    const metrics = {
      service: 'ReservationReschedulingService',
      operation,
      success,
      timestamp: new Date().toISOString(),
      duration: duration ? `${duration}ms` : undefined,
      ...details
    };

    if (success) {
      logger.info('Rescheduling operation completed', metrics);
    } else {
      logger.error('Rescheduling operation failed', metrics);
    }

    // Additional monitoring integration could be added here
    // e.g., sending to external monitoring services
  }

  /**
   * Validate if a reservation can be rescheduled
   */
  async validateRescheduleRequest(request: RescheduleRequest): Promise<RescheduleValidation> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const restrictions: string[] = [];

    logger.info('Starting reschedule request validation', {
      reservationId: request.reservationId,
      newDateTime: `${request.newDate} ${request.newTime}`,
      requestedBy: request.requestedBy,
      requestedById: request.requestedById,
      reason: request.reason
    });

    try {
      // Get reservation details
      const reservation = await this.getReservationById(request.reservationId);
      if (!reservation) {
        return {
          canReschedule: false,
          errors: ['Reservation not found'],
          warnings: [],
          restrictions: []
        };
      }

      // Check if reservation is in a reschedulable status
      if (!this.defaultConfig.allowedStatuses.includes(reservation.status)) {
        return {
          canReschedule: false,
          errors: [`Reservation cannot be rescheduled in status: ${reservation.status}`],
          warnings: [],
          restrictions: []
        };
      }

      // Check reschedule count
      const rescheduleCount = await this.getRescheduleCount(request.reservationId);
      if (rescheduleCount >= this.defaultConfig.maxReschedulesPerReservation) {
        return {
          canReschedule: false,
          errors: [`Maximum reschedules (${this.defaultConfig.maxReschedulesPerReservation}) exceeded`],
          warnings: [],
          restrictions: []
        };
      }

      // Validate new date and time
      const dateTimeValidation = this.validateNewDateTime(request.newDate, request.newTime);
      errors.push(...dateTimeValidation.errors);
      warnings.push(...dateTimeValidation.warnings);

      // Check notice period
      const noticeValidation = this.validateNoticePeriod(reservation, request.newDate, request.newTime);
      errors.push(...noticeValidation.errors);
      warnings.push(...noticeValidation.warnings);

      // Check if new slot is available
      const availabilityValidation = await this.validateSlotAvailability(
        reservation.shop_id,
        request.newDate,
        request.newTime,
        request.reservationId
      );
      errors.push(...availabilityValidation.errors);
      warnings.push(...availabilityValidation.warnings);

      // Calculate fees with timezone-aware refund policy integration
      const fees = await this.calculateRescheduleFees(reservation, request.newDate, request.newTime, request.requestedBy);

      // Check permissions
      const permissionValidation = await this.validatePermissions(reservation, request.requestedBy, request.requestedById);
      errors.push(...permissionValidation.errors);

      // Add warnings and shop approval requirements
      warnings.push(...permissionValidation.warnings);
      
      if (permissionValidation.requiresShopApproval) {
        warnings.push('샵 운영자의 승인이 필요합니다. 승인 후 변경이 진행됩니다.');
      }

      const result = {
        canReschedule: errors.length === 0,
        errors,
        warnings,
        restrictions: restrictions,
        fees,
        requiresShopApproval: permissionValidation.requiresShopApproval
      };

      const duration = Date.now() - startTime;
      this.logReschedulingMetrics('validateRescheduleRequest', {
        reservationId: request.reservationId,
        canReschedule: result.canReschedule,
        errorsCount: errors.length,
        warningsCount: warnings.length,
        restrictionsCount: restrictions.length,
        hasFees: !!fees,
        requiresShopApproval: permissionValidation.requiresShopApproval
      }, result.canReschedule, duration);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logReschedulingMetrics('validateRescheduleRequest', {
        reservationId: request.reservationId,
        error: (error as Error).message
      }, false, duration);

      logger.error('Error validating reschedule request:', { request, error: (error as Error).message });
      return {
        canReschedule: false,
        errors: ['예약 변경 요청 검증 중 오류가 발생했습니다.'],
        warnings: [],
        restrictions: []
      };
    }
  }

  /**
   * Execute reschedule request with enhanced concurrent booking prevention
   */
  async rescheduleReservation(request: RescheduleRequest): Promise<RescheduleResult> {
    const startTime = Date.now();
    let lockAcquired = false;
    let lockId: string | null = null;

    logger.info('Starting reschedule reservation execution', {
      reservationId: request.reservationId,
      newDateTime: `${request.newDate} ${request.newTime}`,
      requestedBy: request.requestedBy,
      requestedById: request.requestedById,
      reason: request.reason
    });

    try {
      // Validate the request
      const validation = await this.validateRescheduleRequest(request);
      if (!validation.canReschedule) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
          notifications: { user: false, shop: false, admin: false }
        };
      }

      // Get current reservation
      const reservation = await this.getReservationById(request.reservationId);
      if (!reservation) {
        return {
          success: false,
          errors: ['예약을 찾을 수 없습니다.'],
          warnings: [],
          notifications: { user: false, shop: false, admin: false }
        };
      }

      // Acquire advisory lock for reschedule operation
      lockId = await this.acquireRescheduleLock(request.reservationId, reservation.shop_id);
      if (!lockId) {
        return {
          success: false,
          errors: ['다른 사용자가 현재 이 예약을 변경하고 있습니다. 잠시 후 다시 시도해주세요.'],
          warnings: [],
          notifications: { user: false, shop: false, admin: false }
        };
      }
      lockAcquired = true;

      // Double-check slot availability with lock held
      const finalSlotValidation = await this.validateSlotAvailabilityWithLock(
        reservation.shop_id,
        request.newDate,
        request.newTime,
        request.reservationId,
        lockId
      );

      if (!finalSlotValidation.available) {
        return {
          success: false,
          errors: ['선택한 시간 슬롯이 더 이상 사용할 수 없습니다.'],
          warnings: finalSlotValidation.warnings,
          notifications: { user: false, shop: false, admin: false }
        };
      }

      // Execute reschedule with enhanced transaction
      const { data: updatedReservation, error } = await this.supabase.rpc('reschedule_reservation_with_lock', {
        p_reservation_id: request.reservationId,
        p_new_date: request.newDate,
        p_new_time: request.newTime,
        p_reason: request.reason,
        p_requested_by: request.requestedBy,
        p_requested_by_id: request.requestedById,
        p_fees: validation.fees?.rescheduleFee || 0,
        p_lock_id: lockId,
        p_enable_conflict_detection: true
      });

      if (error) {
        logger.error('Error rescheduling reservation with lock:', { 
          request, 
          lockId,
          error: error.message 
        });

        // Handle specific error types
        if (error.message?.includes('SLOT_CONFLICT')) {
        return {
          success: false,
            errors: ['선택한 시간 슬롯이 다른 예약과 충돌합니다.'],
            warnings: [],
            notifications: { user: false, shop: false, admin: false }
          };
        } else if (error.message?.includes('LOCK_TIMEOUT')) {
          return {
            success: false,
            errors: ['예약 변경 처리 시간이 초과되었습니다. 다시 시도해주세요.'],
            warnings: [],
            notifications: { user: false, shop: false, admin: false }
          };
        } else if (error.message?.includes('VERSION_CONFLICT')) {
          return {
            success: false,
            errors: ['예약 정보가 변경되었습니다. 페이지를 새로고침 후 다시 시도해주세요.'],
            warnings: [],
            notifications: { user: false, shop: false, admin: false }
          };
        }

        return {
          success: false,
          errors: ['예약 변경 중 오류가 발생했습니다.'],
          warnings: [],
          notifications: { user: false, shop: false, admin: false }
        };
      }

      // Log reschedule history
      await this.logRescheduleHistory({
        reservationId: request.reservationId,
        oldDate: reservation.reservation_date || '',
        oldTime: reservation.reservation_time || '',
        newDate: request.newDate,
        newTime: request.newTime,
        reason: request.reason,
        requestedBy: request.requestedBy,
        requestedById: request.requestedById,
        fees: validation.fees?.rescheduleFee
      });

      // Send notifications
      const notifications = await this.sendRescheduleNotifications(
        updatedReservation,
        request,
        validation.fees
      );

      logger.info('Reservation rescheduled successfully:', {
        reservationId: request.reservationId,
        oldDateTime: `${reservation.reservation_date} ${reservation.reservation_time}`,
        newDateTime: `${request.newDate} ${request.newTime}`,
        requestedBy: request.requestedBy,
        lockId
      });

      const result = {
        success: true,
        reservation: updatedReservation,
        errors: [],
        warnings: validation.warnings,
        fees: validation.fees,
        notifications
      };

      const duration = Date.now() - startTime;
      this.logReschedulingMetrics('rescheduleReservation', {
        reservationId: request.reservationId,
        success: true,
        lockAcquired,
        lockId,
        hasFees: !!validation.fees,
        notificationsSent: {
          user: notifications.user,
          shop: notifications.shop,
          admin: notifications.admin
        }
      }, true, duration);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logReschedulingMetrics('rescheduleReservation', {
        reservationId: request.reservationId,
        success: false,
        lockAcquired,
        lockId,
        error: (error as Error).message
      }, false, duration);

      logger.error('Error in rescheduleReservation:', { 
        request, 
        lockId,
        lockAcquired,
        error: (error as Error).message 
      });
      return {
        success: false,
        errors: ['예약 변경 중 오류가 발생했습니다.'],
        warnings: [],
        notifications: { user: false, shop: false, admin: false }
      };
    } finally {
      // Always release the lock if it was acquired
      if (lockAcquired && lockId) {
        try {
          await this.releaseRescheduleLock(lockId);
          logger.info('Reschedule lock released successfully', { lockId, reservationId: request.reservationId });
        } catch (lockError) {
          logger.error('Failed to release reschedule lock in finally block:', {
            lockId,
            reservationId: request.reservationId,
            error: (lockError as Error).message
          });
        }
      }
    }
  }

  /**
   * Get available reschedule slots for a reservation
   */
  async getAvailableRescheduleSlots(
    reservationId: string,
    preferredDate?: string,
    preferredTime?: string
  ): Promise<{
    slots: any[];
    restrictions: string[];
  }> {
    try {
      const reservation = await this.getReservationById(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Get services for this reservation
      const { data: reservationServices, error: servicesError } = await this.supabase
        .from('reservation_services')
        .select('service_id, quantity')
        .eq('reservation_id', reservationId);

      if (servicesError) {
        throw new Error('Failed to get reservation services');
      }

      const serviceIds = reservationServices.map(rs => rs.service_id);

      // Get available slots for the next 7 days
      const slots: any[] = [];
      const restrictions: string[] = [];
      const startDate = preferredDate || new Date().toISOString().split('T')[0];

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(checkDate.getDate() + i);
        const dateString = checkDate.toISOString().split('T')[0];

        try {
          const availableSlots = await timeSlotService.getAvailableTimeSlots({
            shopId: reservation.shop_id,
            date: dateString,
            serviceIds
          });

          // Filter out the current reservation's time slot
          const currentReservationDate = reservation.reservation_date || '';
          const currentReservationTime = reservation.reservation_time || '';
          const filteredSlots = availableSlots.filter(slot => 
            !(slot.startTime === currentReservationTime && dateString === currentReservationDate)
          );

          slots.push(...filteredSlots.map(slot => ({
            ...slot,
            date: dateString
          })));
        } catch (error) {
          logger.warn('Error getting slots for date:', { date: dateString, error: (error as Error).message });
        }
      }

      // Add restrictions based on business rules
      if (reservation.status === 'no_show') {
        restrictions.push('Additional fees may apply for rescheduling after no-show');
      }

      const currentReservationDate = reservation.reservation_date || '';
      const currentReservationTime = reservation.reservation_time || '';
      const hoursUntilReservation = this.getHoursUntilReservation(currentReservationDate, currentReservationTime);
      if (hoursUntilReservation < 24) {
        restrictions.push('Last-minute rescheduling fees may apply');
      }

      return { slots, restrictions };

    } catch (error) {
      logger.error('Error getting available reschedule slots:', { reservationId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get reschedule history for a reservation
   */
  async getRescheduleHistory(reservationId: string): Promise<RescheduleHistory[]> {
    try {
      const { data: history, error } = await this.supabase
        .from('reservation_reschedule_history')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('timestamp', { ascending: false });

      if (error) {
        logger.error('Error getting reschedule history:', { reservationId, error: error.message });
        return [];
      }

      return history || [];

    } catch (error) {
      logger.error('Error in getRescheduleHistory:', { reservationId, error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get reschedule statistics for a shop
   */
  async getRescheduleStats(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalReschedules: number;
    userRequested: number;
    shopRequested: number;
    adminRequested: number;
    totalFees: number;
    averageFees: number;
  }> {
    try {
      const { data: reschedules, error } = await this.supabase
        .from('reservation_reschedule_history')
        .select('*')
        .eq('shop_id', shopId)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (error) {
        logger.error('Error getting reschedule stats:', { shopId, error: error.message });
        return {
          totalReschedules: 0,
          userRequested: 0,
          shopRequested: 0,
          adminRequested: 0,
          totalFees: 0,
          averageFees: 0
        };
      }

      const rescheduleList = reschedules || [];
      const totalReschedules = rescheduleList.length;
      const userRequested = rescheduleList.filter(r => r.requested_by === 'user').length;
      const shopRequested = rescheduleList.filter(r => r.requested_by === 'shop').length;
      const adminRequested = rescheduleList.filter(r => r.requested_by === 'admin').length;
      const totalFees = rescheduleList.reduce((sum, r) => sum + (r.fees || 0), 0);
      const averageFees = totalReschedules > 0 ? totalFees / totalReschedules : 0;

      return {
        totalReschedules,
        userRequested,
        shopRequested,
        adminRequested,
        totalFees,
        averageFees
      };

    } catch (error) {
      logger.error('Error in getRescheduleStats:', { shopId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Validate new date and time format
   */
  private validateNewDateTime(newDate: string, newTime: string): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) {
      errors.push('Invalid date format. Use YYYY-MM-DD');
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newTime)) {
      errors.push('Invalid time format. Use HH:MM');
    }

    // Check if new date is in the past
    const newDateTime = new Date(`${newDate}T${newTime}`);
    const now = new Date();
    if (newDateTime <= now) {
      errors.push('New reservation time cannot be in the past');
    }

    // Check if new date is too far in the future
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + this.defaultConfig.maxRescheduleAdvanceDays);
    if (newDateTime > maxDate) {
      errors.push(`Cannot reschedule more than ${this.defaultConfig.maxRescheduleAdvanceDays} days in advance`);
    }

    return { errors, warnings };
  }

  /**
   * Validate notice period
   */
  private validateNoticePeriod(
    reservation: Reservation,
    newDate: string,
    newTime: string
  ): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const newDateTime = new Date(`${newDate}T${newTime}`);
    const now = new Date();
    const hoursUntilNewReservation = (newDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilNewReservation < this.defaultConfig.minNoticePeriodHours) {
      errors.push(`Must reschedule at least ${this.defaultConfig.minNoticePeriodHours} hours in advance`);
    }

    return { errors, warnings };
  }

  /**
   * Validate slot availability with enhanced conflict prevention
   */
  private async validateSlotAvailability(
    shopId: string,
    newDate: string,
    newTime: string,
    reservationId: string
  ): Promise<{
    errors: string[];
    warnings: string[];
    slotLocked?: boolean;
    conflictDetails?: any;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get services for this reservation with enhanced details
      const { data: reservationServices, error: servicesError } = await this.supabase
        .from('reservation_services')
        .select(`
          service_id,
          services!inner(
            id,
            name,
            duration_minutes,
            shop_id
          )
        `)
        .eq('reservation_id', reservationId);

      if (servicesError) {
        errors.push('예약 서비스 정보를 가져오는데 실패했습니다.');
        return { errors, warnings };
      }

      if (!reservationServices || reservationServices.length === 0) {
        errors.push('예약에 연결된 서비스가 없습니다.');
        return { errors, warnings };
      }

      const serviceIds = reservationServices.map(rs => rs.service_id);
      const services = reservationServices.map(rs => rs.services);

      // Enhanced slot validation with conflict detection
      const slotValidation = await timeSlotService.validateSlotAvailability(
        shopId,
        newDate,
        newTime,
        serviceIds
      );

      if (!slotValidation.available) {
        errors.push(`선택한 시간 슬롯을 사용할 수 없습니다: ${slotValidation.conflictReason}`);
        
        // Add detailed conflict information
        if (slotValidation.conflictingReservations && slotValidation.conflictingReservations.length > 0) {
          warnings.push(`${slotValidation.conflictingReservations.length}개의 다른 예약과 시간이 겹칩니다.`);
        }

        return { 
          errors, 
          warnings, 
          conflictDetails: {
            conflictReason: slotValidation.conflictReason,
            conflictingReservations: slotValidation.conflictingReservations,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Check if the new slot conflicts with the current reservation time
      const currentReservation = await this.getReservationById(reservationId);
      if (currentReservation) {
        const currentDateTime = `${currentReservation.reservation_date}T${currentReservation.reservation_time}`;
        const newDateTime = `${newDate}T${newTime}`;
        
        if (currentDateTime === newDateTime) {
          warnings.push('새로운 시간이 현재 예약 시간과 동일합니다.');
        }
      }

      // Enhanced capacity validation for rescheduling
      const capacityValidation = await this.validateRescheduleCapacity(
        shopId,
        newDate,
        newTime,
        services,
        reservationId
      );

      if (!capacityValidation.available) {
        errors.push(`새로운 시간 슬롯의 용량이 부족합니다: ${capacityValidation.reason}`);
        return { 
          errors, 
          warnings,
          conflictDetails: {
            conflictReason: capacityValidation.reason,
            capacityDetails: capacityValidation.details,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Check for potential conflicts with other rescheduling operations
      const concurrentConflictCheck = await this.checkConcurrentRescheduleConflicts(
        reservationId,
        newDate,
        newTime,
        shopId
      );

      if (concurrentConflictCheck.hasConflicts) {
        warnings.push('동시 예약 변경으로 인한 잠재적 충돌이 감지되었습니다.');
        warnings.push(...concurrentConflictCheck.warnings);
      }

    } catch (error) {
      logger.error('Error validating slot availability for reschedule:', {
        shopId,
        newDate,
        newTime,
        reservationId,
        error: (error as Error).message
      });
      errors.push('시간 슬롯 가용성 검증 중 오류가 발생했습니다.');
    }

    return { errors, warnings };
  }

  /**
   * Calculate reschedule fees with timezone-aware refund policy integration
   */
  private async calculateRescheduleFees(
    reservation: Reservation,
    newDate: string,
    newTime: string,
    requestedBy: 'user' | 'shop' | 'admin' = 'user'
  ): Promise<{
    rescheduleFee: number;
    reason: string;
    timezoneInfo?: any;
    refundPolicy?: any;
  } | undefined> {
    try {
      // Import timezone utilities
      const { getCurrentKoreanTime, calculateRefundEligibility } = await import('../utils/korean-timezone');
      
      // Get current Korean time
      const koreanTime = getCurrentKoreanTime();
      const newDateTime = new Date(`${newDate}T${newTime}`);
      
      // Calculate time difference in Korean timezone
      const hoursUntilNewReservation = (newDateTime.getTime() - koreanTime.getTime()) / (1000 * 60 * 60);
      const hoursUntilOriginalReservation = this.getHoursUntilReservation(
        reservation.reservation_date?.toString() || '',
        reservation.reservation_time?.toString() || ''
      );

      // Check if it's same-day rescheduling (Korean timezone)
      const isSameDay = newDate === koreanTime.toISOString().split('T')[0];
      
      // Base fee calculation
      let baseFee = 0;
      let reason = '';

      if (isSameDay) {
        baseFee = this.defaultConfig.rescheduleFees.sameDayFee;
        reason = '당일 예약 변경 수수료';
      } else if (hoursUntilNewReservation < 24) {
        baseFee = this.defaultConfig.rescheduleFees.lastMinuteFee;
        reason = '24시간 이내 예약 변경 수수료';
      } else if (hoursUntilNewReservation < 48) {
        baseFee = this.defaultConfig.rescheduleFees.lastMinuteFee * 0.5; // 50% of last-minute fee
        reason = '48시간 이내 예약 변경 수수료';
      }

      // Check if reservation was previously marked as no-show
      if (reservation.status === 'no_show') {
        baseFee = this.defaultConfig.rescheduleFees.noShowRescheduleFee;
        reason = '노쇼 후 예약 변경 수수료';
      }

      // Apply refund policy considerations
      const refundEligibility = calculateRefundEligibility(
        new Date(reservation.reservation_date?.toString() || ''),
        reservation.reservation_time?.toString() || '',
        koreanTime
      );

      // Adjust fees based on who requested the reschedule
      let adjustedFee = baseFee;
      if (requestedBy === 'shop') {
        // Shop-initiated reschedules typically don't charge fees to customers
        adjustedFee = 0;
        reason = '샵에서 요청한 예약 변경 (수수료 없음)';
      } else if (requestedBy === 'admin') {
        // Admin-initiated reschedules may have different fee structure
        adjustedFee = baseFee * 0.5; // 50% discount for admin changes
        reason = '관리자 요청 예약 변경 (할인 적용)';
      }

      // Consider refund policy impact
      let refundPolicyInfo = null;
      if (refundEligibility.refundPercentage < 100 && adjustedFee > 0) {
        // If there's a refund penalty, consider reducing reschedule fees
        const refundPenalty = (100 - refundEligibility.refundPercentage) / 100;
        const feeReduction = Math.min(adjustedFee * 0.3, adjustedFee * refundPenalty);
        adjustedFee = Math.max(0, adjustedFee - feeReduction);
        
        refundPolicyInfo = {
          originalFee: baseFee,
          refundPenalty: refundPenalty,
          feeReduction: feeReduction,
          finalFee: adjustedFee,
          reason: `환불 정책 고려 수수료 조정 (${Math.round(feeReduction)}원 할인)`
        };
        
        if (feeReduction > 0) {
          reason += ` - 환불 정책 고려 할인 적용`;
        }
      }

      // Return undefined if no fees apply
      if (adjustedFee <= 0) {
        return undefined;
      }

      return {
        rescheduleFee: Math.round(adjustedFee),
        reason: reason,
        timezoneInfo: {
          koreanTime: koreanTime.toISOString(),
          hoursUntilNewReservation: Math.round(hoursUntilNewReservation),
          hoursUntilOriginalReservation: Math.round(hoursUntilOriginalReservation),
          isSameDay: isSameDay
        },
        refundPolicy: refundPolicyInfo
      };

    } catch (error) {
      logger.error('Error calculating reschedule fees with timezone integration:', {
        reservationId: reservation.id,
        newDate,
        newTime,
        requestedBy,
        error: (error as Error).message
      });

      // Fallback to basic calculation
    const now = new Date();
    const newDateTime = new Date(`${newDate}T${newTime}`);
    const hoursUntilNewReservation = (newDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isSameDay = newDate === now.toISOString().split('T')[0];

    if (isSameDay) {
      return {
        rescheduleFee: this.defaultConfig.rescheduleFees.sameDayFee,
          reason: '당일 예약 변경 수수료 (기본 계산)'
      };
      } else if (hoursUntilNewReservation < 24) {
      return {
        rescheduleFee: this.defaultConfig.rescheduleFees.lastMinuteFee,
          reason: '24시간 이내 예약 변경 수수료 (기본 계산)'
      };
    }

    return undefined;
    }
  }

  /**
   * Validate permissions based on reservation status and requester
   */
  private async validatePermissions(
    reservation: Reservation,
    requestedBy: 'user' | 'shop' | 'admin',
    requestedById: string
  ): Promise<{
    errors: string[];
    warnings: string[];
    requiresShopApproval: boolean;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let requiresShopApproval = false;

    try {
      // Admin permissions - admins can reschedule any reservation
      if (requestedBy === 'admin') {
        return { errors: [], warnings: [], requiresShopApproval: false };
      }

      // User permissions - check ownership
      if (requestedBy === 'user') {
        if (reservation.user_id !== requestedById) {
          errors.push('사용자는 본인의 예약만 변경할 수 있습니다.');
          return { errors, warnings, requiresShopApproval: false };
        }

        // Different rules based on reservation status
        if (reservation.status === 'requested') {
          // For requested reservations, users have more flexibility
          // No additional restrictions beyond basic ownership
          return { errors: [], warnings: [], requiresShopApproval: false };
        } else if (reservation.status === 'confirmed') {
          // For confirmed reservations, stricter rules apply
          const hoursUntilReservation = this.getHoursUntilReservation(
            reservation.reservation_date.toString(),
            reservation.reservation_time.toString()
          );

          // Check if rescheduling requires shop approval
          if (hoursUntilReservation < 24) {
            requiresShopApproval = true;
            warnings.push('확정된 예약을 24시간 이내에 변경하려면 샵 운영자의 승인이 필요합니다.');
          } else if (hoursUntilReservation < 48) {
            warnings.push('확정된 예약을 48시간 이내에 변경하는 경우 수수료가 발생할 수 있습니다.');
          }

          // Check if user has exceeded reschedule limit for confirmed reservations
          const rescheduleCount = await this.getRescheduleCount(reservation.id);
          if (rescheduleCount >= 2) { // Lower limit for confirmed reservations
            errors.push('확정된 예약은 최대 2번까지만 변경 가능합니다.');
          }
        }
      }

      // Shop permissions - check shop ownership
    if (requestedBy === 'shop') {
        // Get shop details to verify ownership
        const { data: shop, error } = await this.supabase
          .from('shops')
          .select('id, owner_id, name')
          .eq('id', reservation.shop_id)
          .single();

        if (error || !shop) {
          errors.push('샵 정보를 찾을 수 없습니다.');
          return { errors, warnings, requiresShopApproval: false };
        }

        if (shop.owner_id !== requestedById) {
          errors.push('샵 운영자만 해당 샵의 예약을 변경할 수 있습니다.');
          return { errors, warnings, requiresShopApproval: false };
        }

        // Shop owners have more flexibility but still need to follow business rules
        if (reservation.status === 'confirmed') {
          const hoursUntilReservation = this.getHoursUntilReservation(
            reservation.reservation_date.toString(),
            reservation.reservation_time.toString()
          );

          // Shop owners should notify customers for last-minute changes
          if (hoursUntilReservation < 4) {
            warnings.push('4시간 이내 예약 변경 시 고객에게 즉시 알림을 보내야 합니다.');
          }
        }
      }

      return { errors, warnings, requiresShopApproval };

    } catch (error) {
      logger.error('Error validating permissions:', { 
        reservationId: reservation.id, 
        requestedBy, 
        requestedById, 
        error: (error as Error).message 
      });
      errors.push('권한 검증 중 오류가 발생했습니다.');
      return { errors, warnings, requiresShopApproval: false };
    }
  }

  /**
   * Calculate hours until reservation
   */
  private getHoursUntilReservation(reservationDate: string, reservationTime: string): number {
    try {
      const reservationDateTime = new Date(`${reservationDate}T${reservationTime}`);
      const now = new Date();
      const diffMs = reservationDateTime.getTime() - now.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60)); // Convert to hours
    } catch (error) {
      logger.error('Error calculating hours until reservation:', { reservationDate, reservationTime, error });
      return 0;
    }
  }

  /**
   * Get reschedule count for a reservation
   */
  private async getRescheduleCount(reservationId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('reservation_reschedules')
        .select('*', { count: 'exact', head: true })
        .eq('reservation_id', reservationId)
        .eq('status', 'approved');

      if (error) {
        logger.error('Error getting reschedule count:', { reservationId, error });
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('Error getting reschedule count:', { reservationId, error });
      return 0;
    }
  }

  /**
   * Acquire advisory lock for reschedule operation
   */
  private async acquireRescheduleLock(
    reservationId: string,
    shopId: string,
    timeoutMs: number = 10000
  ): Promise<string | null> {
    try {
      const lockId = `reschedule_${reservationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await this.supabase.rpc('acquire_advisory_lock', {
        p_lock_name: `reschedule_${reservationId}`,
        p_lock_id: lockId,
        p_timeout_ms: timeoutMs,
        p_operation_type: 'reschedule'
      });

      if (error) {
        logger.error('Failed to acquire reschedule lock:', {
          reservationId,
          shopId,
          lockId,
          error: error.message
        });
        return null;
      }

      if (data && data.success) {
        logger.info('Reschedule lock acquired:', {
          reservationId,
          shopId,
          lockId,
          timeoutMs
        });
        return lockId;
      }

      return null;

    } catch (error) {
      logger.error('Error acquiring reschedule lock:', {
        reservationId,
        shopId,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Release advisory lock for reschedule operation
   */
  private async releaseRescheduleLock(lockId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('release_advisory_lock', {
        p_lock_id: lockId
      });

      if (error) {
        logger.error('Failed to release reschedule lock:', {
          lockId,
          error: error.message
        });
        return false;
      }

      logger.info('Reschedule lock released:', { lockId });
      return true;

    } catch (error) {
      logger.error('Error releasing reschedule lock:', {
        lockId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Validate slot availability with lock held
   */
  private async validateSlotAvailabilityWithLock(
    shopId: string,
    newDate: string,
    newTime: string,
    reservationId: string,
    lockId: string
  ): Promise<{
    available: boolean;
    warnings: string[];
    conflictDetails?: any;
  }> {
    try {
      // Use the enhanced validation with lock context
      const validation = await this.validateSlotAvailability(shopId, newDate, newTime, reservationId);
      
      // Additional lock-specific validation
      const { data: lockValidation, error } = await this.supabase.rpc('validate_slot_with_lock', {
        p_shop_id: shopId,
        p_new_date: newDate,
        p_new_time: newTime,
        p_reservation_id: reservationId,
        p_lock_id: lockId
      });

      if (error) {
        logger.error('Lock-based slot validation failed:', {
          shopId,
          newDate,
          newTime,
          reservationId,
          lockId,
          error: error.message
        });
        return {
          available: false,
          warnings: ['시간 슬롯 검증 중 오류가 발생했습니다.']
        };
      }

      return {
        available: validation.errors.length === 0 && lockValidation?.available !== false,
        warnings: validation.warnings,
        conflictDetails: validation.conflictDetails
      };

    } catch (error) {
      logger.error('Error in lock-based slot validation:', {
        shopId,
        newDate,
        newTime,
        reservationId,
        lockId,
        error: (error as Error).message
      });
      return {
        available: false,
        warnings: ['시간 슬롯 검증 중 예상치 못한 오류가 발생했습니다.']
      };
    }
  }

  /**
   * Process reschedule fee payment with TossPayments integration
   */
  private async processRescheduleFeePayment(
    reservation: Reservation,
    fees: { rescheduleFee: number; reason: string },
    requestedBy: 'user' | 'shop' | 'admin'
  ): Promise<{
    success: boolean;
    paymentId?: string;
    error?: string;
  }> {
    try {
      // If no fees or shop/admin initiated, no payment needed
      if (!fees || fees.rescheduleFee <= 0 || requestedBy !== 'user') {
        return { success: true };
      }

      // Import PortOne service dynamically
      const { portOneService } = await import('./portone.service');
      
      // Create payment initiation request for reschedule fee
      const paymentRequest: any = {
        reservationId: reservation.id,
        userId: reservation.user_id,
        amount: fees.rescheduleFee,
        isDeposit: false,
        customerEmail: '', // Will be fetched from user data
        customerName: '', // Will be fetched from user data
        successUrl: `${process.env.FRONTEND_URL}/payment/success`,
        failUrl: `${process.env.FRONTEND_URL}/payment/fail`,
        paymentStage: 'single' as const
      };

      // Get user details for payment
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('email, name')
        .eq('id', reservation.user_id)
        .single();

      if (userError || !user) {
        logger.error('Error fetching user details for reschedule fee payment:', userError);
        return {
          success: false,
          error: '사용자 정보를 가져오는데 실패했습니다.'
        };
      }

      paymentRequest.customerEmail = user.email;
      paymentRequest.customerName = user.name;

      // Initialize payment
      const paymentResult = await portOneService.initializePayment(paymentRequest);

      if (!paymentResult || !paymentResult.paymentKey) {
        logger.error('Failed to initialize reschedule fee payment:', {
          reservationId: reservation.id,
          paymentResult
        });
        return {
          success: false,
          error: '결제 초기화에 실패했습니다.'
        };
      }

      logger.info('Reschedule fee payment initialized:', {
        reservationId: reservation.id,
        paymentId: paymentResult.paymentId,
        amount: fees.rescheduleFee,
        reason: fees.reason
      });

      return {
        success: true,
        paymentId: paymentResult.paymentId
      };

    } catch (error) {
      logger.error('Error processing reschedule fee payment:', {
        reservationId: reservation.id,
        fees,
        requestedBy,
        error: (error as Error).message
      });
      return {
        success: false,
        error: '예약 변경 수수료 처리 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * Validate reschedule capacity for the new time slot
   */
  private async validateRescheduleCapacity(
    shopId: string,
    newDate: string,
    newTime: string,
    services: any[],
    currentReservationId: string
  ): Promise<{
    available: boolean;
    reason: string;
    details?: any;
  }> {
    try {
      // Get current capacity usage for the new slot
      const { data: existingReservations, error } = await this.supabase
        .from('reservations')
        .select(`
          id,
          reservation_date,
          reservation_time,
          status,
          reservation_services!inner(
            service_id,
            services!inner(
              duration_minutes,
              name
            )
          )
        `)
        .eq('shop_id', shopId)
        .eq('reservation_date', newDate)
        .eq('status', 'confirmed')
        .neq('id', currentReservationId); // Exclude current reservation

      if (error) {
        logger.error('Error fetching existing reservations for capacity check:', error);
        return {
          available: false,
          reason: '용량 확인 중 오류가 발생했습니다.'
        };
      }

      // Calculate total duration and concurrent services
      const totalDuration = services.reduce((sum, service) => sum + (service.duration_minutes || 0), 0);
      const concurrentServices = existingReservations?.length || 0;

      // Get shop capacity limits
      const { data: shopCapacity, error: capacityError } = await this.supabase
        .from('shop_capacity_settings')
        .select('*')
        .eq('shop_id', shopId)
        .single();

      if (capacityError && capacityError.code !== 'PGRST116') {
        logger.warn('Could not fetch shop capacity settings:', capacityError);
      }

      // Check capacity limits if configured
      if (shopCapacity) {
        if (concurrentServices >= shopCapacity.max_concurrent_services) {
          return {
            available: false,
            reason: `샵이 최대 동시 서비스 한계에 도달했습니다 (${concurrentServices}/${shopCapacity.max_concurrent_services})`,
            details: {
              currentConcurrentServices: concurrentServices,
              maxConcurrentServices: shopCapacity.max_concurrent_services,
              shopCapacity
            }
          };
        }

        // Check total duration limits
        if (totalDuration > shopCapacity.max_total_duration_minutes) {
          return {
            available: false,
            reason: `총 서비스 시간이 최대 한계를 초과합니다 (${totalDuration}분/${shopCapacity.max_total_duration_minutes}분)`,
            details: {
              totalDuration,
              maxDuration: shopCapacity.max_total_duration_minutes,
              shopCapacity
            }
          };
        }
      }

      return {
        available: true,
        reason: '용량 확인 완료',
        details: {
          totalDuration,
          concurrentServices,
          shopCapacity
        }
      };

    } catch (error) {
      logger.error('Error validating reschedule capacity:', error);
      return {
        available: false,
        reason: '용량 검증 중 예상치 못한 오류가 발생했습니다.'
      };
    }
  }

  /**
   * Check for concurrent reschedule conflicts
   */
  private async checkConcurrentRescheduleConflicts(
    currentReservationId: string,
    newDate: string,
    newTime: string,
    shopId: string
  ): Promise<{
    hasConflicts: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      // Check for other reschedule requests for the same slot
      const { data: rescheduleRequests, error } = await this.supabase
        .from('reservation_reschedules')
        .select(`
          id,
          reservation_id,
          new_date,
          new_time,
          status,
          requested_at,
          reservations!inner(
            shop_id,
            user_id
          )
        `)
        .eq('new_date', newDate)
        .eq('new_time', newTime)
        .eq('status', 'pending')
        .neq('reservation_id', currentReservationId)
        .eq('reservations.shop_id', shopId);

      if (error) {
        logger.error('Error checking concurrent reschedule conflicts:', error);
        return { hasConflicts: false, warnings: [] };
      }

      if (rescheduleRequests && rescheduleRequests.length > 0) {
        warnings.push(`${rescheduleRequests.length}개의 다른 예약 변경 요청이 같은 시간 슬롯을 요청하고 있습니다.`);
        
        // Check if any are very recent (within last 5 minutes)
        const recentRequests = rescheduleRequests.filter(req => {
          const requestedAt = new Date(req.requested_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          return requestedAt > fiveMinutesAgo;
        });

        if (recentRequests.length > 0) {
          warnings.push('최근 5분 이내에 동일한 시간 슬롯에 대한 예약 변경 요청이 있었습니다.');
        }
      }

      return {
        hasConflicts: rescheduleRequests && rescheduleRequests.length > 0,
        warnings
      };

    } catch (error) {
      logger.error('Error in concurrent reschedule conflict check:', error);
      return { hasConflicts: false, warnings: [] };
    }
  }

  /**
   * Get reservation by ID
   */
  private async getReservationById(reservationId: string): Promise<Reservation | null> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (error) {
      logger.error('Error getting reservation:', { reservationId, error: error.message });
      return null;
    }

    return data;
  }


  /**
   * Log reschedule history
   */
  private async logRescheduleHistory(history: Omit<RescheduleHistory, 'id' | 'timestamp'>): Promise<void> {
    const logEntry = {
      reservation_id: history.reservationId,
      old_date: history.oldDate,
      old_time: history.oldTime,
      new_date: history.newDate,
      new_time: history.newTime,
      reason: history.reason,
      requested_by: history.requestedBy,
      requested_by_id: history.requestedById,
      fees: history.fees,
      timestamp: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('reservation_reschedule_history')
      .insert(logEntry);

    if (error) {
      logger.error('Failed to log reschedule history:', { history, error: error.message });
    }
  }

  /**
   * Send enhanced reschedule notifications with v3.1 integration
   */
  private async sendRescheduleNotifications(
    reservation: Reservation,
    request: RescheduleRequest,
    fees?: { rescheduleFee: number; reason: string }
  ): Promise<{
    user: boolean;
    shop: boolean;
    admin: boolean;
    details?: {
      userNotification?: any;
      shopNotification?: any;
      adminNotification?: any;
    };
  }> {
    const results = {
      user: false,
      shop: false,
      admin: false,
      details: {} as any
    };

    try {
      // Get shop details for notifications
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select(`
          id,
          name,
          owner_id,
          owner:users!shops_owner_id_fkey(
            id,
            email,
            name
          )
        `)
        .eq('id', reservation.shop_id)
        .single();

      if (shopError) {
        logger.error('Error fetching shop details for notifications:', shopError);
        return results;
      }

      // Get user details
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, email, name, phone')
        .eq('id', reservation.user_id)
        .single();

      if (userError) {
        logger.error('Error fetching user details for notifications:', userError);
        return results;
      }

      // Prepare notification data
      const notificationData = {
        reservationId: reservation.id,
        shopName: shop.name,
        customerName: Array.isArray(user) ? user[0]?.name : (user as any).name,
        customerEmail: Array.isArray(user) ? user[0]?.email : (user as any).email,
        customerPhone: user.phone,
        shopOwnerEmail: Array.isArray(shop.owner) ? shop.owner[0]?.email : (shop.owner as any)?.email,
        shopOwnerName: Array.isArray(shop.owner) ? shop.owner[0]?.name : (shop.owner as any)?.name,
      oldDateTime: `${reservation.reservation_date} ${reservation.reservation_time}`,
      newDateTime: `${request.newDate} ${request.newTime}`,
      requestedBy: request.requestedBy,
        reason: request.reason,
        fees: fees,
        timestamp: new Date().toISOString()
      };

      // Send notifications based on who initiated the reschedule
      if (request.requestedBy === 'user') {
        // User-initiated reschedule - notify shop owner
        results.shop = await this.sendShopRescheduleNotification(shop, notificationData);
        
        // Also notify user with confirmation
        results.user = await this.sendUserRescheduleConfirmation(user, notificationData);

      } else if (request.requestedBy === 'shop') {
        // Shop-initiated reschedule - notify customer
        results.user = await this.sendUserRescheduleNotification(user, notificationData);
        
        // Notify shop owner with confirmation
        results.shop = await this.sendShopRescheduleConfirmation(shop, notificationData);

      } else if (request.requestedBy === 'admin') {
        // Admin-initiated reschedule - notify both user and shop
        results.user = await this.sendUserRescheduleNotification(user, notificationData);
        results.shop = await this.sendShopRescheduleNotification(shop, notificationData);
        results.admin = true;
      }

      logger.info('Reschedule notifications sent:', {
        reservationId: request.reservationId,
        requestedBy: request.requestedBy,
        results
      });

      return results;

    } catch (error) {
      logger.error('Error sending reschedule notifications:', {
        reservationId: request.reservationId,
        error: (error as Error).message
      });
      return results;
    }
  }

  /**
   * Send reschedule notification to shop owner (user-initiated)
   */
  private async sendShopRescheduleNotification(
    shop: any,
    data: any
  ): Promise<boolean> {
    try {
      // Import notification service dynamically to avoid circular dependencies
      const { notificationService } = await import('./notification.service');
      
      const template = {
        title: `예약 시간 변경 요청 - ${data.shopName}`,
        body: `${data.customerName}님이 예약 시간을 변경했습니다.\n새로운 시간: ${data.newDateTime}`,
        priority: 'medium' as const,
        category: 'reservation_reschedule',
        metadata: {
          reservationId: data.reservationId,
          shopId: shop.id,
          customerName: data.customerName,
          oldDateTime: data.oldDateTime,
          newDateTime: data.newDateTime,
          requestedBy: data.requestedBy,
          reason: data.reason
        }
      };

      const result = await notificationService.sendNotificationToUser(
        shop.owner_id,
        {
          title: template.title,
          body: template.body,
          data: template.metadata || {}
        }
      );

      return !!result;

    } catch (error) {
      logger.error('Error sending shop reschedule notification:', error);
      return false;
    }
  }

  /**
   * Send reschedule notification to user (shop/admin-initiated)
   */
  private async sendUserRescheduleNotification(
    user: any,
    data: any
  ): Promise<boolean> {
    try {
      const { notificationService } = await import('./notification.service');
      
      const template = {
        title: `예약 시간이 변경되었습니다 - ${data.shopName}`,
        body: `${data.shopName}에서 예약 시간을 변경했습니다.\n새로운 시간: ${data.newDateTime}`,
        priority: 'high' as const,
        category: 'reservation_reschedule',
        metadata: {
          reservationId: data.reservationId,
          shopId: data.shopName,
          oldDateTime: data.oldDateTime,
          newDateTime: data.newDateTime,
          requestedBy: data.requestedBy,
          reason: data.reason
        }
      };

      const result = await notificationService.sendNotificationToUser(
        user.id,
        {
          title: template.title,
          body: template.body,
          data: template.metadata || {}
        }
      );

      return !!result;

    } catch (error) {
      logger.error('Error sending user reschedule notification:', error);
      return false;
    }
  }

  /**
   * Send reschedule confirmation to user (user-initiated)
   */
  private async sendUserRescheduleConfirmation(
    user: any,
    data: any
  ): Promise<boolean> {
    try {
      const { notificationService } = await import('./notification.service');
      
      const template = {
        title: `예약 시간 변경 완료 - ${data.shopName}`,
        body: `예약 시간이 성공적으로 변경되었습니다.\n새로운 시간: ${data.newDateTime}`,
        priority: 'medium' as const,
        category: 'reservation_confirmation',
        metadata: {
          reservationId: data.reservationId,
          shopId: data.shopName,
          oldDateTime: data.oldDateTime,
          newDateTime: data.newDateTime,
          fees: data.fees
        }
      };

      const result = await notificationService.sendNotificationToUser(
        user.id,
        {
          title: template.title,
          body: template.body,
          data: template.metadata || {}
        }
      );

      return !!result;

    } catch (error) {
      logger.error('Error sending user reschedule confirmation:', error);
      return false;
    }
  }

  /**
   * Send reschedule confirmation to shop owner (shop-initiated)
   */
  private async sendShopRescheduleConfirmation(
    shop: any,
    data: any
  ): Promise<boolean> {
    try {
      const { notificationService } = await import('./notification.service');
      
      const template = {
        title: `예약 시간 변경 완료 - ${data.customerName}`,
        body: `${data.customerName}님의 예약 시간을 변경했습니다.\n새로운 시간: ${data.newDateTime}`,
        priority: 'medium' as const,
        category: 'reservation_confirmation',
        metadata: {
          reservationId: data.reservationId,
          shopId: shop.id,
          customerName: data.customerName,
          oldDateTime: data.oldDateTime,
          newDateTime: data.newDateTime
        }
      };

      const result = await notificationService.sendNotificationToUser(
        shop.owner_id,
        {
          title: template.title,
          body: template.body,
          data: template.metadata || {}
        }
      );

      return !!result;

    } catch (error) {
      logger.error('Error sending shop reschedule confirmation:', error);
      return false;
    }
  }

}

export const reservationReschedulingService = new ReservationReschedulingService(); 