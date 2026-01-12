/**
 * Coupon Controller
 * Handles HTTP requests for coupon management
 */

import { Request, Response, NextFunction } from 'express';
import { couponService } from '../services/coupon.service';
import { logger } from '../utils/logger';

class CouponController {
  // ==================== Admin Coupon Management ====================

  /**
   * Create a new coupon
   * POST /api/admin/coupons
   */
  async createCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const coupon = await couponService.createCoupon(req.body, userId);
      res.status(201).json({
        success: true,
        data: { coupon },
      });
    } catch (error: any) {
      logger.error('Error creating coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Get coupon by ID
   * GET /api/admin/coupons/:couponId
   */
  async getCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { couponId } = req.params;
      const coupon = await couponService.getCouponById(couponId);
      if (!coupon) {
        return res.status(404).json({
          success: false,
          error: { message: '쿠폰을 찾을 수 없습니다.' },
        });
      }
      res.json({
        success: true,
        data: { coupon },
      });
    } catch (error: any) {
      logger.error('Error getting coupon:', error);
      res.status(500).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * List coupons with filters
   * GET /api/admin/coupons
   */
  async listCoupons(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        status,
        scope,
        shopId,
        isPublic,
        search,
        page = '1',
        limit = '20',
      } = req.query;

      const result = await couponService.listCoupons(
        {
          status: status as any,
          scope: scope as any,
          shopId: shopId as string,
          isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
          search: search as string,
        },
        parseInt(page as string, 10),
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error listing coupons:', error);
      res.status(500).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Update a coupon
   * PUT /api/admin/coupons/:couponId
   */
  async updateCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { couponId } = req.params;
      const coupon = await couponService.updateCoupon(couponId, req.body);
      res.json({
        success: true,
        data: { coupon },
      });
    } catch (error: any) {
      logger.error('Error updating coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Delete a coupon
   * DELETE /api/admin/coupons/:couponId
   */
  async deleteCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { couponId } = req.params;
      await couponService.deleteCoupon(couponId);
      res.json({
        success: true,
        message: '쿠폰이 삭제되었습니다.',
      });
    } catch (error: any) {
      logger.error('Error deleting coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Assign coupon to users
   * POST /api/admin/coupons/assign
   */
  async assignCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const userCoupons = await couponService.assignCouponToUsers(req.body);
      res.status(201).json({
        success: true,
        data: { userCoupons },
        message: `${userCoupons.length}명에게 쿠폰이 발급되었습니다.`,
      });
    } catch (error: any) {
      logger.error('Error assigning coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  // ==================== User Coupon Operations ====================

  /**
   * Get user's coupons
   * GET /api/coupons/my
   */
  async getUserCoupons(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: '로그인이 필요합니다.' },
        });
      }

      const { status } = req.query;
      const coupons = await couponService.getUserCoupons(userId, {
        status: status as any,
      });

      res.json({
        success: true,
        data: { coupons },
      });
    } catch (error: any) {
      logger.error('Error getting user coupons:', error);
      res.status(500).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Get available public coupons
   * GET /api/coupons/public
   */
  async getPublicCoupons(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopId } = req.query;
      const coupons = await couponService.getPublicCoupons(shopId as string);
      res.json({
        success: true,
        data: { coupons },
      });
    } catch (error: any) {
      logger.error('Error getting public coupons:', error);
      res.status(500).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Validate a coupon code
   * POST /api/coupons/validate
   */
  async validateCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: '로그인이 필요합니다.' },
        });
      }

      const result = await couponService.validateCoupon(userId, req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error validating coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Apply a coupon to a reservation
   * POST /api/coupons/apply
   */
  async applyCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: '로그인이 필요합니다.' },
        });
      }

      const usage = await couponService.applyCoupon(userId, req.body);
      res.json({
        success: true,
        data: { usage },
        message: '쿠폰이 적용되었습니다.',
      });
    } catch (error: any) {
      logger.error('Error applying coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  // ==================== Shop Owner Coupon Management ====================

  /**
   * Create shop coupon
   * POST /api/shop-owner/coupons
   */
  async createShopCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const shopId = (req as any).shopId;

      if (!shopId) {
        return res.status(400).json({
          success: false,
          error: { message: '매장 정보를 찾을 수 없습니다.' },
        });
      }

      const coupon = await couponService.createCoupon(
        { ...req.body, shopId },
        userId
      );

      res.status(201).json({
        success: true,
        data: { coupon },
      });
    } catch (error: any) {
      logger.error('Error creating shop coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * List shop coupons
   * GET /api/shop-owner/coupons
   */
  async listShopCoupons(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = (req as any).shopId;

      if (!shopId) {
        return res.status(400).json({
          success: false,
          error: { message: '매장 정보를 찾을 수 없습니다.' },
        });
      }

      const {
        status,
        search,
        page = '1',
        limit = '20',
      } = req.query;

      const result = await couponService.listCoupons(
        {
          shopId,
          status: status as any,
          search: search as string,
        },
        parseInt(page as string, 10),
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error listing shop coupons:', error);
      res.status(500).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Update shop coupon
   * PUT /api/shop-owner/coupons/:couponId
   */
  async updateShopCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = (req as any).shopId;
      const { couponId } = req.params;

      // Verify ownership
      const existingCoupon = await couponService.getCouponById(couponId);
      if (!existingCoupon || existingCoupon.shopId !== shopId) {
        return res.status(404).json({
          success: false,
          error: { message: '쿠폰을 찾을 수 없습니다.' },
        });
      }

      const coupon = await couponService.updateCoupon(couponId, req.body);
      res.json({
        success: true,
        data: { coupon },
      });
    } catch (error: any) {
      logger.error('Error updating shop coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * Delete shop coupon
   * DELETE /api/shop-owner/coupons/:couponId
   */
  async deleteShopCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = (req as any).shopId;
      const { couponId } = req.params;

      // Verify ownership
      const existingCoupon = await couponService.getCouponById(couponId);
      if (!existingCoupon || existingCoupon.shopId !== shopId) {
        return res.status(404).json({
          success: false,
          error: { message: '쿠폰을 찾을 수 없습니다.' },
        });
      }

      await couponService.deleteCoupon(couponId);
      res.json({
        success: true,
        message: '쿠폰이 삭제되었습니다.',
      });
    } catch (error: any) {
      logger.error('Error deleting shop coupon:', error);
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }
  }
}

export const couponController = new CouponController();
export default couponController;
