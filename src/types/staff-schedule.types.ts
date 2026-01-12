/**
 * Staff Schedule Types
 * Types for managing staff working hours and day offs
 */

// Days of week (0 = Sunday, 1 = Monday, etc.)
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const DAY_NAMES_KR: Record<DayOfWeek, string> = {
  0: '일요일',
  1: '월요일',
  2: '화요일',
  3: '수요일',
  4: '목요일',
  5: '금요일',
  6: '토요일',
};

/**
 * Staff working schedule for a specific day of week
 */
export interface StaffSchedule {
  id: string;
  staffId: string;
  shopId: string;
  dayOfWeek: DayOfWeek;
  isWorking: boolean;
  startTime?: string; // HH:MM format (e.g., "09:00")
  endTime?: string; // HH:MM format (e.g., "18:00")
  breakStartTime?: string; // Break start (e.g., "12:00")
  breakEndTime?: string; // Break end (e.g., "13:00")
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Staff day off record
 */
export interface StaffDayOff {
  id: string;
  staffId: string;
  shopId: string;
  date: Date;
  reason?: string;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Recurring pattern for day offs (e.g., every Monday)
 */
export interface RecurringPattern {
  type: 'weekly' | 'monthly';
  dayOfWeek?: DayOfWeek; // For weekly recurring
  dayOfMonth?: number; // For monthly recurring (1-31)
}

/**
 * Staff weekly schedule summary
 */
export interface StaffWeeklySchedule {
  staffId: string;
  staffName: string;
  schedules: StaffSchedule[];
}

/**
 * Available time slot for a staff member
 */
export interface StaffTimeSlot {
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isAvailable: boolean;
  reason?: string; // If not available, why (break, booked, day off)
}

/**
 * Staff availability for a specific date
 */
export interface StaffAvailability {
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  isWorking: boolean;
  isDayOff: boolean;
  dayOffReason?: string;
  workingHours?: {
    start: string;
    end: string;
  };
  breakTime?: {
    start: string;
    end: string;
  };
  timeSlots: StaffTimeSlot[];
}

// ==================== DTOs ====================

/**
 * DTO for creating/updating a single day schedule
 */
export interface CreateStaffScheduleDto {
  dayOfWeek: DayOfWeek;
  isWorking: boolean;
  startTime?: string;
  endTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
}

/**
 * DTO for setting weekly schedule (all 7 days)
 */
export interface SetWeeklyScheduleDto {
  schedules: CreateStaffScheduleDto[];
}

/**
 * DTO for creating a day off
 */
export interface CreateDayOffDto {
  date: string; // YYYY-MM-DD format
  reason?: string;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
}

/**
 * DTO for updating a day off
 */
export interface UpdateDayOffDto {
  date?: string;
  reason?: string;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
}

/**
 * Query parameters for getting staff availability
 */
export interface GetAvailabilityQuery {
  date?: string; // YYYY-MM-DD format
  startDate?: string; // For range query
  endDate?: string; // For range query
}

/**
 * Response for staff schedule with day offs
 */
export interface StaffScheduleWithDayOffs {
  staffId: string;
  staffName: string;
  schedules: StaffSchedule[];
  dayOffs: StaffDayOff[];
}
