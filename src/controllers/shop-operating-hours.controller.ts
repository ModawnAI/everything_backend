/**
 * Shop Operating Hours Controller
 * 
 * Handles shop operating hours management operations for shop owners including:
 * - Retrieving current operating hours
 * - Updating weekly operating hours schedule
 * - Managing special hours and break times
 * - Validating time formats and business logic
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

// Request interfaces
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

interface DayOperatingHours {
  open?: string;
  close?: string;
  closed?: boolean;
  break_start?: string;
  break_end?: string;
}

interface WeeklyOperatingHours {
  monday?: DayOperatingHours;
  tuesday?: DayOperatingHours;
  wednesday?: DayOperatingHours;
  thursday?: DayOperatingHours;
  friday?: DayOperatingHours;
  saturday?: DayOperatingHours;
  sunday?: DayOperatingHours;
}

interface UpdateOperatingHoursRequest extends AuthenticatedRequest {
  body: {
    operating_hours: WeeklyOperatingHours;
  };
}

export class ShopOperatingHoursController {
  /**
   * @swagger
   * /api/shop/operating-hours:
   *   get:
   *     summary: Get shop operating hours
   *     description: |
   *       Retrieve the current operating hours schedule for the authenticated shop owner's shop.
   *       
   *       **Features:**
   *       - Weekly schedule with day-by-day hours
   *       - Break time information if configured
   *       - Closed day indicators
   *       - Current status (open/closed) based on current time
   *       
   *       **Authorization:** Requires valid JWT token. Only shop owners can access their own operating hours.
   *     tags: [Shop Operating Hours]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Operating hours retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     operating_hours:
   *                       type: object
   *                       description: Weekly operating hours schedule
   *                       properties:
   *                         monday:
   *                           $ref: '#/components/schemas/DayOperatingHours'
   *                         tuesday:
   *                           $ref: '#/components/schemas/DayOperatingHours'
   *                         wednesday:
   *                           $ref: '#/components/schemas/DayOperatingHours'
   *                         thursday:
   *                           $ref: '#/components/schemas/DayOperatingHours'
   *                         friday:
   *                           $ref: '#/components/schemas/DayOperatingHours'
   *                         saturday:
   *                           $ref: '#/components/schemas/DayOperatingHours'
   *                         sunday:
   *                           $ref: '#/components/schemas/DayOperatingHours'
   *                     current_status:
   *                       type: object
   *                       properties:
   *                         is_open:
   *                           type: boolean
   *                           description: Whether the shop is currently open
   *                           example: true
   *                         current_day:
   *                           type: string
   *                           description: Current day of week
   *                           example: "monday"
   *                         current_time:
   *                           type: string
   *                           description: Current time in HH:MM format
   *                           example: "14:30"
   *                         next_opening:
   *                           type: string
   *                           description: Next opening time if currently closed
   *                           example: "Tomorrow at 10:00"
   *                           nullable: true
   *                 message:
   *                   type: string
   *                   example: "영업시간을 성공적으로 조회했습니다."
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  async getOperatingHours(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Get the shop owned by the user
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, operating_hours')
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '등록된 샵이 없습니다.',
            details: '샵 등록을 먼저 완료해주세요.'
          }
        });
        return;
      }

      // Get current status
      const currentStatus = this.getCurrentStatus(shop.operating_hours);

      logger.info('Shop operating hours retrieved successfully', {
        userId,
        shopId: shop.id,
        hasOperatingHours: !!shop.operating_hours,
        currentStatus: currentStatus.is_open
      });

      res.status(200).json({
        success: true,
        data: {
          operating_hours: shop.operating_hours || this.getDefaultOperatingHours(),
          current_status: currentStatus
        },
        message: '영업시간을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error in getOperatingHours', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '영업시간 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/shop/operating-hours:
   *   put:
   *     summary: Update shop operating hours
   *     description: |
   *       Update the operating hours schedule for the authenticated shop owner's shop.
   *       
   *       **Key Features:**
   *       - Set weekly schedule with day-by-day configuration
   *       - Support for break times during operating hours
   *       - Mark specific days as closed
   *       - Flexible time format validation (HH:MM)
   *       - Business logic validation (open < close time)
   *       - Support for overnight hours (e.g., 22:00 - 02:00)
   *       
   *       **Business Rules:**
   *       - Open time must be before close time (except overnight hours)
   *       - Break times must be within operating hours
   *       - Time format must be HH:MM (24-hour format)
   *       - Days can be marked as closed with `closed: true`
   *       - All days are optional (existing hours preserved if not provided)
   *       
   *       **Authorization:** Requires valid JWT token. Only shop owners can update their operating hours.
   *     tags: [Shop Operating Hours]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - operating_hours
   *             properties:
   *               operating_hours:
   *                 type: object
   *                 description: Weekly operating hours schedule
   *                 properties:
   *                   monday:
   *                     $ref: '#/components/schemas/DayOperatingHours'
   *                   tuesday:
   *                     $ref: '#/components/schemas/DayOperatingHours'
   *                   wednesday:
   *                     $ref: '#/components/schemas/DayOperatingHours'
   *                   thursday:
   *                     $ref: '#/components/schemas/DayOperatingHours'
   *                   friday:
   *                     $ref: '#/components/schemas/DayOperatingHours'
   *                   saturday:
   *                     $ref: '#/components/schemas/DayOperatingHours'
   *                   sunday:
   *                     $ref: '#/components/schemas/DayOperatingHours'
   *           examples:
   *             standard_hours:
   *               summary: Standard business hours
   *               value:
   *                 operating_hours:
   *                   monday:
   *                     open: "09:00"
   *                     close: "18:00"
   *                     closed: false
   *                   tuesday:
   *                     open: "09:00"
   *                     close: "18:00"
   *                     closed: false
   *                   wednesday:
   *                     open: "09:00"
   *                     close: "18:00"
   *                     closed: false
   *                   thursday:
   *                     open: "09:00"
   *                     close: "18:00"
   *                     closed: false
   *                   friday:
   *                     open: "09:00"
   *                     close: "20:00"
   *                     closed: false
   *                   saturday:
   *                     open: "10:00"
   *                     close: "20:00"
   *                     closed: false
   *                   sunday:
   *                     closed: true
   *             with_breaks:
   *               summary: Hours with lunch break
   *               value:
   *                 operating_hours:
   *                   monday:
   *                     open: "10:00"
   *                     close: "19:00"
   *                     break_start: "12:30"
   *                     break_end: "13:30"
   *                     closed: false
   *                   tuesday:
   *                     open: "10:00"
   *                     close: "19:00"
   *                     break_start: "12:30"
   *                     break_end: "13:30"
   *                     closed: false
   *             partial_update:
   *               summary: Update only specific days
   *               value:
   *                 operating_hours:
   *                   friday:
   *                     open: "09:00"
   *                     close: "21:00"
   *                     closed: false
   *                   saturday:
   *                     open: "10:00"
   *                     close: "22:00"
   *                     closed: false
   *     responses:
   *       200:
   *         description: Operating hours updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     operating_hours:
   *                       type: object
   *                       description: Updated operating hours schedule
   *                     current_status:
   *                       type: object
   *                       properties:
   *                         is_open:
   *                           type: boolean
   *                         current_day:
   *                           type: string
   *                         current_time:
   *                           type: string
   *                 message:
   *                   type: string
   *                   example: "영업시간이 성공적으로 업데이트되었습니다."
   *       400:
   *         description: Bad request - Invalid operating hours data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             examples:
   *               validation_error:
   *                 summary: Time validation error
   *                 value:
   *                   success: false
   *                   error:
   *                     code: "VALIDATION_ERROR"
   *                     message: "영업시간 데이터가 유효하지 않습니다."
   *                     details:
   *                       - field: "monday.open"
   *                         message: "시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요."
   *               time_logic_error:
   *                 summary: Business logic error
   *                 value:
   *                   success: false
   *                   error:
   *                     code: "INVALID_TIME_RANGE"
   *                     message: "영업시간 설정이 올바르지 않습니다."
   *                     details: "종료 시간은 시작 시간보다 늦어야 합니다."
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  async updateOperatingHours(req: UpdateOperatingHoursRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { operating_hours } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      if (!operating_hours) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_OPERATING_HOURS',
            message: '영업시간 데이터가 필요합니다.',
            details: 'operating_hours 필드를 제공해주세요.'
          }
        });
        return;
      }

      // Validate operating hours format and business logic
      const validationErrors = this.validateOperatingHours(operating_hours);
      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '영업시간 데이터가 유효하지 않습니다.',
            details: validationErrors
          }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Get the shop owned by the user
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, operating_hours')
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '등록된 샵이 없습니다.',
            details: '샵 등록을 먼저 완료해주세요.'
          }
        });
        return;
      }

      // Merge with existing operating hours (partial update support)
      const existingHours = shop.operating_hours || {};
      const updatedHours = { ...existingHours, ...operating_hours };

      // Update the shop's operating hours
      const { data: updatedShop, error: updateError } = await supabase
        .from('shops')
        .update({
          operating_hours: updatedHours,
          updated_at: new Date().toISOString()
        })
        .eq('id', shop.id)
        .select('operating_hours')
        .single();

      if (updateError) {
        logger.error('Error updating shop operating hours', {
          error: updateError.message,
          userId,
          shopId: shop.id,
          operatingHours: operating_hours,
          code: updateError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '영업시간 업데이트 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Get current status with updated hours
      const currentStatus = this.getCurrentStatus(updatedShop.operating_hours);

      logger.info('Shop operating hours updated successfully', {
        userId,
        shopId: shop.id,
        updatedDays: Object.keys(operating_hours),
        currentStatus: currentStatus.is_open
      });

      res.status(200).json({
        success: true,
        data: {
          operating_hours: updatedShop.operating_hours,
          current_status: currentStatus
        },
        message: '영업시간이 성공적으로 업데이트되었습니다.'
      });

    } catch (error) {
      logger.error('Error in updateOperatingHours', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '영업시간 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * Validate operating hours format and business logic
   */
  private validateOperatingHours(operatingHours: WeeklyOperatingHours): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    for (const [day, hours] of Object.entries(operatingHours)) {
      if (!validDays.includes(day)) {
        errors.push({ field: day, message: `유효하지 않은 요일입니다: ${day}` });
        continue;
      }

      if (!hours || typeof hours !== 'object') {
        errors.push({ field: day, message: `${day}의 영업시간 형식이 올바르지 않습니다.` });
        continue;
      }

      const { open, close, closed, break_start, break_end } = hours;

      // If day is marked as closed, skip time validation
      if (closed === true) {
        continue;
      }

      // Validate open and close times
      if (!open || !close) {
        errors.push({ field: `${day}.open`, message: `${day}의 영업 시작/종료 시간이 필요합니다.` });
        continue;
      }

      if (!timeRegex.test(open)) {
        errors.push({ field: `${day}.open`, message: `${day}의 시작 시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요.` });
      }

      if (!timeRegex.test(close)) {
        errors.push({ field: `${day}.close`, message: `${day}의 종료 시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요.` });
      }

      // Validate time logic (open < close, except for overnight hours)
      if (timeRegex.test(open) && timeRegex.test(close)) {
        const openMinutes = this.timeToMinutes(open);
        const closeMinutes = this.timeToMinutes(close);

        // Handle overnight hours (e.g., 22:00 - 02:00)
        if (closeMinutes <= openMinutes && closeMinutes < 12 * 60) {
          // This is likely overnight hours, which is valid
        } else if (closeMinutes <= openMinutes) {
          errors.push({ field: `${day}.close`, message: `${day}의 종료 시간은 시작 시간보다 늦어야 합니다.` });
        }
      }

      // Validate break times if provided
      if (break_start && break_end) {
        if (!timeRegex.test(break_start)) {
          errors.push({ field: `${day}.break_start`, message: `${day}의 휴게 시작 시간 형식이 올바르지 않습니다.` });
        }

        if (!timeRegex.test(break_end)) {
          errors.push({ field: `${day}.break_end`, message: `${day}의 휴게 종료 시간 형식이 올바르지 않습니다.` });
        }

        if (timeRegex.test(break_start) && timeRegex.test(break_end)) {
          const breakStartMinutes = this.timeToMinutes(break_start);
          const breakEndMinutes = this.timeToMinutes(break_end);

          if (breakEndMinutes <= breakStartMinutes) {
            errors.push({ field: `${day}.break_end`, message: `${day}의 휴게 종료 시간은 시작 시간보다 늦어야 합니다.` });
          }

          // Validate break times are within operating hours
          if (timeRegex.test(open) && timeRegex.test(close)) {
            const openMinutes = this.timeToMinutes(open);
            const closeMinutes = this.timeToMinutes(close);

            if (breakStartMinutes < openMinutes || breakEndMinutes > closeMinutes) {
              errors.push({ field: `${day}.break_start`, message: `${day}의 휴게 시간은 영업시간 내에 있어야 합니다.` });
            }
          }
        }
      } else if (break_start || break_end) {
        errors.push({ field: `${day}.break_start`, message: `${day}의 휴게 시간은 시작과 종료 시간을 모두 설정해야 합니다.` });
      }
    }

    return errors;
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get current shop status based on operating hours
   */
  private getCurrentStatus(operatingHours: any): {
    is_open: boolean;
    current_day: string;
    current_time: string;
    next_opening?: string;
  } {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];

    const status = {
      is_open: false,
      current_day: currentDay,
      current_time: currentTime,
      next_opening: undefined as string | undefined
    };

    if (!operatingHours || !operatingHours[currentDay]) {
      return status;
    }

    const todayHours = operatingHours[currentDay];

    // Check if shop is closed today
    if (todayHours.closed === true) {
      status.next_opening = this.getNextOpening(operatingHours, now);
      return status;
    }

    if (!todayHours.open || !todayHours.close) {
      return status;
    }

    const currentMinutes = this.timeToMinutes(currentTime);
    const openMinutes = this.timeToMinutes(todayHours.open);
    const closeMinutes = this.timeToMinutes(todayHours.close);

    // Check if currently in break time
    if (todayHours.break_start && todayHours.break_end) {
      const breakStartMinutes = this.timeToMinutes(todayHours.break_start);
      const breakEndMinutes = this.timeToMinutes(todayHours.break_end);

      if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) {
        status.next_opening = `Today at ${todayHours.break_end}`;
        return status;
      }
    }

    // Handle overnight hours
    if (closeMinutes <= openMinutes && closeMinutes < 12 * 60) {
      // Overnight hours (e.g., 22:00 - 02:00)
      status.is_open = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    } else {
      // Regular hours
      status.is_open = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }

    if (!status.is_open) {
      status.next_opening = this.getNextOpening(operatingHours, now);
    }

    return status;
  }

  /**
   * Get next opening time
   */
  private getNextOpening(operatingHours: any, currentDate: Date): string | undefined {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = currentDate.getDay();

    // Check remaining days in the week
    for (let i = 1; i <= 7; i++) {
      const nextDayIndex = (currentDay + i) % 7;
      const nextDayName = dayNames[nextDayIndex];
      const nextDayHours = operatingHours[nextDayName];

      if (nextDayHours && !nextDayHours.closed && nextDayHours.open) {
        const dayLabel = i === 1 ? 'Tomorrow' : nextDayName;
        return `${dayLabel} at ${nextDayHours.open}`;
      }
    }

    return undefined;
  }

  /**
   * Get default operating hours template
   */
  private getDefaultOperatingHours(): WeeklyOperatingHours {
    return {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '10:00', close: '17:00', closed: false },
      sunday: { closed: true }
    };
  }
}

export const shopOperatingHoursController = new ShopOperatingHoursController();
