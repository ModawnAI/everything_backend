/**
 * Time Slot Service
 * 
 * Handles intelligent time slot calculation for reservation system
 * Generates available booking slots based on shop operating hours,
 * service durations, and existing reservations
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  duration: number;
  isAvailable: boolean;
  conflictingReservations?: string[];
}

export interface TimeSlotRequest {
  shopId: string;
  date: string;
  serviceIds: string[];
  startTime?: string;
  endTime?: string;
  interval?: number; // minutes
}

export interface ShopOperatingHours {
  shopId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  openTime: string; // HH:MM format
  closeTime: string; // HH:MM format
  isOpen: boolean;
}

export interface ServiceDuration {
  serviceId: string;
  durationMinutes: number;
  bufferMinutes: number;
}

export class TimeSlotService {
  private supabase = getSupabaseClient();

  // Default operating hours (9 AM - 6 PM)
  private readonly DEFAULT_OPERATING_HOURS = {
    openTime: '09:00',
    closeTime: '18:00',
    interval: 30 // 30-minute intervals
  };

  // Buffer time between appointments (minutes)
  private readonly BUFFER_TIME = 15;

  /**
   * Get available time slots for a shop on a specific date
   */
  async getAvailableTimeSlots(request: TimeSlotRequest): Promise<TimeSlot[]> {
    try {
      const { shopId, date, serviceIds, startTime, endTime, interval = 30 } = request;

      // Validate inputs
      if (!shopId || !date || !serviceIds.length) {
        throw new Error('Missing required parameters: shopId, date, or serviceIds');
      }

      // Get shop operating hours
      const operatingHours = await this.getShopOperatingHours(shopId, date);
      if (!operatingHours.isOpen) {
        return [];
      }

      // Get service durations
      const serviceDurations = await this.getServiceDurations(serviceIds);
      const maxDuration = Math.max(...serviceDurations.map(s => s.durationMinutes + s.bufferMinutes));

      // Get existing reservations for the date
      const existingReservations = await this.getExistingReservations(shopId, date);

      // Generate time slots
      const timeSlots = this.generateTimeSlots(
        operatingHours,
        maxDuration,
        interval,
        startTime,
        endTime
      );

      // Check availability for each slot
      const availableSlots = await this.checkSlotAvailability(
        timeSlots,
        existingReservations,
        serviceDurations
      );

      logger.info('Time slots generated successfully:', {
        shopId,
        date,
        totalSlots: timeSlots.length,
        availableSlots: availableSlots.filter(s => s.isAvailable).length
      });

      return availableSlots;

    } catch (error) {
      logger.error('TimeSlotService.getAvailableTimeSlots error:', { request, error });
      throw error;
    }
  }

  /**
   * Get shop operating hours for a specific date
   */
  private async getShopOperatingHours(shopId: string, date: string): Promise<ShopOperatingHours> {
    try {
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay();

      // Get shop operating hours from database
      const { data: shopHours, error } = await this.supabase
        .from('shop_operating_hours')
        .select('*')
        .eq('shop_id', shopId)
        .eq('day_of_week', dayOfWeek)
        .single();

      if (error || !shopHours) {
        // Return default operating hours if not configured
        return {
          shopId,
          dayOfWeek,
          openTime: this.DEFAULT_OPERATING_HOURS.openTime,
          closeTime: this.DEFAULT_OPERATING_HOURS.closeTime,
          isOpen: true
        };
      }

      return {
        shopId,
        dayOfWeek,
        openTime: shopHours.open_time,
        closeTime: shopHours.close_time,
        isOpen: shopHours.is_open
      };

    } catch (error) {
      logger.error('Error getting shop operating hours:', { shopId, date, error });
      throw error;
    }
  }

  /**
   * Get service durations for the requested services
   */
  private async getServiceDurations(serviceIds: string[]): Promise<ServiceDuration[]> {
    try {
      const { data: services, error } = await this.supabase
        .from('shop_services')
        .select('id, duration_minutes')
        .in('id', serviceIds)
        .eq('is_available', true);

      if (error) {
        logger.error('Error getting service durations:', { serviceIds, error });
        throw error;
      }

      return services.map(service => ({
        serviceId: service.id,
        durationMinutes: service.duration_minutes || 60,
        bufferMinutes: this.BUFFER_TIME
      }));

    } catch (error) {
      logger.error('Error getting service durations:', { serviceIds, error });
      throw error;
    }
  }

  /**
   * Get existing reservations for the shop on the specified date
   */
  private async getExistingReservations(shopId: string, date: string): Promise<any[]> {
    try {
      const { data: reservations, error } = await this.supabase
        .from('reservations')
        .select(`
          id,
          reservation_date,
          reservation_time,
          status,
          reservation_services (
            service_id,
            quantity
          )
        `)
        .eq('shop_id', shopId)
        .eq('reservation_date', date)
        .in('status', ['requested', 'confirmed']);

      if (error) {
        logger.error('Error getting existing reservations:', { shopId, date, error });
        throw error;
      }

      return reservations || [];

    } catch (error) {
      logger.error('Error getting existing reservations:', { shopId, date, error });
      throw error;
    }
  }

  /**
   * Generate time slots based on operating hours
   */
  private generateTimeSlots(
    operatingHours: ShopOperatingHours,
    maxDuration: number,
    interval: number,
    startTime?: string,
    endTime?: string
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    // Parse operating hours
    const openTime = startTime || operatingHours.openTime;
    const closeTime = endTime || operatingHours.closeTime;
    
    const openMinutes = this.timeToMinutes(openTime);
    const closeMinutes = this.timeToMinutes(closeTime);
    
    // Generate slots at specified intervals
    for (let time = openMinutes; time <= closeMinutes - maxDuration; time += interval) {
      const slotStart = this.minutesToTime(time);
      const slotEnd = this.minutesToTime(time + maxDuration);
      
      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        duration: maxDuration,
        isAvailable: true
      });
    }

    return slots;
  }

  /**
   * Check availability for each time slot
   */
  private async checkSlotAvailability(
    timeSlots: TimeSlot[],
    existingReservations: any[],
    serviceDurations: ServiceDuration[]
  ): Promise<TimeSlot[]> {
    const availableSlots: TimeSlot[] = [];

    for (const slot of timeSlots) {
      const slotStart = new Date(`2000-01-01 ${slot.startTime}`);
      const slotEnd = new Date(`2000-01-01 ${slot.endTime}`);
      
      const conflictingReservations: string[] = [];

      // Check for conflicts with existing reservations
      for (const reservation of existingReservations) {
        const reservationStart = new Date(`2000-01-01 ${reservation.reservation_time}`);
        
        // Calculate reservation end time based on services
        let reservationDuration = 0;
        for (const service of reservation.reservation_services) {
          const serviceDuration = serviceDurations.find(s => s.serviceId === service.service_id);
          if (serviceDuration) {
            reservationDuration += serviceDuration.durationMinutes * service.quantity;
          }
        }
        
        const reservationEnd = new Date(reservationStart.getTime() + reservationDuration * 60000);

        // Check for overlap
        if (this.timesOverlap(slotStart, slotEnd, reservationStart, reservationEnd)) {
          conflictingReservations.push(reservation.id);
        }
      }

      // Slot is available if no conflicts
      slot.isAvailable = conflictingReservations.length === 0;
      if (conflictingReservations.length > 0) {
        slot.conflictingReservations = conflictingReservations;
      }

      availableSlots.push(slot);
    }

    return availableSlots;
  }

  /**
   * Check if two time ranges overlap
   */
  private timesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Convert time string (HH:MM) to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes to time string (HH:MM)
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Get next available time slot for a specific service
   */
  async getNextAvailableSlot(
    shopId: string,
    serviceId: string,
    preferredDate?: string
  ): Promise<TimeSlot | null> {
    try {
      // Start from today if no preferred date
      const startDate = preferredDate || new Date().toISOString().split('T')[0];
      
      // Check next 7 days
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(checkDate.getDate() + i);
        const dateString = checkDate.toISOString().split('T')[0];

        const slots = await this.getAvailableTimeSlots({
          shopId,
          date: dateString,
          serviceIds: [serviceId]
        });

        const availableSlot = slots.find(slot => slot.isAvailable);
        if (availableSlot) {
          return availableSlot;
        }
      }

      return null;

    } catch (error) {
      logger.error('TimeSlotService.getNextAvailableSlot error:', { shopId, serviceId, preferredDate, error });
      throw error;
    }
  }

  /**
   * Check if a specific time slot is available
   */
  async isSlotAvailable(
    shopId: string,
    date: string,
    time: string,
    serviceIds: string[]
  ): Promise<boolean> {
    try {
      const slots = await this.getAvailableTimeSlots({
        shopId,
        date,
        serviceIds
      });

      return slots.some(slot => 
        slot.startTime === time && slot.isAvailable
      );

    } catch (error) {
      logger.error('TimeSlotService.isSlotAvailable error:', { shopId, date, time, serviceIds, error });
      throw error;
    }
  }

  /**
   * Get shop operating hours for the week
   */
  async getShopWeeklyHours(shopId: string): Promise<ShopOperatingHours[]> {
    try {
      const { data: weeklyHours, error } = await this.supabase
        .from('shop_operating_hours')
        .select('*')
        .eq('shop_id', shopId)
        .order('day_of_week');

      if (error) {
        logger.error('Error getting shop weekly hours:', { shopId, error });
        throw error;
      }

      return weeklyHours || [];

    } catch (error) {
      logger.error('Error getting shop weekly hours:', { shopId, error });
      throw error;
    }
  }

  /**
   * Update shop operating hours
   */
  async updateShopOperatingHours(
    shopId: string,
    operatingHours: Omit<ShopOperatingHours, 'shopId'>[]
  ): Promise<void> {
    try {
      // Delete existing hours
      await this.supabase
        .from('shop_operating_hours')
        .delete()
        .eq('shop_id', shopId);

      // Insert new hours
      const hoursToInsert = operatingHours.map(hours => ({
        shop_id: shopId,
        day_of_week: hours.dayOfWeek,
        open_time: hours.openTime,
        close_time: hours.closeTime,
        is_open: hours.isOpen
      }));

      const { error } = await this.supabase
        .from('shop_operating_hours')
        .insert(hoursToInsert);

      if (error) {
        logger.error('Error updating shop operating hours:', { shopId, error });
        throw error;
      }

      logger.info('Shop operating hours updated successfully:', { shopId });

    } catch (error) {
      logger.error('Error updating shop operating hours:', { shopId, error });
      throw error;
    }
  }

  /**
   * Get time slot statistics for a shop
   */
  async getTimeSlotStats(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalSlots: number;
    availableSlots: number;
    bookedSlots: number;
    utilizationRate: number;
  }> {
    try {
      let totalSlots = 0;
      let availableSlots = 0;
      let bookedSlots = 0;

      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
        const dateString = date.toISOString().split('T')[0];
        
        // Get all services for the shop
        const { data: services } = await this.supabase
          .from('shop_services')
          .select('id')
          .eq('shop_id', shopId)
          .eq('is_available', true);

        if (services && services.length > 0) {
          const serviceIds = services.map(s => s.id);
          const slots = await this.getAvailableTimeSlots({
            shopId,
            date: dateString,
            serviceIds
          });

          totalSlots += slots.length;
          availableSlots += slots.filter(s => s.isAvailable).length;
          bookedSlots += slots.filter(s => !s.isAvailable).length;
        }
      }

      const utilizationRate = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;

      return {
        totalSlots,
        availableSlots,
        bookedSlots,
        utilizationRate
      };

    } catch (error) {
      logger.error('TimeSlotService.getTimeSlotStats error:', { shopId, startDate, endDate, error });
      throw error;
    }
  }
}

export const timeSlotService = new TimeSlotService(); 