/**
 * Korean Timezone Utility
 * 
 * Comprehensive timezone handling for Korean Standard Time (KST/Asia/Seoul)
 * with proper date/time calculations for refund eligibility and business rules
 */

import { logger } from './logger';

// Korean Standard Time timezone identifier
export const KOREAN_TIMEZONE = 'Asia/Seoul';
export const KOREAN_UTC_OFFSET = 9; // UTC+9

/**
 * Get current time in Korean Standard Time
 */
export function getCurrentKoreanTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: KOREAN_TIMEZONE }));
}

/**
 * Convert UTC date to Korean Standard Time
 */
export function convertUTCToKorean(utcDate: Date): Date {
  return new Date(utcDate.toLocaleString('en-US', { timeZone: KOREAN_TIMEZONE }));
}

/**
 * Convert Korean Standard Time to UTC
 */
export function convertKoreanToUTC(koreanDate: Date): Date {
  // Create a date in Korean timezone and convert to UTC
  const koreanTimeString = koreanDate.toLocaleString('en-US', { timeZone: KOREAN_TIMEZONE });
  const utcDate = new Date(koreanTimeString);
  return utcDate;
}

/**
 * Parse Korean date string and return Date object
 * Supports formats: YYYY-MM-DD, YYYY-MM-DD HH:mm:ss
 */
export function parseKoreanDate(dateString: string): Date {
  try {
    // Handle different date formats
    if (dateString.includes('T')) {
      // ISO format with timezone
      return new Date(dateString);
    } else if (dateString.includes(' ')) {
      // Date with time: YYYY-MM-DD HH:mm:ss
      const [datePart, timePart] = dateString.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute, second] = timePart.split(':').map(Number);
      
      // Create date in Korean timezone
      const koreanDate = new Date(year, month - 1, day, hour, minute, second || 0);
      return koreanDate;
    } else {
      // Date only: YYYY-MM-DD
      const [year, month, day] = dateString.split('-').map(Number);
      const koreanDate = new Date(year, month - 1, day, 0, 0, 0);
      return koreanDate;
    }
  } catch (error) {
    logger.error('Error parsing Korean date', {
      dateString,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Invalid Korean date format: ${dateString}`);
  }
}

/**
 * Format date to Korean date string (YYYY-MM-DD)
 */
export function formatKoreanDate(date: Date): string {
  const koreanDate = convertUTCToKorean(date);
  return koreanDate.toISOString().split('T')[0];
}

/**
 * Format date to Korean datetime string (YYYY-MM-DD HH:mm:ss)
 */
export function formatKoreanDateTime(date: Date): string {
  const koreanDate = convertUTCToKorean(date);
  return koreanDate.toISOString().replace('T', ' ').split('.')[0];
}

/**
 * Calculate time difference in hours between two dates in Korean timezone
 */
export function calculateKoreanTimeDifferenceInHours(date1: Date, date2: Date): number {
  const koreanDate1 = convertUTCToKorean(date1);
  const koreanDate2 = convertUTCToKorean(date2);
  
  const diffInMs = Math.abs(koreanDate2.getTime() - koreanDate1.getTime());
  return Math.floor(diffInMs / (1000 * 60 * 60));
}

/**
 * Calculate time difference in minutes between two dates in Korean timezone
 */
export function calculateKoreanTimeDifferenceInMinutes(date1: Date, date2: Date): number {
  const koreanDate1 = convertUTCToKorean(date1);
  const koreanDate2 = convertUTCToKorean(date2);
  
  const diffInMs = Math.abs(koreanDate2.getTime() - koreanDate1.getTime());
  return Math.floor(diffInMs / (1000 * 60));
}

/**
 * Check if a date is within Korean business hours (9 AM - 6 PM KST)
 */
export function isKoreanBusinessHours(date: Date): boolean {
  const koreanDate = convertUTCToKorean(date);
  const hour = koreanDate.getHours();
  const dayOfWeek = koreanDate.getDay();
  
  // Monday to Friday, 9 AM to 6 PM
  return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 18;
}

/**
 * Get next Korean business day (Monday-Friday)
 */
export function getNextKoreanBusinessDay(date: Date): Date {
  const koreanDate = convertUTCToKorean(date);
  const nextDay = new Date(koreanDate);
  
  do {
    nextDay.setDate(nextDay.getDate() + 1);
  } while (nextDay.getDay() === 0 || nextDay.getDay() === 6); // Skip weekends
  
  return nextDay;
}

/**
 * Add business days to a Korean date
 */
export function addKoreanBusinessDays(date: Date, businessDays: number): Date {
  const koreanDate = convertUTCToKorean(date);
  let result = new Date(koreanDate);
  let daysAdded = 0;
  
  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    // Skip weekends
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysAdded++;
    }
  }
  
  return result;
}

/**
 * Check if two dates are on the same Korean business day
 */
export function isSameKoreanBusinessDay(date1: Date, date2: Date): boolean {
  const koreanDate1 = convertUTCToKorean(date1);
  const koreanDate2 = convertUTCToKorean(date2);
  
  return (
    koreanDate1.getFullYear() === koreanDate2.getFullYear() &&
    koreanDate1.getMonth() === koreanDate2.getMonth() &&
    koreanDate1.getDate() === koreanDate2.getDate()
  );
}

/**
 * Get Korean date range for a specific period
 */
export interface KoreanDateRange {
  start: Date;
  end: Date;
  days: number;
  businessDays: number;
}

export function getKoreanDateRange(startDate: Date, endDate: Date): KoreanDateRange {
  const koreanStart = convertUTCToKorean(startDate);
  const koreanEnd = convertUTCToKorean(endDate);
  
  const diffInMs = koreanEnd.getTime() - koreanStart.getTime();
  const days = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
  
  // Calculate business days
  let businessDays = 0;
  const currentDate = new Date(koreanStart);
  
  while (currentDate <= koreanEnd) {
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      businessDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    start: koreanStart,
    end: koreanEnd,
    days,
    businessDays
  };
}

/**
 * Korean timezone-aware refund eligibility calculator
 */
export interface RefundEligibilityResult {
  isEligible: boolean;
  refundPercentage: number;
  hoursUntilReservation: number;
  businessHoursUntilReservation: number;
  cancellationWindow: string;
  reason: string;
  koreanTimeInfo: {
    currentTime: string;
    reservationTime: string;
    timeZone: string;
  };
}

export function calculateRefundEligibility(
  reservationDate: Date,
  reservationTime: string,
  currentTime?: Date
): RefundEligibilityResult {
  try {
    const now = currentTime || getCurrentKoreanTime();
    
    // Parse reservation time and create full datetime
    const [hour, minute] = reservationTime.split(':').map(Number);
    const reservationDateTime = new Date(reservationDate);
    reservationDateTime.setHours(hour, minute, 0, 0);
    
    // Convert to Korean timezone
    const koreanNow = convertUTCToKorean(now);
    const koreanReservation = convertUTCToKorean(reservationDateTime);
    
    // Calculate time differences
    const hoursUntilReservation = calculateKoreanTimeDifferenceInHours(now, reservationDateTime);
    const businessHoursUntilReservation = calculateBusinessHoursUntil(koreanNow, koreanReservation);
    
    // Determine refund eligibility based on timing
    let refundPercentage = 0;
    let isEligible = false;
    let cancellationWindow = '';
    let reason = '';
    
    if (hoursUntilReservation >= 48) {
      // More than 48 hours before reservation
      refundPercentage = 100;
      isEligible = true;
      cancellationWindow = '48+ hours';
      reason = 'Full refund available (48+ hours before reservation)';
    } else if (hoursUntilReservation >= 24) {
      // 24-48 hours before reservation
      refundPercentage = 80;
      isEligible = true;
      cancellationWindow = '24-48 hours';
      reason = '80% refund available (24-48 hours before reservation)';
    } else if (hoursUntilReservation >= 12) {
      // 12-24 hours before reservation
      refundPercentage = 50;
      isEligible = true;
      cancellationWindow = '12-24 hours';
      reason = '50% refund available (12-24 hours before reservation)';
    } else if (hoursUntilReservation >= 2) {
      // 2-12 hours before reservation
      refundPercentage = 25;
      isEligible = true;
      cancellationWindow = '2-12 hours';
      reason = '25% refund available (2-12 hours before reservation)';
    } else {
      // Less than 2 hours before reservation
      refundPercentage = 0;
      isEligible = false;
      cancellationWindow = '< 2 hours';
      reason = 'No refund available (less than 2 hours before reservation)';
    }
    
    return {
      isEligible,
      refundPercentage,
      hoursUntilReservation,
      businessHoursUntilReservation,
      cancellationWindow,
      reason,
      koreanTimeInfo: {
        currentTime: formatKoreanDateTime(now),
        reservationTime: formatKoreanDateTime(reservationDateTime),
        timeZone: 'Asia/Seoul (KST)'
      }
    };
    
  } catch (error) {
    logger.error('Error calculating refund eligibility', {
      reservationDate,
      reservationTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Return safe default
    return {
      isEligible: false,
      refundPercentage: 0,
      hoursUntilReservation: 0,
      businessHoursUntilReservation: 0,
      cancellationWindow: 'error',
      reason: 'Error calculating refund eligibility',
      koreanTimeInfo: {
        currentTime: formatKoreanDateTime(getCurrentKoreanTime()),
        reservationTime: 'Unknown',
        timeZone: 'Asia/Seoul (KST)'
      }
    };
  }
}

/**
 * Calculate business hours between two Korean dates
 */
function calculateBusinessHoursUntil(startDate: Date, endDate: Date): number {
  let businessHours = 0;
  const current = new Date(startDate);
  
  while (current < endDate) {
    // Check if current time is within business hours (9 AM - 6 PM)
    const hour = current.getHours();
    const dayOfWeek = current.getDay();
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 18) {
      businessHours++;
    }
    
    // Move to next hour
    current.setHours(current.getHours() + 1);
  }
  
  return businessHours;
}

/**
 * Validate Korean date string format
 */
export function validateKoreanDateFormat(dateString: string): boolean {
  try {
    const date = parseKoreanDate(dateString);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Get Korean holidays for the current year (simplified list)
 */
export function getKoreanHolidays(year: number): Date[] {
  const holidays: Date[] = [];
  
  // New Year's Day
  holidays.push(new Date(year, 0, 1));
  
  // Lunar New Year (approximate - would need lunar calendar for exact dates)
  // Korean New Year's Day (usually in January or February)
  holidays.push(new Date(year, 0, 1)); // Simplified
  
  // Independence Movement Day
  holidays.push(new Date(year, 2, 1));
  
  // Children's Day
  holidays.push(new Date(year, 4, 5));
  
  // Buddha's Birthday (approximate)
  holidays.push(new Date(year, 4, 15)); // Simplified
  
  // Memorial Day
  holidays.push(new Date(year, 5, 6));
  
  // Liberation Day
  holidays.push(new Date(year, 7, 15));
  
  // Chuseok (Korean Thanksgiving - approximate)
  holidays.push(new Date(year, 8, 15)); // Simplified
  
  // National Foundation Day
  holidays.push(new Date(year, 9, 3));
  
  // Hangeul Day
  holidays.push(new Date(year, 9, 9));
  
  // Christmas Day
  holidays.push(new Date(year, 11, 25));
  
  return holidays;
}

/**
 * Check if a Korean date is a holiday
 */
export function isKoreanHoliday(date: Date): boolean {
  const koreanDate = convertUTCToKorean(date);
  const year = koreanDate.getFullYear();
  const holidays = getKoreanHolidays(year);
  
  return holidays.some(holiday => 
    holiday.getFullYear() === year &&
    holiday.getMonth() === koreanDate.getMonth() &&
    holiday.getDate() === koreanDate.getDate()
  );
}

/**
 * Get next Korean business day excluding holidays
 */
export function getNextKoreanBusinessDayExcludingHolidays(date: Date): Date {
  let nextDay = getNextKoreanBusinessDay(date);
  
  while (isKoreanHoliday(nextDay)) {
    nextDay = getNextKoreanBusinessDay(nextDay);
  }
  
  return nextDay;
}
