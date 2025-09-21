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
import { monitoringService } from './monitoring.service';

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

export interface ShopCapacity {
  shopId: string;
  maxConcurrentServices: number;
  maxConcurrentCustomers: number;
  serviceCapacityLimits: Record<string, number>; // serviceId -> max capacity
  staffAvailability: StaffAvailability[];
  equipmentAvailability: EquipmentAvailability[];
}

export interface StaffAvailability {
  staffId: string;
  name: string;
  role: string;
  workingHours: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
  maxConcurrentServices: number;
  currentLoad: number;
}

export interface EquipmentAvailability {
  equipmentId: string;
  name: string;
  type: string;
  totalQuantity: number;
  availableQuantity: number;
  requiredByServices: string[]; // service IDs that require this equipment
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

  // Cache for real-time availability validation
  private availabilityCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache TTL

  /**
   * Get available time slots for a shop on a specific date
   */
  async getAvailableTimeSlots(request: TimeSlotRequest): Promise<TimeSlot[]> {
    const startTime = Date.now();
    let success = false;

    try {
      const { shopId, date, serviceIds, startTime: reqStartTime, endTime, interval = 30 } = request;

      // Validate inputs with detailed error reporting
      if (!shopId || !date || !serviceIds.length) {
        const error = new Error('Missing required parameters: shopId, date, or serviceIds');
        monitoringService.trackError('VALIDATION_ERROR', error.message, 'getAvailableTimeSlots', 'high', {
          request,
          missingFields: {
            shopId: !shopId,
            date: !date,
            serviceIds: !serviceIds.length
          }
        });
        throw error;
      }

      // Get shop operating hours with error handling
      const operatingHours = await this.getShopOperatingHours(shopId, date);
      if (!operatingHours.isOpen) {
        logger.info('Shop is closed on requested date:', { shopId, date });
        return [];
      }

      // Get service durations with error handling
      const serviceDurations = await this.getServiceDurations(serviceIds);
      if (serviceDurations.length === 0) {
        const error = new Error('No valid services found for the provided service IDs');
        monitoringService.trackError('SERVICE_NOT_FOUND', error.message, 'getAvailableTimeSlots', 'medium', {
          shopId,
          date,
          serviceIds
        });
        throw error;
      }

      const maxDuration = Math.max(...serviceDurations.map(s => s.durationMinutes + s.bufferMinutes));

      // Get existing reservations for the date with error handling
      const existingReservations = await this.getExistingReservations(shopId, date);

      // Generate time slots
      const timeSlots = this.generateTimeSlots(
        operatingHours,
        maxDuration,
        interval,
        reqStartTime,
        endTime
      );

      // Check availability for each slot with comprehensive error handling
      const availableSlots = await this.checkSlotAvailability(
        timeSlots,
        existingReservations,
        serviceDurations
      );

      success = true;

      logger.info('Time slots generated successfully:', {
        shopId,
        date,
        totalSlots: timeSlots.length,
        availableSlots: availableSlots.filter(s => s.isAvailable).length,
        duration: Date.now() - startTime
      });

      return availableSlots;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Track error metrics
      monitoringService.trackError(
        'TIME_SLOT_GENERATION_ERROR',
        errorMessage,
        'getAvailableTimeSlots',
        'high',
        {
          request,
          duration: Date.now() - startTime,
          errorStack: error instanceof Error ? error.stack : undefined
        }
      );

      logger.error('TimeSlotService.getAvailableTimeSlots error:', { 
        request, 
        error: errorMessage,
        duration: Date.now() - startTime
      });

      // Re-throw with additional context
      throw new Error(`Failed to generate time slots: ${errorMessage}`);
    } finally {
      // Track performance metrics
      monitoringService.trackPerformance(
        'getAvailableTimeSlots',
        Date.now() - startTime,
        success,
        {
          shopId: request.shopId,
          serviceCount: request.serviceIds?.length || 0,
          date: request.date
        }
      );
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
   * Enhanced for v3.1 flow to properly handle both 'requested' and 'confirmed' statuses
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
          created_at,
          updated_at,
          reservation_services (
            service_id,
            quantity,
            services (
              duration_minutes,
              name
            )
          )
        `)
        .eq('shop_id', shopId)
        .eq('reservation_date', date)
        .in('status', ['requested', 'confirmed', 'in_progress'])
        .order('reservation_time', { ascending: true });

      if (error) {
        logger.error('Error getting existing reservations:', { shopId, date, error });
        throw error;
      }

      // Filter out cancelled or completed reservations
      const activeReservations = (reservations || []).filter(reservation => 
        ['requested', 'confirmed', 'in_progress'].includes(reservation.status)
      );

      logger.debug('Retrieved existing reservations:', {
        shopId,
        date,
        totalReservations: reservations?.length || 0,
        activeReservations: activeReservations.length,
        statuses: activeReservations.map(r => r.status)
      });

      return activeReservations;

    } catch (error) {
      logger.error('Error getting existing reservations:', { shopId, date, error });
      throw error;
    }
  }

  /**
   * Generate time slots based on operating hours with enhanced v3.1 flow support
   * Includes intelligent slot generation considering service overlap and capacity
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
    
    // Enhanced slot generation with better interval handling
    const effectiveInterval = Math.max(interval, 15); // Minimum 15-minute intervals
    const slotDuration = maxDuration + this.BUFFER_TIME; // Include buffer in slot duration
    
    // Generate slots at specified intervals with proper end time consideration
    for (let time = openMinutes; time <= closeMinutes - slotDuration; time += effectiveInterval) {
      const slotStart = this.minutesToTime(time);
      const slotEnd = this.minutesToTime(time + slotDuration);
      
      // Ensure slot doesn't exceed operating hours
      if (time + slotDuration <= closeMinutes) {
        slots.push({
          startTime: slotStart,
          endTime: slotEnd,
          duration: slotDuration,
          isAvailable: true
        });
      }
    }

    // Add additional slots for popular times (e.g., every 15 minutes during peak hours)
    if (effectiveInterval > 15) {
      const peakHours = this.getPeakHours(openMinutes, closeMinutes);
      for (const peakTime of peakHours) {
        const slotStart = this.minutesToTime(peakTime);
        const slotEnd = this.minutesToTime(peakTime + slotDuration);
        
        // Only add if it doesn't already exist and fits within operating hours
        if (peakTime + slotDuration <= closeMinutes && 
            !slots.some(slot => slot.startTime === slotStart)) {
          slots.push({
            startTime: slotStart,
            endTime: slotEnd,
            duration: slotDuration,
            isAvailable: true
          });
        }
      }
    }

    // Sort slots by start time
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return slots;
  }

  /**
   * Get peak hours for additional slot generation
   */
  private getPeakHours(openMinutes: number, closeMinutes: number): number[] {
    const peakHours: number[] = [];
    
    // Define peak hours (10 AM - 12 PM, 2 PM - 4 PM)
    const morningPeakStart = this.timeToMinutes('10:00');
    const morningPeakEnd = this.timeToMinutes('12:00');
    const afternoonPeakStart = this.timeToMinutes('14:00');
    const afternoonPeakEnd = this.timeToMinutes('16:00');
    
    // Add morning peak hours
    for (let time = Math.max(openMinutes, morningPeakStart); 
         time < Math.min(closeMinutes, morningPeakEnd); 
         time += 15) {
      peakHours.push(time);
    }
    
    // Add afternoon peak hours
    for (let time = Math.max(openMinutes, afternoonPeakStart); 
         time < Math.min(closeMinutes, afternoonPeakEnd); 
         time += 15) {
      peakHours.push(time);
    }
    
    return peakHours;
  }

  /**
   * Check availability for each time slot with enhanced v3.1 flow support
   * Includes proper service overlap detection, capacity management, and 15-minute buffers
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
      let conflictReason = '';

      // Check for conflicts with existing reservations
      for (const reservation of existingReservations) {
        const reservationStart = new Date(`2000-01-01 ${reservation.reservation_time}`);
        
        // Calculate reservation end time based on services with proper duration handling
        let reservationDuration = 0;
        let reservationBuffer = 0;
        
        for (const service of reservation.reservation_services) {
          // Get service duration from the nested service data or fallback to serviceDurations
          let serviceDuration = 0;
          let serviceBuffer = this.BUFFER_TIME;
          
          if (service.services && service.services.duration_minutes) {
            serviceDuration = service.services.duration_minutes;
          } else {
            const serviceDurationData = serviceDurations.find(s => s.serviceId === service.service_id);
            if (serviceDurationData) {
              serviceDuration = serviceDurationData.durationMinutes;
              serviceBuffer = serviceDurationData.bufferMinutes;
            }
          }
          
          // Add duration and buffer for each quantity
          reservationDuration += serviceDuration * service.quantity;
          reservationBuffer += serviceBuffer * service.quantity;
        }
        
        // Add 15-minute buffer after the reservation
        const totalReservationTime = reservationDuration + reservationBuffer;
        const reservationEnd = new Date(reservationStart.getTime() + totalReservationTime * 60000);

        // Enhanced overlap detection with buffer consideration
        if (this.timesOverlapWithBuffer(slotStart, slotEnd, reservationStart, reservationEnd)) {
          conflictingReservations.push(reservation.id);
          
          // Determine conflict reason for better debugging
          if (reservation.status === 'requested') {
            conflictReason = 'Pending reservation';
          } else if (reservation.status === 'confirmed') {
            conflictReason = 'Confirmed reservation';
          } else if (reservation.status === 'in_progress') {
            conflictReason = 'Service in progress';
          }
        }
      }

      // Additional capacity check for multi-service bookings
      const capacityCheck = await this.checkServiceCapacity(slot, serviceDurations, existingReservations);
      if (!capacityCheck.available) {
        conflictingReservations.push(...capacityCheck.conflicts);
        conflictReason = capacityCheck.reason;
      }

      // Slot is available if no conflicts
      slot.isAvailable = conflictingReservations.length === 0;
      if (conflictingReservations.length > 0) {
        slot.conflictingReservations = conflictingReservations;
        // Add conflict reason for debugging
        (slot as any).conflictReason = conflictReason;
      }

      availableSlots.push(slot);
    }

    return availableSlots;
  }

  /**
   * Enhanced overlap detection with buffer consideration
   */
  private timesOverlapWithBuffer(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    // Add 15-minute buffer before and after each slot
    const bufferMs = 15 * 60 * 1000; // 15 minutes in milliseconds
    const bufferedStart1 = new Date(start1.getTime() - bufferMs);
    const bufferedEnd1 = new Date(end1.getTime() + bufferMs);
    
    return bufferedStart1 < end2 && start2 < bufferedEnd1;
  }

  /**
   * Check service capacity for multi-service bookings with enhanced capacity management
   */
  private async checkServiceCapacity(
    slot: TimeSlot,
    serviceDurations: ServiceDuration[],
    existingReservations: any[]
  ): Promise<{ available: boolean; conflicts: string[]; reason: string }> {
    const conflicts: string[] = [];
    let reason = '';

    try {
      const slotStart = new Date(`2000-01-01 ${slot.startTime}`);
      const slotEnd = new Date(`2000-01-01 ${slot.endTime}`);

      // Get shop capacity configuration
      const shopCapacity = await this.getShopCapacity(slot, serviceDurations);
      if (!shopCapacity) {
        // If no capacity configuration exists, assume unlimited capacity
        return {
          available: true,
          conflicts: [],
          reason: 'No capacity limits configured'
        };
      }

      // Check overall shop capacity
      const currentConcurrentServices = await this.getCurrentConcurrentServices(
        slot,
        existingReservations
      );

      if (currentConcurrentServices >= shopCapacity.maxConcurrentServices) {
        conflicts.push('shop_capacity_exceeded');
        reason = `Shop at maximum capacity (${currentConcurrentServices}/${shopCapacity.maxConcurrentServices})`;
      }

      // Check individual service capacity limits
      for (const serviceDuration of serviceDurations) {
        const serviceCapacityLimit = shopCapacity.serviceCapacityLimits[serviceDuration.serviceId];
        
        if (serviceCapacityLimit) {
          const currentServiceBookings = await this.getCurrentServiceBookings(
            slot,
            serviceDuration.serviceId,
            existingReservations
          );

          if (currentServiceBookings >= serviceCapacityLimit) {
            conflicts.push(`service_capacity_exceeded_${serviceDuration.serviceId}`);
            reason = `Service ${serviceDuration.serviceId} at maximum capacity (${currentServiceBookings}/${serviceCapacityLimit})`;
          }
        }
      }

      // Check staff availability
      const staffAvailabilityCheck = await this.checkStaffAvailability(
        slot,
        serviceDurations,
        shopCapacity.staffAvailability
      );
      
      if (!staffAvailabilityCheck.available) {
        conflicts.push(...staffAvailabilityCheck.conflicts);
        reason = staffAvailabilityCheck.reason;
      }

      // Check equipment availability
      const equipmentAvailabilityCheck = await this.checkEquipmentAvailability(
        slot,
        serviceDurations,
        shopCapacity.equipmentAvailability
      );
      
      if (!equipmentAvailabilityCheck.available) {
        conflicts.push(...equipmentAvailabilityCheck.conflicts);
        reason = equipmentAvailabilityCheck.reason;
      }

      logger.debug('Service capacity check completed:', {
        slotTime: slot.startTime,
        serviceIds: serviceDurations.map(s => s.serviceId),
        conflicts,
        reason,
        shopCapacity: {
          maxConcurrentServices: shopCapacity.maxConcurrentServices,
          currentConcurrentServices,
          serviceCapacityLimits: shopCapacity.serviceCapacityLimits
        }
      });

      return {
        available: conflicts.length === 0,
        conflicts,
        reason: reason || 'Capacity available'
      };

    } catch (error) {
      logger.error('Error checking service capacity:', {
        slotTime: slot.startTime,
        serviceIds: serviceDurations.map(s => s.serviceId),
        error
      });

      return {
        available: false,
        conflicts: ['capacity_check_error'],
        reason: 'Unable to verify capacity due to system error'
      };
    }
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
   * Check if a specific time slot is available with real-time validation
   * Enhanced for v3.1 flow with immediate conflict detection
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
   * Enhanced real-time availability validation with comprehensive conflict analysis
   * Provides immediate feedback on slot availability, conflict reasons, and intelligent alternatives
   */
  async validateSlotAvailability(
    shopId: string,
    date: string,
    time: string,
    serviceIds: string[],
    duration?: number,
    userId?: string
  ): Promise<{
    available: boolean;
    conflictReason?: string;
    conflictingReservations?: string[];
    suggestedAlternatives?: TimeSlot[];
    validationDetails?: {
      slotStart: string;
      slotEnd: string;
      totalDuration: number;
      bufferTime: number;
      validationTimestamp: string;
      cacheHit: boolean;
    };
    capacityInfo?: {
      totalCapacity: number;
      usedCapacity: number;
      availableCapacity: number;
    };
  }> {
    const validationStartTime = Date.now();
    const cacheKey = `availability_${shopId}_${date}_${time}_${serviceIds.join(',')}`;
    let success = false;
    
    try {
      // Input validation with detailed error reporting
      if (!shopId || !date || !time || !serviceIds.length) {
        const error = new Error('Missing required parameters for slot validation');
        monitoringService.trackError('VALIDATION_ERROR', error.message, 'validateSlotAvailability', 'high', {
          shopId,
          date,
          time,
          serviceIds,
          missingFields: {
            shopId: !shopId,
            date: !date,
            time: !time,
            serviceIds: !serviceIds.length
          }
        });
        throw error;
      }

      // Check cache first for real-time performance
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug('Cache hit for availability validation', { cacheKey });
        monitoringService.trackPerformance('validateSlotAvailability', Date.now() - validationStartTime, true, {
          shopId,
          date,
          time,
          cacheHit: true
        });
        return {
          ...cached,
          validationDetails: {
            ...cached.validationDetails,
            cacheHit: true
          }
        };
      }

      // Get service durations with enhanced error handling
      const serviceDurations = await this.getServiceDurations(serviceIds);
      if (serviceDurations.length === 0) {
        const error = new Error('No valid services found for slot validation');
        monitoringService.trackError('SERVICE_NOT_FOUND', error.message, 'validateSlotAvailability', 'medium', {
          shopId,
          date,
          time,
          serviceIds
        });
        throw error;
      }

      const maxDuration = duration || Math.max(...serviceDurations.map(s => s.durationMinutes + s.bufferMinutes));
      const totalBufferTime = this.BUFFER_TIME;

      // Get existing reservations with real-time data and error handling
      const existingReservations = await this.getExistingReservations(shopId, date);

      // Create a test slot with enhanced metadata
      const testSlot: TimeSlot = {
        startTime: time,
        endTime: this.minutesToTime(this.timeToMinutes(time) + maxDuration),
        duration: maxDuration,
        isAvailable: true
      };

      // Enhanced availability check with detailed analysis
      const availableSlots = await this.checkSlotAvailability(
        [testSlot],
        existingReservations,
        serviceDurations
      );

      const slot = availableSlots[0];
      const validationTime = Date.now() - validationStartTime;
      
      // Prepare validation details
      const validationDetails = {
        slotStart: slot.startTime,
        slotEnd: slot.endTime,
        totalDuration: maxDuration,
        bufferTime: totalBufferTime,
        validationTimestamp: new Date().toISOString(),
        cacheHit: false
      };

      // Get capacity information with error handling
      const capacityInfo = await this.getCapacityInfo(shopId, date, time, serviceIds, existingReservations);

      if (slot.isAvailable) {
        const result = {
          available: true,
          validationDetails,
          capacityInfo
        };
        
        // Cache successful validation for 30 seconds
        this.setCache(cacheKey, result);
        
        success = true;
        
        logger.info('Slot availability validated successfully', {
          shopId,
          date,
          time,
          serviceIds,
          validationTime,
          capacityInfo
        });

        return result;
      }

      // Get enhanced suggested alternatives with error handling
      let alternatives: TimeSlot[] = [];
      try {
        alternatives = await this.getSuggestedAlternatives(
          shopId,
          date,
          serviceIds,
          time,
          maxDuration
        );
      } catch (altError) {
        logger.warn('Failed to get suggested alternatives:', { 
          shopId, date, time, serviceIds, error: altError 
        });
        // Don't fail the entire validation if alternatives fail
      }

      const result = {
        available: false,
        conflictReason: (slot as any).conflictReason || 'Time slot not available',
        conflictingReservations: slot.conflictingReservations || [],
        suggestedAlternatives: alternatives,
        validationDetails,
        capacityInfo
      };

      // Cache negative result for shorter time (10 seconds)
      this.setCache(cacheKey, result, 10000);

      success = true;

      logger.info('Slot availability validation completed with conflicts', {
        shopId,
        date,
        time,
        serviceIds,
        conflictReason: result.conflictReason,
        conflictingReservations: result.conflictingReservations?.length || 0,
        alternativesCount: alternatives.length,
        validationTime
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Track error metrics
      monitoringService.trackError(
        'SLOT_VALIDATION_ERROR',
        errorMessage,
        'validateSlotAvailability',
        'high',
        {
          shopId,
          date,
          time,
          serviceIds,
          duration,
          userId,
          validationTime: Date.now() - validationStartTime,
          errorStack: error instanceof Error ? error.stack : undefined
        }
      );

      logger.error('TimeSlotService.validateSlotAvailability error:', { 
        shopId, date, time, serviceIds, error: errorMessage,
        validationTime: Date.now() - validationStartTime
      });

      // Return a safe fallback response instead of throwing
      return {
        available: false,
        conflictReason: 'Validation failed due to system error',
        conflictingReservations: [],
        suggestedAlternatives: [],
        validationDetails: {
          slotStart: time,
          slotEnd: time,
          totalDuration: duration || 60,
          bufferTime: this.BUFFER_TIME,
          validationTimestamp: new Date().toISOString(),
          cacheHit: false
        },
        capacityInfo: {
          totalCapacity: 0,
          usedCapacity: 0,
          availableCapacity: 0
        }
      };
    } finally {
      // Track performance metrics
      monitoringService.trackPerformance(
        'validateSlotAvailability',
        Date.now() - validationStartTime,
        success,
        {
          shopId,
          date,
          time,
          serviceCount: serviceIds.length,
          userId
        }
      );
    }
  }

  /**
   * Get suggested alternative time slots when requested slot is not available
   * Enhanced with intelligent ranking and filtering
   */
  private async getSuggestedAlternatives(
    shopId: string,
    date: string,
    serviceIds: string[],
    requestedTime: string,
    duration: number
  ): Promise<TimeSlot[]> {
    try {
      // Get all available slots for the day
      const allSlots = await this.getAvailableTimeSlots({
        shopId,
        date,
        serviceIds
      });

      const requestedMinutes = this.timeToMinutes(requestedTime);
      const availableSlots = allSlots.filter(slot => slot.isAvailable);

      // Enhanced ranking algorithm
      const alternatives = availableSlots
        .map(slot => {
          const timeDifference = Math.abs(this.timeToMinutes(slot.startTime) - requestedMinutes);
          const isSameDay = true; // We're already filtering by date
          const isPeakHour = this.isPeakHour(slot.startTime);
          const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
          
          // Calculate priority score (lower is better)
          let priorityScore = timeDifference;
          
          // Prefer same day slots
          if (!isSameDay) priorityScore += 1000;
          
          // Prefer non-peak hours for better availability
          if (isPeakHour) priorityScore += 30;
          
          // Prefer weekday slots
          if (isWeekend) priorityScore += 50;
          
          return {
            ...slot,
            timeDifference,
            priorityScore,
            isPeakHour,
            isWeekend
          };
        })
        .sort((a, b) => a.priorityScore - b.priorityScore)
        .slice(0, 8) // Return top 8 alternatives
        .map(({ timeDifference, priorityScore, isPeakHour, isWeekend, ...slot }) => slot);

      logger.debug('Generated alternative slots', {
        shopId,
        date,
        requestedTime,
        totalAvailable: availableSlots.length,
        alternativesCount: alternatives.length
      });

      return alternatives;

    } catch (error) {
      logger.error('Error getting suggested alternatives:', { 
        shopId, date, serviceIds, requestedTime, error 
      });
      return [];
    }
  }

  /**
   * Check if a time slot is during peak hours
   */
  private isPeakHour(time: string): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const morningPeakStart = this.timeToMinutes('10:00');
    const morningPeakEnd = this.timeToMinutes('12:00');
    const afternoonPeakStart = this.timeToMinutes('14:00');
    const afternoonPeakEnd = this.timeToMinutes('16:00');
    
    return (timeMinutes >= morningPeakStart && timeMinutes < morningPeakEnd) ||
           (timeMinutes >= afternoonPeakStart && timeMinutes < afternoonPeakEnd);
  }

  /**
   * Get capacity information for a specific time slot
   */
  private async getCapacityInfo(
    shopId: string,
    date: string,
    time: string,
    serviceIds: string[],
    existingReservations: any[]
  ): Promise<{
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
  }> {
    try {
      // For now, we'll implement basic capacity calculation
      // This can be enhanced with actual capacity limits from the database
      const slotStart = new Date(`2000-01-01 ${time}`);
      const slotEnd = new Date(slotStart.getTime() + 2 * 60 * 60 * 1000); // 2 hours default
      
      // Count existing reservations in this time slot
      const usedCapacity = existingReservations.filter(reservation => {
        const reservationStart = new Date(`2000-01-01 ${reservation.reservation_time}`);
        return this.timesOverlap(slotStart, slotEnd, reservationStart, reservationStart);
      }).length;

      // For now, assume unlimited capacity per service
      // This can be enhanced with actual capacity data
      const totalCapacity = serviceIds.length * 10; // 10 slots per service
      const availableCapacity = Math.max(0, totalCapacity - usedCapacity);

      return {
        totalCapacity,
        usedCapacity,
        availableCapacity
      };

    } catch (error) {
      logger.error('Error getting capacity info:', { shopId, date, time, serviceIds, error });
      return {
        totalCapacity: 0,
        usedCapacity: 0,
        availableCapacity: 0
      };
    }
  }

  /**
   * Cache management methods
   */
  private getFromCache(key: string): any | null {
    const cached = this.availabilityCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    if (cached) {
      this.availabilityCache.delete(key);
    }
    
    return null;
  }

  private setCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.availabilityCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean up expired cache entries periodically
    if (this.availabilityCache.size > 100) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.availabilityCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.availabilityCache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache for a specific shop and date
   */
  public invalidateCache(shopId: string, date?: string): void {
    if (date) {
      // Invalidate specific date cache
      const pattern = `availability_${shopId}_${date}`;
      for (const key of this.availabilityCache.keys()) {
        if (key.startsWith(pattern)) {
          this.availabilityCache.delete(key);
        }
      }
    } else {
      // Invalidate all cache for shop
      const pattern = `availability_${shopId}`;
      for (const key of this.availabilityCache.keys()) {
        if (key.startsWith(pattern)) {
          this.availabilityCache.delete(key);
        }
      }
    }

    logger.info('Cache invalidated', { shopId, date });
  }

  /**
   * Real-time slot reservation tracking to prevent double-booking
   * This method should be called before creating a reservation to ensure slot availability
   */
  async reserveSlotTemporarily(
    shopId: string,
    date: string,
    time: string,
    serviceIds: string[],
    userId: string,
    duration: number = 5 // 5 minutes temporary reservation
  ): Promise<{
    success: boolean;
    reservationId?: string;
    expiresAt?: string;
    error?: string;
  }> {
    try {
      // Validate slot availability first
      const validation = await this.validateSlotAvailability(
        shopId,
        date,
        time,
        serviceIds,
        undefined,
        userId
      );

      if (!validation.available) {
        return {
          success: false,
          error: validation.conflictReason || 'Slot not available'
        };
      }

      // Create a temporary reservation record in memory
      const tempReservationId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + duration * 60 * 1000);

      // Store temporary reservation
      const tempReservation = {
        id: tempReservationId,
        shopId,
        date,
        time,
        serviceIds,
        userId,
        expiresAt: expiresAt.toISOString(),
        status: 'temporary'
      };

      // Add to cache for quick lookup
      const cacheKey = `temp_reservation_${shopId}_${date}_${time}`;
      this.setCache(cacheKey, tempReservation, duration * 60 * 1000);

      // Invalidate availability cache for this slot
      this.invalidateCache(shopId, date);

      logger.info('Temporary slot reservation created', {
        tempReservationId,
        shopId,
        date,
        time,
        userId,
        expiresAt: expiresAt.toISOString()
      });

      return {
        success: true,
        reservationId: tempReservationId,
        expiresAt: expiresAt.toISOString()
      };

    } catch (error) {
      logger.error('Error creating temporary slot reservation:', {
        shopId,
        date,
        time,
        serviceIds,
        userId,
        error
      });

      return {
        success: false,
        error: 'Failed to reserve slot temporarily'
      };
    }
  }

  /**
   * Release a temporary slot reservation
   */
  async releaseTemporaryReservation(
    shopId: string,
    date: string,
    time: string,
    reservationId: string
  ): Promise<boolean> {
    try {
      const cacheKey = `temp_reservation_${shopId}_${date}_${time}`;
      const tempReservation = this.getFromCache(cacheKey);

      if (tempReservation && tempReservation.id === reservationId) {
        this.availabilityCache.delete(cacheKey);
        this.invalidateCache(shopId, date);

        logger.info('Temporary slot reservation released', {
          reservationId,
          shopId,
          date,
          time
        });

        return true;
      }

      return false;

    } catch (error) {
      logger.error('Error releasing temporary reservation:', {
        shopId,
        date,
        time,
        reservationId,
        error
      });

      return false;
    }
  }

  /**
   * Get real-time availability status for multiple slots
   */
  async getBulkAvailabilityStatus(
    shopId: string,
    date: string,
    timeSlots: Array<{ time: string; serviceIds: string[] }>
  ): Promise<Array<{
    time: string;
    available: boolean;
    conflictReason?: string;
    capacityInfo?: any;
  }>> {
    try {
      const results = await Promise.all(
        timeSlots.map(async (slot) => {
          try {
            const validation = await this.validateSlotAvailability(
              shopId,
              date,
              slot.time,
              slot.serviceIds
            );

            return {
              time: slot.time,
              available: validation.available,
              conflictReason: validation.conflictReason,
              capacityInfo: validation.capacityInfo
            };
          } catch (error) {
            logger.error('Error validating slot in bulk check:', {
              shopId,
              date,
              time: slot.time,
              serviceIds: slot.serviceIds,
              error
            });

            return {
              time: slot.time,
              available: false,
              conflictReason: 'Validation error'
            };
          }
        })
      );

      logger.debug('Bulk availability check completed', {
        shopId,
        date,
        totalSlots: timeSlots.length,
        availableSlots: results.filter(r => r.available).length
      });

      return results;

    } catch (error) {
      logger.error('Error in bulk availability check:', {
        shopId,
        date,
        timeSlots,
        error
      });
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

  // ========================================
  // CAPACITY MANAGEMENT METHODS
  // ========================================

  /**
   * Get shop capacity configuration
   */
  private async getShopCapacity(
    slot: TimeSlot,
    serviceDurations: ServiceDuration[]
  ): Promise<ShopCapacity | null> {
    try {
      // Extract shop ID from the first service (assuming all services are from the same shop)
      const serviceIds = serviceDurations.map(s => s.serviceId);
      
      // Get shop ID from services
      const { data: services, error: servicesError } = await this.supabase
        .from('shop_services')
        .select('shop_id')
        .in('id', serviceIds)
        .limit(1);

      if (servicesError || !services?.length) {
        logger.warn('Could not determine shop ID for capacity check');
        return null;
      }

      const shopId = services[0].shop_id;

      // For now, return a default capacity configuration
      // In a real implementation, this would query a shop_capacity table
      return {
        shopId,
        maxConcurrentServices: 5, // Default limit
        maxConcurrentCustomers: 10, // Default limit
        serviceCapacityLimits: {
          // Set default limits for each service (can be overridden by database config)
          ...Object.fromEntries(serviceDurations.map(s => [s.serviceId, 3]))
        },
        staffAvailability: [], // Would be populated from staff table
        equipmentAvailability: [] // Would be populated from equipment table
      };

    } catch (error) {
      logger.error('Error getting shop capacity configuration:', { error });
      return null;
    }
  }

  /**
   * Get current number of concurrent services in a time slot
   */
  private async getCurrentConcurrentServices(
    slot: TimeSlot,
    existingReservations: any[]
  ): Promise<number> {
    const slotStart = new Date(`2000-01-01 ${slot.startTime}`);
    const slotEnd = new Date(`2000-01-01 ${slot.endTime}`);

    let concurrentServices = 0;

    for (const reservation of existingReservations) {
      const reservationStart = new Date(`2000-01-01 ${reservation.reservation_time}`);
      
      // Calculate reservation end time based on services
      let reservationDuration = 0;
      for (const service of reservation.reservation_services) {
        reservationDuration += (service.services?.duration_minutes || 60) * service.quantity;
      }
      
      const reservationEnd = new Date(reservationStart.getTime() + reservationDuration * 60000);

      // Check if reservation overlaps with the slot
      if (this.timesOverlap(slotStart, slotEnd, reservationStart, reservationEnd)) {
        concurrentServices++;
      }
    }

    return concurrentServices;
  }

  /**
   * Get current bookings for a specific service in a time slot
   */
  private async getCurrentServiceBookings(
    slot: TimeSlot,
    serviceId: string,
    existingReservations: any[]
  ): Promise<number> {
    const slotStart = new Date(`2000-01-01 ${slot.startTime}`);
    const slotEnd = new Date(`2000-01-01 ${slot.endTime}`);

    let serviceBookings = 0;

    for (const reservation of existingReservations) {
      const reservationStart = new Date(`2000-01-01 ${reservation.reservation_time}`);
      
      // Check if this reservation includes the specific service
      const hasService = reservation.reservation_services.some(
        rs => rs.service_id === serviceId
      );

      if (hasService) {
        // Calculate reservation end time
        let reservationDuration = 0;
        for (const service of reservation.reservation_services) {
          reservationDuration += (service.services?.duration_minutes || 60) * service.quantity;
        }
        
        const reservationEnd = new Date(reservationStart.getTime() + reservationDuration * 60000);

        // Check if reservation overlaps with the slot
        if (this.timesOverlap(slotStart, slotEnd, reservationStart, reservationEnd)) {
          serviceBookings++;
        }
      }
    }

    return serviceBookings;
  }

  /**
   * Check staff availability for services
   */
  private async checkStaffAvailability(
    slot: TimeSlot,
    serviceDurations: ServiceDuration[],
    staffAvailability: StaffAvailability[]
  ): Promise<{ available: boolean; conflicts: string[]; reason: string }> {
    const conflicts: string[] = [];
    let reason = '';

    // For now, assume staff is always available
    // In a real implementation, this would check:
    // 1. Staff working hours
    // 2. Current staff load
    // 3. Required staff for specific services

    if (staffAvailability.length === 0) {
      // No staff configuration - assume unlimited availability
      return {
        available: true,
        conflicts: [],
        reason: 'No staff capacity limits configured'
      };
    }

    // Check if any staff member is available
    const availableStaff = staffAvailability.filter(staff => {
      // Check working hours (simplified)
      const slotTime = this.timeToMinutes(slot.startTime);
      return staff.workingHours.some(hours => {
        const startTime = this.timeToMinutes(hours.startTime);
        const endTime = this.timeToMinutes(hours.endTime);
        return slotTime >= startTime && slotTime < endTime;
      });
    });

    if (availableStaff.length === 0) {
      conflicts.push('no_staff_available');
      reason = 'No staff available during this time slot';
    }

    return {
      available: conflicts.length === 0,
      conflicts,
      reason: reason || 'Staff available'
    };
  }

  /**
   * Check equipment availability for services
   */
  private async checkEquipmentAvailability(
    slot: TimeSlot,
    serviceDurations: ServiceDuration[],
    equipmentAvailability: EquipmentAvailability[]
  ): Promise<{ available: boolean; conflicts: string[]; reason: string }> {
    const conflicts: string[] = [];
    let reason = '';

    if (equipmentAvailability.length === 0) {
      // No equipment configuration - assume unlimited availability
      return {
        available: true,
        conflicts: [],
        reason: 'No equipment capacity limits configured'
      };
    }

    // Check if required equipment is available
    for (const serviceDuration of serviceDurations) {
      const requiredEquipment = equipmentAvailability.filter(equipment =>
        equipment.requiredByServices.includes(serviceDuration.serviceId)
      );

      for (const equipment of requiredEquipment) {
        if (equipment.availableQuantity <= 0) {
          conflicts.push(`equipment_unavailable_${equipment.equipmentId}`);
          reason = `${equipment.name} is not available`;
        }
      }
    }

    return {
      available: conflicts.length === 0,
      conflicts,
      reason: reason || 'Equipment available'
    };
  }

  /**
   * Update shop capacity configuration
   */
  async updateShopCapacity(
    shopId: string,
    capacity: Omit<ShopCapacity, 'shopId'>
  ): Promise<void> {
    try {
      // In a real implementation, this would update a shop_capacity table
      // For now, we'll just log the update
      logger.info('Shop capacity updated:', {
        shopId,
        capacity: {
          maxConcurrentServices: capacity.maxConcurrentServices,
          maxConcurrentCustomers: capacity.maxConcurrentCustomers,
          serviceCapacityLimits: Object.keys(capacity.serviceCapacityLimits).length
        }
      });

      // Invalidate cache for this shop
      this.invalidateCache(shopId);

    } catch (error) {
      logger.error('Error updating shop capacity:', { shopId, error });
      throw error;
    }
  }

  /**
   * Get shop capacity configuration
   */
  async getShopCapacityConfig(shopId: string): Promise<ShopCapacity | null> {
    try {
      // In a real implementation, this would query a shop_capacity table
      // For now, return a default configuration
      return {
        shopId,
        maxConcurrentServices: 5,
        maxConcurrentCustomers: 10,
        serviceCapacityLimits: {},
        staffAvailability: [],
        equipmentAvailability: []
      };

    } catch (error) {
      logger.error('Error getting shop capacity config:', { shopId, error });
      return null;
    }
  }
}

export const timeSlotService = new TimeSlotService(); 