/**
 * Coupon System Types
 * Types for managing coupons and discount codes
 */

// Coupon discount type
export type CouponDiscountType = 'percentage' | 'fixed_amount';

// Coupon status
export type CouponStatus = 'active' | 'inactive' | 'expired' | 'used_up';

// Coupon scope - what the coupon can be applied to
export type CouponScope = 'all' | 'shop' | 'service' | 'category';

// User coupon status
export type UserCouponStatus = 'available' | 'used' | 'expired';

// Coupon entity
export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  scope: CouponScope;
  scopeIds?: string[]; // shop_ids, service_ids, or category_ids based on scope
  usageLimit?: number; // total usage limit (null = unlimited)
  usageLimitPerUser: number; // per user limit
  usedCount: number;
  startDate: Date;
  endDate: Date;
  status: CouponStatus;
  isPublic: boolean; // can be found/applied by users directly
  createdBy?: string; // admin who created
  shopId?: string; // if shop-specific coupon
  createdAt: Date;
  updatedAt: Date;
}

// User's assigned coupon
export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  coupon?: Coupon;
  status: UserCouponStatus;
  usedAt?: Date;
  usedForReservationId?: string;
  expiresAt: Date;
  createdAt: Date;
}

// Coupon usage record
export interface CouponUsage {
  id: string;
  couponId: string;
  userId: string;
  reservationId: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  usedAt: Date;
}

// DTOs
export interface CreateCouponDto {
  code: string;
  name: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  scope: CouponScope;
  scopeIds?: string[];
  usageLimit?: number;
  usageLimitPerUser?: number;
  startDate: string;
  endDate: string;
  isPublic?: boolean;
  shopId?: string;
}

export interface UpdateCouponDto {
  name?: string;
  description?: string;
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  startDate?: string;
  endDate?: string;
  status?: CouponStatus;
  isPublic?: boolean;
}

export interface AssignCouponDto {
  couponId: string;
  userIds: string[];
  expiresAt?: string;
}

export interface ApplyCouponDto {
  code: string;
  reservationId: string;
  orderAmount: number;
  shopId?: string;
  serviceIds?: string[];
}

export interface ValidateCouponDto {
  code: string;
  orderAmount: number;
  shopId?: string;
  serviceIds?: string[];
}

// Response types
export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  finalAmount: number;
  message?: string;
  errorCode?: string;
}

export interface CouponListFilters {
  status?: CouponStatus;
  scope?: CouponScope;
  shopId?: string;
  isPublic?: boolean;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  search?: string;
}

export interface UserCouponListFilters {
  status?: UserCouponStatus;
}
