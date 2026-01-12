/**
 * Staff Schedule Controller
 * Handles HTTP requests for staff schedule and day off management
 */

import { Request, Response, NextFunction } from 'express';
import { staffScheduleService } from '../services/staff-schedule.service';
import type {
  CreateStaffScheduleDto,
  SetWeeklyScheduleDto,
  CreateDayOffDto,
  UpdateDayOffDto,
} from '../types/staff-schedule.types';

class StaffScheduleController {
  // ==================== Schedule Management ====================

  /**
   * GET /api/shop-owner/staff/:staffId/schedule
   * Get weekly schedule for a staff member
   */
  async getStaffSchedule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { staffId } = req.params;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      const schedules = await staffScheduleService.getStaffSchedule(
        shopId,
        staffId
      );

      res.json({
        success: true,
        data: { schedules },
      });
    } catch (error: any) {
      console.error('Error getting staff schedule:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get staff schedule',
        },
      });
    }
  }

  /**
   * GET /api/shop-owner/staff/schedules
   * Get all staff schedules for the shop
   */
  async getAllStaffSchedules(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      const staffSchedules =
        await staffScheduleService.getAllStaffSchedules(shopId);

      res.json({
        success: true,
        data: { staffSchedules },
      });
    } catch (error: any) {
      console.error('Error getting all staff schedules:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get staff schedules',
        },
      });
    }
  }

  /**
   * PUT /api/shop-owner/staff/:staffId/schedule/:dayOfWeek
   * Set/update schedule for a specific day
   */
  async setDaySchedule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { staffId, dayOfWeek } = req.params;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      const scheduleData: CreateStaffScheduleDto = {
        dayOfWeek: parseInt(dayOfWeek) as any,
        isWorking: req.body.isWorking,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        breakStartTime: req.body.breakStartTime,
        breakEndTime: req.body.breakEndTime,
      };

      const schedule = await staffScheduleService.setDaySchedule(
        shopId,
        staffId,
        scheduleData
      );

      res.json({
        success: true,
        data: { schedule },
        message: 'Schedule updated successfully',
      });
    } catch (error: any) {
      console.error('Error setting day schedule:', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'SCHEDULE_UPDATE_FAILED',
          message: error.message || 'Failed to update schedule',
        },
      });
    }
  }

  /**
   * PUT /api/shop-owner/staff/:staffId/schedule
   * Set weekly schedule for a staff member (all 7 days)
   */
  async setWeeklySchedule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { staffId } = req.params;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      const weeklySchedule: SetWeeklyScheduleDto = {
        schedules: req.body.schedules,
      };

      const schedules = await staffScheduleService.setWeeklySchedule(
        shopId,
        staffId,
        weeklySchedule
      );

      res.json({
        success: true,
        data: { schedules },
        message: 'Weekly schedule updated successfully',
      });
    } catch (error: any) {
      console.error('Error setting weekly schedule:', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'SCHEDULE_UPDATE_FAILED',
          message: error.message || 'Failed to update weekly schedule',
        },
      });
    }
  }

  // ==================== Day Off Management ====================

  /**
   * GET /api/shop-owner/staff/:staffId/dayoffs
   * Get day offs for a staff member
   */
  async getStaffDayOffs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { staffId } = req.params;
      const { startDate, endDate } = req.query;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      const dayOffs = await staffScheduleService.getStaffDayOffs(
        shopId,
        staffId,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: { dayOffs },
      });
    } catch (error: any) {
      console.error('Error getting day offs:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get day offs',
        },
      });
    }
  }

  /**
   * POST /api/shop-owner/staff/:staffId/dayoffs
   * Create a day off
   */
  async createDayOff(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { staffId } = req.params;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      const dayOffData: CreateDayOffDto = {
        date: req.body.date,
        reason: req.body.reason,
        isRecurring: req.body.isRecurring,
        recurringPattern: req.body.recurringPattern,
      };

      const dayOff = await staffScheduleService.createDayOff(
        shopId,
        staffId,
        dayOffData
      );

      res.status(201).json({
        success: true,
        data: { dayOff },
        message: 'Day off created successfully',
      });
    } catch (error: any) {
      console.error('Error creating day off:', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'DAY_OFF_CREATE_FAILED',
          message: error.message || 'Failed to create day off',
        },
      });
    }
  }

  /**
   * PUT /api/shop-owner/staff/:staffId/dayoffs/:dayOffId
   * Update a day off
   */
  async updateDayOff(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { dayOffId } = req.params;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      const updateData: UpdateDayOffDto = {
        date: req.body.date,
        reason: req.body.reason,
        isRecurring: req.body.isRecurring,
        recurringPattern: req.body.recurringPattern,
      };

      const dayOff = await staffScheduleService.updateDayOff(
        shopId,
        dayOffId,
        updateData
      );

      res.json({
        success: true,
        data: { dayOff },
        message: 'Day off updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating day off:', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'DAY_OFF_UPDATE_FAILED',
          message: error.message || 'Failed to update day off',
        },
      });
    }
  }

  /**
   * DELETE /api/shop-owner/staff/:staffId/dayoffs/:dayOffId
   * Delete a day off
   */
  async deleteDayOff(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { dayOffId } = req.params;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      await staffScheduleService.deleteDayOff(shopId, dayOffId);

      res.json({
        success: true,
        message: 'Day off deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting day off:', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'DAY_OFF_DELETE_FAILED',
          message: error.message || 'Failed to delete day off',
        },
      });
    }
  }

  // ==================== Availability ====================

  /**
   * GET /api/shop-owner/staff/:staffId/availability
   * Get staff availability for a specific date
   */
  async getStaffAvailability(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { staffId } = req.params;
      const { date } = req.query;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      if (!date) {
        res.status(400).json({
          success: false,
          error: { code: 'DATE_REQUIRED', message: 'Date is required' },
        });
        return;
      }

      const availability = await staffScheduleService.getStaffAvailability(
        shopId,
        staffId,
        date as string
      );

      res.json({
        success: true,
        data: { availability },
      });
    } catch (error: any) {
      console.error('Error getting staff availability:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get staff availability',
        },
      });
    }
  }

  /**
   * GET /api/shop-owner/staff/availability
   * Get all staff availability for a specific date
   */
  async getAllStaffAvailability(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const shopId = (req as any).shopId;
      const { date } = req.query;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { code: 'SHOP_ID_REQUIRED', message: 'Shop ID is required' },
        });
        return;
      }

      if (!date) {
        res.status(400).json({
          success: false,
          error: { code: 'DATE_REQUIRED', message: 'Date is required' },
        });
        return;
      }

      const availabilities = await staffScheduleService.getAllStaffAvailability(
        shopId,
        date as string
      );

      res.json({
        success: true,
        data: { availabilities },
      });
    } catch (error: any) {
      console.error('Error getting all staff availability:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get staff availability',
        },
      });
    }
  }
}

export const staffScheduleController = new StaffScheduleController();
export default staffScheduleController;
