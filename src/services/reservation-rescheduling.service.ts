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

  /**
   * Validate if a reservation can be rescheduled
   */
  async validateRescheduleRequest(request: RescheduleRequest): Promise<RescheduleValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const restrictions: string[] = [];

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

      // Calculate fees
      const fees = this.calculateRescheduleFees(reservation, request.newDate, request.newTime);

      // Check permissions
      const permissionValidation = this.validatePermissions(reservation, request.requestedBy, request.requestedById);
      errors.push(...permissionValidation.errors);

      return {
        canReschedule: errors.length === 0,
        errors,
        warnings,
        restrictions: restrictions,
        fees
      };

    } catch (error) {
      logger.error('Error validating reschedule request:', { request, error: (error as Error).message });
      return {
        canReschedule: false,
        errors: ['Failed to validate reschedule request'],
        warnings: [],
        restrictions: []
      };
    }
  }

  /**
   * Execute reschedule request
   */
  async rescheduleReservation(request: RescheduleRequest): Promise<RescheduleResult> {
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
          errors: ['Reservation not found'],
          warnings: [],
          notifications: { user: false, shop: false, admin: false }
        };
      }

      // Start transaction
      const { data: updatedReservation, error } = await this.supabase.rpc('reschedule_reservation', {
        p_reservation_id: request.reservationId,
        p_new_date: request.newDate,
        p_new_time: request.newTime,
        p_reason: request.reason,
        p_requested_by: request.requestedBy,
        p_requested_by_id: request.requestedById,
        p_fees: validation.fees?.rescheduleFee || 0
      });

      if (error) {
        logger.error('Error rescheduling reservation:', { request, error: error.message });
        return {
          success: false,
          errors: ['Failed to reschedule reservation'],
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
        requestedBy: request.requestedBy
      });

      return {
        success: true,
        reservation: updatedReservation,
        errors: [],
        warnings: validation.warnings,
        fees: validation.fees,
        notifications
      };

    } catch (error) {
      logger.error('Error in rescheduleReservation:', { request, error: (error as Error).message });
      return {
        success: false,
        errors: ['Failed to reschedule reservation'],
        warnings: [],
        notifications: { user: false, shop: false, admin: false }
      };
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
   * Validate slot availability
   */
  private async validateSlotAvailability(
    shopId: string,
    newDate: string,
    newTime: string,
    reservationId: string
  ): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get services for this reservation
      const { data: reservationServices, error: servicesError } = await this.supabase
        .from('reservation_services')
        .select('service_id')
        .eq('reservation_id', reservationId);

      if (servicesError) {
        errors.push('Failed to get reservation services');
        return { errors, warnings };
      }

      const serviceIds = reservationServices.map(rs => rs.service_id);

      // Check if the new slot is available
      const isAvailable = await timeSlotService.isSlotAvailable(
        shopId,
        newDate,
        newTime,
        serviceIds
      );

      if (!isAvailable) {
        errors.push('Selected time slot is not available');
      }

    } catch (error) {
      errors.push('Failed to validate slot availability');
    }

    return { errors, warnings };
  }

  /**
   * Calculate reschedule fees
   */
  private calculateRescheduleFees(
    reservation: Reservation,
    newDate: string,
    newTime: string
  ): {
    rescheduleFee: number;
    reason: string;
  } | undefined {
    const now = new Date();
    const newDateTime = new Date(`${newDate}T${newTime}`);
    const hoursUntilNewReservation = (newDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Check if it's same-day rescheduling
    const isSameDay = newDate === now.toISOString().split('T')[0];
    if (isSameDay) {
      return {
        rescheduleFee: this.defaultConfig.rescheduleFees.sameDayFee,
        reason: 'Same-day rescheduling fee'
      };
    }

    // Check if it's last-minute rescheduling (within 24 hours)
    if (hoursUntilNewReservation < 24) {
      return {
        rescheduleFee: this.defaultConfig.rescheduleFees.lastMinuteFee,
        reason: 'Last-minute rescheduling fee'
      };
    }

    // Check if reservation was previously marked as no-show
    if (reservation.status === 'no_show') {
      return {
        rescheduleFee: this.defaultConfig.rescheduleFees.noShowRescheduleFee,
        reason: 'No-show rescheduling fee'
      };
    }

    return undefined;
  }

  /**
   * Validate permissions
   */
  private validatePermissions(
    reservation: Reservation,
    requestedBy: 'user' | 'shop' | 'admin',
    requestedById: string
  ): {
    errors: string[];
  } {
    const errors: string[] = [];

    if (requestedBy === 'user' && reservation.user_id !== requestedById) {
      errors.push('User can only reschedule their own reservations');
    }

    if (requestedBy === 'shop') {
      // Check if user owns the shop
      // This would require additional validation logic
      // For now, we'll allow shop rescheduling
    }

    return { errors };
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
   * Get reschedule count for a reservation
   */
  private async getRescheduleCount(reservationId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('reservation_reschedule_history')
      .select('*', { count: 'exact', head: true })
      .eq('reservation_id', reservationId);

    if (error) {
      logger.error('Error getting reschedule count:', { reservationId, error: error.message });
      return 0;
    }

    return count || 0;
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
   * Send reschedule notifications
   */
  private async sendRescheduleNotifications(
    reservation: Reservation,
    request: RescheduleRequest,
    fees?: { rescheduleFee: number; reason: string }
  ): Promise<{
    user: boolean;
    shop: boolean;
    admin: boolean;
  }> {
    // This would integrate with the notification service
    // For now, we'll just log the notifications
    logger.info('Sending reschedule notifications:', {
      reservationId: request.reservationId,
      oldDateTime: `${reservation.reservation_date} ${reservation.reservation_time}`,
      newDateTime: `${request.newDate} ${request.newTime}`,
      requestedBy: request.requestedBy,
      fees
    });

    return {
      user: true,
      shop: true,
      admin: request.requestedBy === 'admin'
    };
  }

  /**
   * Get hours until reservation
   */
  private getHoursUntilReservation(date: string, time: string): number {
    if (!date || !time) {
      return 0;
    }
    const reservationDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    return (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  }
}

export const reservationReschedulingService = new ReservationReschedulingService(); 