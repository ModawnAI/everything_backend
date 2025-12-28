/**
 * Shop Staff Controller
 * Handles shop owner management of staff members
 */

import { Request, Response } from 'express';
import { shopStaffService } from '../services/shop-staff.service';
import { logger } from '../utils/logger';

export class ShopStaffController {
  /**
   * GET /api/shop-owner/staff
   * Get all staff for the shop
   */
  async getStaff(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      const { includeInactive } = req.query;

      const staff = await shopStaffService.getStaff(shop.id, {
        includeInactive: includeInactive === 'true',
      });

      res.json({
        success: true,
        data: { staff },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get staff', {
        error: errorMessage,
        shopId: (req as any).shop?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get staff',
      });
    }
  }

  /**
   * GET /api/shop-owner/staff/:id
   * Get a single staff member
   */
  async getStaffById(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;
      const { id } = req.params;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      const staff = await shopStaffService.getStaffById(shop.id, id);

      if (!staff) {
        res.status(404).json({
          success: false,
          error: 'Staff not found',
        });
        return;
      }

      res.json({
        success: true,
        data: staff,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get staff by id', {
        error: errorMessage,
        staffId: req.params.id,
        shopId: (req as any).shop?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get staff',
      });
    }
  }

  /**
   * POST /api/shop-owner/staff
   * Create a new staff member
   */
  async createStaff(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      const { name, nickname, role, phone, email, commissionRate, hireDate, notes, profileImage } =
        req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Name is required',
        });
        return;
      }

      const staff = await shopStaffService.createStaff(shop.id, {
        name,
        nickname,
        role,
        phone,
        email,
        commissionRate,
        hireDate,
        notes,
        profileImage,
      });

      res.status(201).json({
        success: true,
        data: staff,
        message: 'Staff created successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to create staff', {
        error: errorMessage,
        shopId: (req as any).shop?.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * PUT /api/shop-owner/staff/:id
   * Update a staff member
   */
  async updateStaff(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;
      const { id } = req.params;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      const staff = await shopStaffService.updateStaff(shop.id, id, req.body);

      res.json({
        success: true,
        data: staff,
        message: 'Staff updated successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to update staff', {
        error: errorMessage,
        staffId: req.params.id,
        shopId: (req as any).shop?.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * DELETE /api/shop-owner/staff/:id
   * Delete (deactivate) a staff member
   */
  async deleteStaff(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;
      const { id } = req.params;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      await shopStaffService.deleteStaff(shop.id, id);

      res.json({
        success: true,
        message: 'Staff deleted successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to delete staff', {
        error: errorMessage,
        staffId: req.params.id,
        shopId: (req as any).shop?.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * GET /api/shop-owner/staff/revenue
   * Get staff revenue summary
   */
  async getStaffRevenue(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      const { startDate, endDate } = req.query;

      const revenue = await shopStaffService.getStaffRevenue(shop.id, {
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json({
        success: true,
        data: { revenue },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get staff revenue', {
        error: errorMessage,
        shopId: (req as any).shop?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get staff revenue',
      });
    }
  }

  /**
   * POST /api/shop-owner/reservations/:reservationId/assign-staff
   * Assign staff to a reservation
   */
  async assignStaffToReservation(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;
      const { reservationId } = req.params;
      const { staffId } = req.body;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      if (!staffId) {
        res.status(400).json({
          success: false,
          error: 'Staff ID is required',
        });
        return;
      }

      await shopStaffService.assignToReservation(shop.id, reservationId, staffId);

      res.json({
        success: true,
        message: 'Staff assigned successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to assign staff to reservation', {
        error: errorMessage,
        reservationId: req.params.reservationId,
        shopId: (req as any).shop?.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * DELETE /api/shop-owner/reservations/:reservationId/assign-staff
   * Remove staff assignment from a reservation
   */
  async removeStaffFromReservation(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;
      const { reservationId } = req.params;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      await shopStaffService.removeFromReservation(shop.id, reservationId);

      res.json({
        success: true,
        message: 'Staff assignment removed',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to remove staff from reservation', {
        error: errorMessage,
        reservationId: req.params.reservationId,
        shopId: (req as any).shop?.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }
}

export const shopStaffController = new ShopStaffController();
