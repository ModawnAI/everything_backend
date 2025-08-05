/**
 * Booking Validation Service
 * 
 * Comprehensive multi-layered validation system for booking requests.
 * Ensures all booking requests meet business rules, data integrity, and operational constraints.
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface BookingRequest {
  userId: string;
  shopId: string;
  serviceId: string;
  staffId?: string;
  date: string;
  timeSlot: string;
  quantity?: number;
  specialRequests?: string;
  customerNotes?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: ValidationMetadata;
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'error' | 'critical';
  details?: any;
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
  details?: any;
}

export interface ValidationMetadata {
  validationTime: number;
  validationDuration: number;
  checksPerformed: string[];
  customerEligibility: CustomerEligibilityInfo;
  serviceAvailability: ServiceAvailabilityInfo;
  bookingLimits: BookingLimitInfo;
}

export interface CustomerEligibilityInfo {
  isEligible: boolean;
  blacklistStatus: 'none' | 'temporary' | 'permanent';
  creditLimit: number;
  currentBalance: number;
  membershipStatus: 'none' | 'basic' | 'premium' | 'vip';
  lastBookingDate?: string;
  totalBookings: number;
  noShowCount: number;
}

export interface ServiceAvailabilityInfo {
  isAvailable: boolean;
  staffAvailable: boolean;
  resourcesAvailable: boolean;
  capacity: number;
  currentBookings: number;
  availableSlots: number;
  serviceDuration: number;
  price: number;
}

export interface BookingLimitInfo {
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  currentDailyBookings: number;
  currentWeeklyBookings: number;
  currentMonthlyBookings: number;
  canBookToday: boolean;
  canBookThisWeek: boolean;
  canBookThisMonth: boolean;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  validationFunction: (request: BookingRequest, context: ValidationContext) => Promise<ValidationResult>;
}

export interface ValidationContext {
  user: any;
  shop: any;
  service: any;
  staff?: any;
  existingBookings: any[];
  customerHistory: any[];
  businessRules: BusinessRule[];
}

export class BookingValidationService {
  private supabase = getSupabaseClient();
  private businessRules: BusinessRule[] = [];

  constructor() {
    this.initializeBusinessRules();
  }

  /**
   * Comprehensive validation of booking request
   */
  async validateBookingRequest(request: BookingRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const checksPerformed: string[] = [];

    try {
      // Step 1: Basic data validation
      const basicValidation = await this.validateBasicData(request);
      errors.push(...basicValidation.errors);
      warnings.push(...basicValidation.warnings);
      checksPerformed.push('basic_data_validation');

      if (basicValidation.errors.some(e => e.severity === 'critical')) {
        return this.createValidationResult(false, errors, warnings, startTime, checksPerformed);
      }

      // Step 2: Fetch context data
      const context = await this.buildValidationContext(request);
      checksPerformed.push('context_building');

      // Step 3: Customer eligibility validation
      const eligibilityValidation = await this.validateCustomerEligibility(request, context);
      errors.push(...eligibilityValidation.errors);
      warnings.push(...eligibilityValidation.warnings);
      checksPerformed.push('customer_eligibility');

      if (eligibilityValidation.errors.some(e => e.severity === 'critical')) {
        return this.createValidationResult(false, errors, warnings, startTime, checksPerformed);
      }

      // Step 4: Service availability validation
      const availabilityValidation = await this.validateServiceAvailability(request, context);
      errors.push(...availabilityValidation.errors);
      warnings.push(...availabilityValidation.warnings);
      checksPerformed.push('service_availability');

      if (availabilityValidation.errors.some(e => e.severity === 'critical')) {
        return this.createValidationResult(false, errors, warnings, startTime, checksPerformed);
      }

      // Step 5: Booking limits validation
      const limitValidation = await this.validateBookingLimits(request, context);
      errors.push(...limitValidation.errors);
      warnings.push(...limitValidation.warnings);
      checksPerformed.push('booking_limits');

      if (limitValidation.errors.some(e => e.severity === 'critical')) {
        return this.createValidationResult(false, errors, warnings, startTime, checksPerformed);
      }

      // Step 6: Business rules validation
      const businessRuleValidation = await this.validateBusinessRules(request, context);
      errors.push(...businessRuleValidation.errors);
      warnings.push(...businessRuleValidation.warnings);
      checksPerformed.push('business_rules');

      if (businessRuleValidation.errors.some(e => e.severity === 'critical')) {
        return this.createValidationResult(false, errors, warnings, startTime, checksPerformed);
      }

      // Step 7: Operational constraints validation
      const operationalValidation = await this.validateOperationalConstraints(request, context);
      errors.push(...operationalValidation.errors);
      warnings.push(...operationalValidation.warnings);
      checksPerformed.push('operational_constraints');

      const isValid = errors.length === 0 || !errors.some(e => e.severity === 'critical');
      
      return this.createValidationResult(isValid, errors, warnings, startTime, checksPerformed, {
        customerEligibility: eligibilityValidation.metadata?.customerEligibility,
        serviceAvailability: availabilityValidation.metadata?.serviceAvailability,
        bookingLimits: limitValidation.metadata?.bookingLimits
      });

    } catch (error) {
      logger.error('Error during booking validation:', { error: (error as Error).message, request });
      
      errors.push({
        code: 'VALIDATION_ERROR',
        field: 'system',
        message: 'An unexpected error occurred during validation',
        severity: 'critical',
        details: { error: (error as Error).message }
      });

      return this.createValidationResult(false, errors, warnings, startTime, checksPerformed);
    }
  }

  /**
   * Validate basic data integrity
   */
  private async validateBasicData(request: BookingRequest): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    if (!request.userId) {
      errors.push({
        code: 'MISSING_USER_ID',
        field: 'userId',
        message: 'User ID is required',
        severity: 'critical'
      });
    }

    if (!request.shopId) {
      errors.push({
        code: 'MISSING_SHOP_ID',
        field: 'shopId',
        message: 'Shop ID is required',
        severity: 'critical'
      });
    }

    if (!request.serviceId) {
      errors.push({
        code: 'MISSING_SERVICE_ID',
        field: 'serviceId',
        message: 'Service ID is required',
        severity: 'critical'
      });
    }

    if (!request.date) {
      errors.push({
        code: 'MISSING_DATE',
        field: 'date',
        message: 'Booking date is required',
        severity: 'critical'
      });
    }

    if (!request.timeSlot) {
      errors.push({
        code: 'MISSING_TIME_SLOT',
        field: 'timeSlot',
        message: 'Time slot is required',
        severity: 'critical'
      });
    }

    // Date validation
    if (request.date) {
      const bookingDate = new Date(request.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (bookingDate < today) {
        errors.push({
          code: 'PAST_DATE',
          field: 'date',
          message: 'Cannot book for past dates',
          severity: 'critical'
        });
      }

      // Check if booking is too far in the future (e.g., 6 months)
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      if (bookingDate > sixMonthsFromNow) {
        errors.push({
          code: 'TOO_FAR_IN_FUTURE',
          field: 'date',
          message: 'Cannot book more than 6 months in advance',
          severity: 'critical'
        });
      }
    }

    // Time slot format validation
    if (request.timeSlot && !/^\d{2}:\d{2}$/.test(request.timeSlot)) {
      errors.push({
        code: 'INVALID_TIME_FORMAT',
        field: 'timeSlot',
        message: 'Time slot must be in HH:MM format',
        severity: 'critical'
      });
    }

    // Quantity validation
    if (request.quantity !== undefined) {
      if (request.quantity <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          field: 'quantity',
          message: 'Quantity must be greater than 0',
          severity: 'critical'
        });
      }

      if (request.quantity > 10) {
        warnings.push({
          code: 'HIGH_QUANTITY',
          field: 'quantity',
          message: 'High quantity booking may require special approval',
          details: { quantity: request.quantity }
        });
      }
    }

    // Special requests length validation
    if (request.specialRequests && request.specialRequests.length > 500) {
      errors.push({
        code: 'SPECIAL_REQUESTS_TOO_LONG',
        field: 'specialRequests',
        message: 'Special requests cannot exceed 500 characters',
        severity: 'critical'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validationTime: Date.now(),
        validationDuration: 0,
        checksPerformed: ['basic_data_validation'],
        customerEligibility: {} as CustomerEligibilityInfo,
        serviceAvailability: {} as ServiceAvailabilityInfo,
        bookingLimits: {} as BookingLimitInfo
      }
    };
  }

  /**
   * Build validation context with all necessary data
   */
  private async buildValidationContext(request: BookingRequest): Promise<ValidationContext> {
    const [user, shop, service, staff, existingBookings, customerHistory] = await Promise.all([
      this.getUser(request.userId),
      this.getShop(request.shopId),
      this.getService(request.serviceId),
      request.staffId ? this.getStaff(request.staffId) : null,
      this.getExistingBookings(request.shopId, request.date),
      this.getCustomerHistory(request.userId)
    ]);

    return {
      user,
      shop,
      service,
      staff,
      existingBookings,
      customerHistory,
      businessRules: this.businessRules
    };
  }

  /**
   * Validate customer eligibility
   */
  private async validateCustomerEligibility(request: BookingRequest, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const { user, customerHistory } = context;

    if (!user) {
      errors.push({
        code: 'USER_NOT_FOUND',
        field: 'userId',
        message: 'User not found',
        severity: 'critical'
      });
      return this.createValidationResult(false, errors, warnings, Date.now(), ['customer_eligibility']);
    }

    // Check if user is active
    if (user.status !== 'active') {
      errors.push({
        code: 'USER_INACTIVE',
        field: 'userId',
        message: 'User account is not active',
        severity: 'critical'
      });
    }

    // Check blacklist status
    if (user.blacklist_status === 'permanent') {
      errors.push({
        code: 'USER_BLACKLISTED_PERMANENT',
        field: 'userId',
        message: 'User is permanently blacklisted',
        severity: 'critical'
      });
    } else if (user.blacklist_status === 'temporary') {
      const blacklistUntil = new Date(user.blacklist_until);
      if (blacklistUntil > new Date()) {
        errors.push({
          code: 'USER_BLACKLISTED_TEMPORARY',
          field: 'userId',
          message: `User is temporarily blacklisted until ${blacklistUntil.toDateString()}`,
          severity: 'critical'
        });
      }
    }

    // Check credit limit
    if (user.credit_limit && user.current_balance >= user.credit_limit) {
      errors.push({
        code: 'CREDIT_LIMIT_EXCEEDED',
        field: 'userId',
        message: 'User has exceeded their credit limit',
        severity: 'critical'
      });
    }

    // Check no-show history
    const noShowCount = customerHistory.filter(booking => booking.status === 'no_show').length;
    if (noShowCount >= 3) {
      warnings.push({
        code: 'HIGH_NO_SHOW_COUNT',
        field: 'userId',
        message: 'User has multiple no-show records',
        details: { noShowCount }
      });
    }

    // Check if user has recent cancellations
    const recentCancellations = customerHistory.filter(booking => 
      booking.status === 'cancelled_by_user' && 
      new Date(booking.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    if (recentCancellations >= 2) {
      warnings.push({
        code: 'RECENT_CANCELLATIONS',
        field: 'userId',
        message: 'User has recent cancellation history',
        details: { recentCancellations }
      });
    }

    const customerEligibility: CustomerEligibilityInfo = {
      isEligible: errors.length === 0,
      blacklistStatus: user.blacklist_status || 'none',
      creditLimit: user.credit_limit || 0,
      currentBalance: user.current_balance || 0,
      membershipStatus: user.membership_status || 'none',
      lastBookingDate: customerHistory.length > 0 ? customerHistory[0].created_at : undefined,
      totalBookings: customerHistory.length,
      noShowCount
    };

    return this.createValidationResult(errors.length === 0, errors, warnings, Date.now(), ['customer_eligibility'], {
      customerEligibility
    });
  }

  /**
   * Validate service availability
   */
  private async validateServiceAvailability(request: BookingRequest, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const { service, shop, staff, existingBookings } = context;

    if (!service) {
      errors.push({
        code: 'SERVICE_NOT_FOUND',
        field: 'serviceId',
        message: 'Service not found',
        severity: 'critical'
      });
      return this.createValidationResult(false, errors, warnings, Date.now(), ['service_availability']);
    }

    if (!shop) {
      errors.push({
        code: 'SHOP_NOT_FOUND',
        field: 'shopId',
        message: 'Shop not found',
        severity: 'critical'
      });
      return this.createValidationResult(false, errors, warnings, Date.now(), ['service_availability']);
    }

    // Check if service is active
    if (!service.is_active) {
      errors.push({
        code: 'SERVICE_INACTIVE',
        field: 'serviceId',
        message: 'Service is not currently available',
        severity: 'critical'
      });
    }

    // Check if shop is active
    if (!shop.is_active) {
      errors.push({
        code: 'SHOP_INACTIVE',
        field: 'shopId',
        message: 'Shop is not currently active',
        severity: 'critical'
      });
    }

    // Check if service is offered by the shop
    if (service.shop_id !== shop.id) {
      errors.push({
        code: 'SERVICE_NOT_OFFERED',
        field: 'serviceId',
        message: 'Service is not offered by this shop',
        severity: 'critical'
      });
    }

    // Check staff availability if staff is specified
    if (request.staffId) {
      if (!staff) {
        errors.push({
          code: 'STAFF_NOT_FOUND',
          field: 'staffId',
          message: 'Specified staff member not found',
          severity: 'critical'
        });
      } else if (!staff.is_active) {
        errors.push({
          code: 'STAFF_INACTIVE',
          field: 'staffId',
          message: 'Specified staff member is not active',
          severity: 'critical'
        });
      } else {
        // Check if staff is available at the requested time
        const staffBookings = existingBookings.filter(booking => 
          booking.staff_id === request.staffId && 
          booking.time_slot === request.timeSlot
        );

        if (staffBookings.length > 0) {
          errors.push({
            code: 'STAFF_UNAVAILABLE',
            field: 'staffId',
            message: 'Staff member is not available at the requested time',
            severity: 'critical'
          });
        }
      }
    }

    // Check capacity and availability
    const timeSlotBookings = existingBookings.filter(booking => 
      booking.time_slot === request.timeSlot
    );

    const totalBookedQuantity = timeSlotBookings.reduce((sum, booking) => sum + (booking.quantity || 1), 0);
    const requestedQuantity = request.quantity || 1;
    const availableCapacity = service.capacity - totalBookedQuantity;

    if (requestedQuantity > availableCapacity) {
      errors.push({
        code: 'INSUFFICIENT_CAPACITY',
        field: 'quantity',
        message: `Insufficient capacity. Available: ${availableCapacity}, Requested: ${requestedQuantity}`,
        severity: 'critical',
        details: { availableCapacity, requestedQuantity }
      });
    }

    // Check if booking is within shop operating hours
    const bookingDateTime = new Date(`${request.date} ${request.timeSlot}`);
    const dayOfWeek = bookingDateTime.getDay();
    const timeOfDay = bookingDateTime.getHours() * 60 + bookingDateTime.getMinutes();

    // This would need to be implemented based on your shop hours schema
    // For now, we'll assume basic validation
    if (bookingDateTime.getHours() < 8 || bookingDateTime.getHours() > 20) {
      warnings.push({
        code: 'OUTSIDE_NORMAL_HOURS',
        field: 'timeSlot',
        message: 'Booking is outside normal business hours',
        details: { hour: bookingDateTime.getHours() }
      });
    }

    const serviceAvailability: ServiceAvailabilityInfo = {
      isAvailable: errors.length === 0,
      staffAvailable: !request.staffId || (staff && staff.is_active),
      resourcesAvailable: true, // Would need to be implemented based on resource tracking
      capacity: service.capacity,
      currentBookings: timeSlotBookings.length,
      availableSlots: availableCapacity,
      serviceDuration: service.duration || 60,
      price: service.price
    };

    return this.createValidationResult(errors.length === 0, errors, warnings, Date.now(), ['service_availability'], {
      serviceAvailability
    });
  }

  /**
   * Validate booking limits
   */
  private async validateBookingLimits(request: BookingRequest, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const { customerHistory } = context;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Daily booking limit
    const dailyBookings = customerHistory.filter(booking => 
      new Date(booking.created_at) >= today
    ).length;

    if (dailyBookings >= 3) {
      errors.push({
        code: 'DAILY_LIMIT_EXCEEDED',
        field: 'userId',
        message: 'Daily booking limit exceeded (max 3 bookings per day)',
        severity: 'critical',
        details: { dailyBookings, limit: 3 }
      });
    }

    // Weekly booking limit
    const weeklyBookings = customerHistory.filter(booking => 
      new Date(booking.created_at) >= weekStart
    ).length;

    if (weeklyBookings >= 10) {
      errors.push({
        code: 'WEEKLY_LIMIT_EXCEEDED',
        field: 'userId',
        message: 'Weekly booking limit exceeded (max 10 bookings per week)',
        severity: 'critical',
        details: { weeklyBookings, limit: 10 }
      });
    }

    // Monthly booking limit
    const monthlyBookings = customerHistory.filter(booking => 
      new Date(booking.created_at) >= monthStart
    ).length;

    if (monthlyBookings >= 30) {
      errors.push({
        code: 'MONTHLY_LIMIT_EXCEEDED',
        field: 'userId',
        message: 'Monthly booking limit exceeded (max 30 bookings per month)',
        severity: 'critical',
        details: { monthlyBookings, limit: 30 }
      });
    }

    // Check for rapid booking attempts (anti-spam)
    const recentBookings = customerHistory.filter(booking => 
      new Date(booking.created_at) > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    ).length;

    if (recentBookings >= 2) {
      warnings.push({
        code: 'RAPID_BOOKING_ATTEMPTS',
        field: 'userId',
        message: 'Multiple booking attempts detected',
        details: { recentBookings }
      });
    }

    const bookingLimits: BookingLimitInfo = {
      dailyLimit: 3,
      weeklyLimit: 10,
      monthlyLimit: 30,
      currentDailyBookings: dailyBookings,
      currentWeeklyBookings: weeklyBookings,
      currentMonthlyBookings: monthlyBookings,
      canBookToday: dailyBookings < 3,
      canBookThisWeek: weeklyBookings < 10,
      canBookThisMonth: monthlyBookings < 30
    };

    return this.createValidationResult(errors.length === 0, errors, warnings, Date.now(), ['booking_limits'], {
      bookingLimits
    });
  }

  /**
   * Validate business rules
   */
  private async validateBusinessRules(request: BookingRequest, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Execute all enabled business rules in priority order
    const enabledRules = this.businessRules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      try {
        const result = await rule.validationFunction(request, context);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      } catch (error) {
        logger.error(`Error executing business rule ${rule.id}:`, { error: (error as Error).message });
        errors.push({
          code: 'BUSINESS_RULE_ERROR',
          field: 'system',
          message: `Error executing business rule: ${rule.name}`,
          severity: 'error',
          details: { ruleId: rule.id, error: (error as Error).message }
        });
      }
    }

    return this.createValidationResult(errors.length === 0, errors, warnings, Date.now(), ['business_rules']);
  }

  /**
   * Validate operational constraints
   */
  private async validateOperationalConstraints(request: BookingRequest, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if booking is too close to current time (e.g., minimum 2 hours notice)
    const bookingDateTime = new Date(`${request.date} ${request.timeSlot}`);
    const now = new Date();
    const timeDifference = bookingDateTime.getTime() - now.getTime();
    const hoursDifference = timeDifference / (1000 * 60 * 60);

    if (hoursDifference < 2) {
      errors.push({
        code: 'INSUFFICIENT_NOTICE',
        field: 'date',
        message: 'Booking must be made at least 2 hours in advance',
        severity: 'critical',
        details: { hoursDifference, minimumHours: 2 }
      });
    }

    // Check if booking is on a holiday or special day
    const isHoliday = await this.isHoliday(request.date);
    if (isHoliday) {
      warnings.push({
        code: 'HOLIDAY_BOOKING',
        field: 'date',
        message: 'Booking is on a holiday - special rates may apply',
        details: { holiday: isHoliday }
      });
    }

    // Check for maintenance windows
    const maintenanceWindow = await this.checkMaintenanceWindow(request.date, request.timeSlot);
    if (maintenanceWindow) {
      errors.push({
        code: 'MAINTENANCE_WINDOW',
        field: 'timeSlot',
        message: 'Booking time falls within a maintenance window',
        severity: 'critical',
        details: { maintenanceWindow }
      });
    }

    return this.createValidationResult(errors.length === 0, errors, warnings, Date.now(), ['operational_constraints']);
  }

  /**
   * Initialize business rules
   */
  private initializeBusinessRules(): void {
    this.businessRules = [
      {
        id: 'premium_member_priority',
        name: 'Premium Member Priority',
        description: 'Premium members get priority booking for certain time slots',
        enabled: true,
        priority: 10,
        validationFunction: async (request: BookingRequest, context: ValidationContext) => {
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];

          if (context.user.membership_status === 'premium' || context.user.membership_status === 'vip') {
            // Premium members can book premium slots
            const isPremiumSlot = this.isPremiumTimeSlot(request.timeSlot);
            if (isPremiumSlot) {
              warnings.push({
                code: 'PREMIUM_SLOT_BOOKING',
                field: 'timeSlot',
                message: 'Premium time slot booking - additional charges may apply',
                details: { membershipStatus: context.user.membership_status }
              });
            }
          } else {
            // Non-premium members cannot book premium slots
            const isPremiumSlot = this.isPremiumTimeSlot(request.timeSlot);
            if (isPremiumSlot) {
              errors.push({
                code: 'PREMIUM_SLOT_RESTRICTED',
                field: 'timeSlot',
                message: 'Premium time slots are restricted to premium members',
                severity: 'critical'
              });
            }
          }

          return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {} as any
          };
        }
      },
      {
        id: 'advance_booking_restrictions',
        name: 'Advance Booking Restrictions',
        description: 'Restrict advance bookings based on user type',
        enabled: true,
        priority: 8,
        validationFunction: async (request: BookingRequest, context: ValidationContext) => {
          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];

          const bookingDate = new Date(request.date);
          const now = new Date();
          const daysDifference = Math.ceil((bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          // Regular users can book up to 30 days in advance
          if (context.user.membership_status === 'none' && daysDifference > 30) {
            errors.push({
              code: 'ADVANCE_BOOKING_RESTRICTED',
              field: 'date',
              message: 'Regular users can only book up to 30 days in advance',
              severity: 'critical',
              details: { daysDifference, maxDays: 30 }
            });
          }

          // Premium users can book up to 60 days in advance
          if (context.user.membership_status === 'premium' && daysDifference > 60) {
            errors.push({
              code: 'ADVANCE_BOOKING_RESTRICTED',
              field: 'date',
              message: 'Premium users can only book up to 60 days in advance',
              severity: 'critical',
              details: { daysDifference, maxDays: 60 }
            });
          }

          return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {} as any
          };
        }
      }
    ];
  }

  /**
   * Helper methods
   */
  private createValidationResult(
    isValid: boolean,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    startTime: number,
    checksPerformed: string[],
    additionalMetadata?: Partial<ValidationMetadata>
  ): ValidationResult {
    // Calculate duration from the start time to now
    const validationDuration = Date.now() - startTime;

    return {
      isValid,
      errors,
      warnings,
      metadata: {
        validationTime: startTime,
        validationDuration,
        checksPerformed,
        customerEligibility: {} as CustomerEligibilityInfo,
        serviceAvailability: {} as ServiceAvailabilityInfo,
        bookingLimits: {} as BookingLimitInfo,
        ...additionalMetadata
      }
    };
  }

  private isPremiumTimeSlot(timeSlot: string): boolean {
    const hour = parseInt(timeSlot.split(':')[0]);
    // Premium slots: 10:00-12:00 and 18:00-20:00
    return (hour >= 10 && hour < 12) || (hour >= 18 && hour < 20);
  }

  private async isHoliday(date: string): Promise<string | null> {
    // This would need to be implemented based on your holiday calendar
    // For now, return null (no holiday)
    return null;
  }

  private async checkMaintenanceWindow(date: string, timeSlot: string): Promise<any | null> {
    // This would need to be implemented based on your maintenance schedule
    // For now, return null (no maintenance window)
    return null;
  }

  // Database helper methods
  private async getUser(userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user:', { error: error.message, userId });
      return null;
    }

    return data;
  }

  private async getShop(shopId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .single();

    if (error) {
      logger.error('Error fetching shop:', { error: error.message, shopId });
      return null;
    }

    return data;
  }

  private async getService(serviceId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (error) {
      logger.error('Error fetching service:', { error: error.message, serviceId });
      return null;
    }

    return data;
  }

  private async getStaff(staffId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .single();

    if (error) {
      logger.error('Error fetching staff:', { error: error.message, staffId });
      return null;
    }

    return data;
  }

  private async getExistingBookings(shopId: string, date: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('shop_id', shopId)
      .eq('date', date)
      .in('status', ['requested', 'confirmed']);

    if (error) {
      logger.error('Error fetching existing bookings:', { error: error.message, shopId, date });
      return [];
    }

    return data || [];
  }

  private async getCustomerHistory(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('Error fetching customer history:', { error: error.message, userId });
      return [];
    }

    return data || [];
  }
} 