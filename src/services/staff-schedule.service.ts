/**
 * Staff Schedule Service
 * Handles staff working hours and day off management
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import type {
  StaffSchedule,
  StaffDayOff,
  StaffWeeklySchedule,
  StaffAvailability,
  StaffTimeSlot,
  CreateStaffScheduleDto,
  SetWeeklyScheduleDto,
  CreateDayOffDto,
  UpdateDayOffDto,
  DayOfWeek,
} from '../types/staff-schedule.types';

class StaffScheduleService {
  /**
   * Get weekly schedule for a staff member
   */
  async getStaffSchedule(
    shopId: string,
    staffId: string
  ): Promise<StaffSchedule[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId)
      .order('day_of_week', { ascending: true });

    if (error) {
      logger.error('Error fetching staff schedule:', error);
      throw new Error('Failed to fetch staff schedule');
    }

    return (data || []).map(this.mapScheduleFromDb);
  }

  /**
   * Get all staff schedules for a shop
   */
  async getAllStaffSchedules(shopId: string): Promise<StaffWeeklySchedule[]> {
    const supabase = getSupabaseClient();

    // First get all staff for the shop
    const { data: staffData, error: staffError } = await supabase
      .from('shop_staff')
      .select('id, name, nickname')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (staffError) {
      logger.error('Error fetching staff:', staffError);
      throw new Error('Failed to fetch staff');
    }

    // Then get all schedules
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('shop_id', shopId);

    if (scheduleError) {
      logger.error('Error fetching schedules:', scheduleError);
      throw new Error('Failed to fetch schedules');
    }

    // Group schedules by staff
    const schedulesByStaff = new Map<string, StaffSchedule[]>();
    (scheduleData || []).forEach((schedule: any) => {
      const staffId = schedule.staff_id;
      if (!schedulesByStaff.has(staffId)) {
        schedulesByStaff.set(staffId, []);
      }
      schedulesByStaff.get(staffId)!.push(this.mapScheduleFromDb(schedule));
    });

    // Build result
    return (staffData || []).map((staff: any) => ({
      staffId: staff.id,
      staffName: staff.nickname || staff.name,
      schedules: schedulesByStaff.get(staff.id) || [],
    }));
  }

  /**
   * Set/update a single day schedule for a staff member
   */
  async setDaySchedule(
    shopId: string,
    staffId: string,
    schedule: CreateStaffScheduleDto
  ): Promise<StaffSchedule> {
    const supabase = getSupabaseClient();

    // Validate time format
    if (schedule.isWorking) {
      if (!schedule.startTime || !schedule.endTime) {
        throw new Error('Start time and end time are required for working days');
      }
      this.validateTimeFormat(schedule.startTime);
      this.validateTimeFormat(schedule.endTime);
      if (schedule.breakStartTime) this.validateTimeFormat(schedule.breakStartTime);
      if (schedule.breakEndTime) this.validateTimeFormat(schedule.breakEndTime);
    }

    // Check if schedule exists
    const { data: existing } = await supabase
      .from('staff_schedules')
      .select('id')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId)
      .eq('day_of_week', schedule.dayOfWeek)
      .single();

    const scheduleData = {
      shop_id: shopId,
      staff_id: staffId,
      day_of_week: schedule.dayOfWeek,
      is_working: schedule.isWorking,
      start_time: schedule.isWorking ? schedule.startTime : null,
      end_time: schedule.isWorking ? schedule.endTime : null,
      break_start_time: schedule.isWorking ? schedule.breakStartTime : null,
      break_end_time: schedule.isWorking ? schedule.breakEndTime : null,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('staff_schedules')
        .update(scheduleData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new Error('Failed to update schedule');
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('staff_schedules')
        .insert({
          ...scheduleData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new Error('Failed to create schedule');
      result = data;
    }

    return this.mapScheduleFromDb(result);
  }

  /**
   * Set weekly schedule for a staff member (all 7 days)
   */
  async setWeeklySchedule(
    shopId: string,
    staffId: string,
    weeklySchedule: SetWeeklyScheduleDto
  ): Promise<StaffSchedule[]> {
    const results: StaffSchedule[] = [];

    for (const schedule of weeklySchedule.schedules) {
      const result = await this.setDaySchedule(shopId, staffId, schedule);
      results.push(result);
    }

    return results;
  }

  /**
   * Delete all schedules for a staff member
   */
  async deleteStaffSchedules(shopId: string, staffId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('staff_schedules')
      .delete()
      .eq('shop_id', shopId)
      .eq('staff_id', staffId);

    if (error) {
      logger.error('Error deleting staff schedules:', error);
      throw new Error('Failed to delete staff schedules');
    }
  }

  // ==================== Day Off Management ====================

  /**
   * Get day offs for a staff member
   */
  async getStaffDayOffs(
    shopId: string,
    staffId: string,
    startDate?: string,
    endDate?: string
  ): Promise<StaffDayOff[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('staff_dayoffs')
      .select('*')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      logger.error('Error fetching day offs:', error);
      throw new Error('Failed to fetch day offs');
    }

    return (data || []).map(this.mapDayOffFromDb);
  }

  /**
   * Create a day off
   */
  async createDayOff(
    shopId: string,
    staffId: string,
    dayOff: CreateDayOffDto
  ): Promise<StaffDayOff> {
    const supabase = getSupabaseClient();

    // Check if day off already exists for this date
    const { data: existing } = await supabase
      .from('staff_dayoffs')
      .select('id')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId)
      .eq('date', dayOff.date)
      .single();

    if (existing) {
      throw new Error('Day off already exists for this date');
    }

    const { data, error } = await supabase
      .from('staff_dayoffs')
      .insert({
        shop_id: shopId,
        staff_id: staffId,
        date: dayOff.date,
        reason: dayOff.reason,
        is_recurring: dayOff.isRecurring || false,
        recurring_pattern: dayOff.recurringPattern
          ? JSON.stringify(dayOff.recurringPattern)
          : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating day off:', error);
      throw new Error('Failed to create day off');
    }

    return this.mapDayOffFromDb(data);
  }

  /**
   * Update a day off
   */
  async updateDayOff(
    shopId: string,
    dayOffId: string,
    update: UpdateDayOffDto
  ): Promise<StaffDayOff> {
    const supabase = getSupabaseClient();
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (update.date !== undefined) updateData.date = update.date;
    if (update.reason !== undefined) updateData.reason = update.reason;
    if (update.isRecurring !== undefined)
      updateData.is_recurring = update.isRecurring;
    if (update.recurringPattern !== undefined)
      updateData.recurring_pattern = JSON.stringify(update.recurringPattern);

    const { data, error } = await supabase
      .from('staff_dayoffs')
      .update(updateData)
      .eq('id', dayOffId)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating day off:', error);
      throw new Error('Failed to update day off');
    }

    return this.mapDayOffFromDb(data);
  }

  /**
   * Delete a day off
   */
  async deleteDayOff(shopId: string, dayOffId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('staff_dayoffs')
      .delete()
      .eq('id', dayOffId)
      .eq('shop_id', shopId);

    if (error) {
      logger.error('Error deleting day off:', error);
      throw new Error('Failed to delete day off');
    }
  }

  // ==================== Availability Checking ====================

  /**
   * Check staff availability for a specific date
   */
  async getStaffAvailability(
    shopId: string,
    staffId: string,
    date: string
  ): Promise<StaffAvailability> {
    const supabase = getSupabaseClient();

    // Get staff info
    const { data: staffData, error: staffError } = await supabase
      .from('shop_staff')
      .select('id, name, nickname')
      .eq('id', staffId)
      .eq('shop_id', shopId)
      .single();

    if (staffError || !staffData) {
      throw new Error('Staff not found');
    }

    // Get day of week from date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;

    // Get schedule for this day
    const { data: scheduleData } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId)
      .eq('day_of_week', dayOfWeek)
      .single();

    // Check for day off
    const { data: dayOffData } = await supabase
      .from('staff_dayoffs')
      .select('*')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId)
      .eq('date', date)
      .single();

    const isDayOff = !!dayOffData;
    const schedule = scheduleData ? this.mapScheduleFromDb(scheduleData) : null;
    const isWorking = schedule?.isWorking && !isDayOff;

    // Calculate time slots if working
    let timeSlots: StaffTimeSlot[] = [];
    if (isWorking && schedule?.startTime && schedule?.endTime) {
      timeSlots = this.generateTimeSlots(
        schedule.startTime,
        schedule.endTime,
        schedule.breakStartTime,
        schedule.breakEndTime,
        30 // 30 minute slots
      );
    }

    return {
      staffId,
      staffName: staffData.nickname || staffData.name,
      date,
      isWorking,
      isDayOff,
      dayOffReason: dayOffData?.reason,
      workingHours:
        schedule?.isWorking && schedule.startTime && schedule.endTime
          ? {
              start: schedule.startTime,
              end: schedule.endTime,
            }
          : undefined,
      breakTime:
        schedule?.breakStartTime && schedule?.breakEndTime
          ? {
              start: schedule.breakStartTime,
              end: schedule.breakEndTime,
            }
          : undefined,
      timeSlots,
    };
  }

  /**
   * Get all staff availability for a specific date
   */
  async getAllStaffAvailability(
    shopId: string,
    date: string
  ): Promise<StaffAvailability[]> {
    const supabase = getSupabaseClient();

    // Get all active staff
    const { data: staffData, error: staffError } = await supabase
      .from('shop_staff')
      .select('id, name, nickname')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (staffError) {
      throw new Error('Failed to fetch staff');
    }

    // Get availability for each staff
    const availabilities: StaffAvailability[] = [];
    for (const staff of staffData || []) {
      try {
        const availability = await this.getStaffAvailability(
          shopId,
          staff.id,
          date
        );
        availabilities.push(availability);
      } catch (error) {
        // If error for one staff, continue with others
        logger.warn(`Error getting availability for staff ${staff.id}:`, error);
      }
    }

    return availabilities;
  }

  // ==================== Helper Methods ====================

  private validateTimeFormat(time: string): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      throw new Error(`Invalid time format: ${time}. Expected HH:MM`);
    }
  }

  private generateTimeSlots(
    startTime: string,
    endTime: string,
    breakStart?: string,
    breakEnd?: string,
    intervalMinutes: number = 30
  ): StaffTimeSlot[] {
    const slots: StaffTimeSlot[] = [];
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    const breakStartMin = breakStart ? this.timeToMinutes(breakStart) : null;
    const breakEndMin = breakEnd ? this.timeToMinutes(breakEnd) : null;

    for (let time = start; time < end; time += intervalMinutes) {
      const slotStart = this.minutesToTime(time);
      const slotEnd = this.minutesToTime(time + intervalMinutes);

      // Check if slot overlaps with break
      const isBreak =
        breakStartMin !== null &&
        breakEndMin !== null &&
        time >= breakStartMin &&
        time < breakEndMin;

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        isAvailable: !isBreak,
        reason: isBreak ? 'break' : undefined,
      });
    }

    return slots;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private mapScheduleFromDb(data: any): StaffSchedule {
    return {
      id: data.id,
      staffId: data.staff_id,
      shopId: data.shop_id,
      dayOfWeek: data.day_of_week as DayOfWeek,
      isWorking: data.is_working,
      startTime: data.start_time,
      endTime: data.end_time,
      breakStartTime: data.break_start_time,
      breakEndTime: data.break_end_time,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapDayOffFromDb(data: any): StaffDayOff {
    return {
      id: data.id,
      staffId: data.staff_id,
      shopId: data.shop_id,
      date: new Date(data.date),
      reason: data.reason,
      isRecurring: data.is_recurring,
      recurringPattern: data.recurring_pattern
        ? JSON.parse(data.recurring_pattern)
        : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const staffScheduleService = new StaffScheduleService();
export default staffScheduleService;
