/**
 * Coupon Routes
 * API endpoints for coupon management
 */

import { Router } from 'express';
import { couponController } from '../controllers/coupon.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { requireShopOwnerWithShop } from '../middleware/shop-owner-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

// User routes
const userRouter = Router();

const generalRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    strategy: 'fixed_window',
  },
});

// Public endpoints
userRouter.get(
  '/public',
  generalRateLimit,
  couponController.getPublicCoupons.bind(couponController)
);

// Authenticated endpoints
userRouter.get(
  '/my',
  authenticateJWT(),
  generalRateLimit,
  couponController.getUserCoupons.bind(couponController)
);

userRouter.post(
  '/validate',
  authenticateJWT(),
  generalRateLimit,
  couponController.validateCoupon.bind(couponController)
);

userRouter.post(
  '/apply',
  authenticateJWT(),
  generalRateLimit,
  couponController.applyCoupon.bind(couponController)
);

// Admin routes
const adminRouter = Router();

adminRouter.use(authenticateJWT());
adminRouter.use(requireAdminAuth);

adminRouter.post(
  '/',
  generalRateLimit,
  couponController.createCoupon.bind(couponController)
);

adminRouter.get(
  '/',
  generalRateLimit,
  couponController.listCoupons.bind(couponController)
);

adminRouter.get(
  '/:couponId',
  generalRateLimit,
  couponController.getCoupon.bind(couponController)
);

adminRouter.put(
  '/:couponId',
  generalRateLimit,
  couponController.updateCoupon.bind(couponController)
);

adminRouter.delete(
  '/:couponId',
  generalRateLimit,
  couponController.deleteCoupon.bind(couponController)
);

adminRouter.post(
  '/assign',
  generalRateLimit,
  couponController.assignCoupon.bind(couponController)
);

// Shop Owner routes
const shopOwnerRouter = Router();

shopOwnerRouter.use(authenticateJWT());
shopOwnerRouter.use(requireShopOwnerWithShop);

shopOwnerRouter.post(
  '/',
  generalRateLimit,
  couponController.createShopCoupon.bind(couponController)
);

shopOwnerRouter.get(
  '/',
  generalRateLimit,
  couponController.listShopCoupons.bind(couponController)
);

shopOwnerRouter.put(
  '/:couponId',
  generalRateLimit,
  couponController.updateShopCoupon.bind(couponController)
);

shopOwnerRouter.delete(
  '/:couponId',
  generalRateLimit,
  couponController.deleteShopCoupon.bind(couponController)
);

export { userRouter as couponUserRoutes, adminRouter as couponAdminRoutes, shopOwnerRouter as couponShopOwnerRoutes };
