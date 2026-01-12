/**
 * Coupon Service
 * Handles coupon creation, validation, and usage
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import type {
  Coupon,
  UserCoupon,
  CouponUsage,
  CreateCouponDto,
  UpdateCouponDto,
  AssignCouponDto,
  ApplyCouponDto,
  ValidateCouponDto,
  CouponValidationResult,
  CouponListFilters,
  UserCouponListFilters,
  CouponStatus,
} from '../types/coupon.types';

class CouponService {
  // ==================== Coupon Management ====================

  /**
   * Create a new coupon
   */
  async createCoupon(coupon: CreateCouponDto, createdBy?: string): Promise<Coupon> {
    const supabase = getSupabaseClient();

    // Check if code already exists
    const { data: existing } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', coupon.code.toUpperCase())
      .single();

    if (existing) {
      throw new Error('쿠폰 코드가 이미 존재합니다.');
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code: coupon.code.toUpperCase(),
        name: coupon.name,
        description: coupon.description,
        discount_type: coupon.discountType,
        discount_value: coupon.discountValue,
        min_order_amount: coupon.minOrderAmount,
        max_discount_amount: coupon.maxDiscountAmount,
        scope: coupon.scope,
        scope_ids: coupon.scopeIds,
        usage_limit: coupon.usageLimit,
        usage_limit_per_user: coupon.usageLimitPerUser || 1,
        used_count: 0,
        start_date: coupon.startDate,
        end_date: coupon.endDate,
        status: 'active',
        is_public: coupon.isPublic ?? true,
        created_by: createdBy,
        shop_id: coupon.shopId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating coupon:', error);
      throw new Error('쿠폰 생성에 실패했습니다.');
    }

    return this.mapCouponFromDb(data);
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(couponId: string): Promise<Coupon | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', couponId)
      .single();

    if (error || !data) return null;
    return this.mapCouponFromDb(data);
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !data) return null;
    return this.mapCouponFromDb(data);
  }

  /**
   * List coupons with filters
   */
  async listCoupons(
    filters: CouponListFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ coupons: Coupon[]; total: number }> {
    const supabase = getSupabaseClient();
    const offset = (page - 1) * limit;

    let query = supabase.from('coupons').select('*', { count: 'exact' });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.scope) {
      query = query.eq('scope', filters.scope);
    }
    if (filters.shopId) {
      query = query.eq('shop_id', filters.shopId);
    }
    if (filters.isPublic !== undefined) {
      query = query.eq('is_public', filters.isPublic);
    }
    if (filters.search) {
      query = query.or(
        `code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error listing coupons:', error);
      throw new Error('쿠폰 목록 조회에 실패했습니다.');
    }

    return {
      coupons: (data || []).map(this.mapCouponFromDb),
      total: count || 0,
    };
  }

  /**
   * Update a coupon
   */
  async updateCoupon(couponId: string, update: UpdateCouponDto): Promise<Coupon> {
    const supabase = getSupabaseClient();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (update.name !== undefined) updateData.name = update.name;
    if (update.description !== undefined) updateData.description = update.description;
    if (update.discountValue !== undefined) updateData.discount_value = update.discountValue;
    if (update.minOrderAmount !== undefined) updateData.min_order_amount = update.minOrderAmount;
    if (update.maxDiscountAmount !== undefined) updateData.max_discount_amount = update.maxDiscountAmount;
    if (update.usageLimit !== undefined) updateData.usage_limit = update.usageLimit;
    if (update.usageLimitPerUser !== undefined) updateData.usage_limit_per_user = update.usageLimitPerUser;
    if (update.startDate !== undefined) updateData.start_date = update.startDate;
    if (update.endDate !== undefined) updateData.end_date = update.endDate;
    if (update.status !== undefined) updateData.status = update.status;
    if (update.isPublic !== undefined) updateData.is_public = update.isPublic;

    const { data, error } = await supabase
      .from('coupons')
      .update(updateData)
      .eq('id', couponId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating coupon:', error);
      throw new Error('쿠폰 수정에 실패했습니다.');
    }

    return this.mapCouponFromDb(data);
  }

  /**
   * Delete a coupon (soft delete by setting status to inactive)
   */
  async deleteCoupon(couponId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('coupons')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', couponId);

    if (error) {
      logger.error('Error deleting coupon:', error);
      throw new Error('쿠폰 삭제에 실패했습니다.');
    }
  }

  // ==================== User Coupon Management ====================

  /**
   * Assign coupon to users
   */
  async assignCouponToUsers(data: AssignCouponDto): Promise<UserCoupon[]> {
    const supabase = getSupabaseClient();

    // Get coupon
    const coupon = await this.getCouponById(data.couponId);
    if (!coupon) {
      throw new Error('쿠폰을 찾을 수 없습니다.');
    }

    const expiresAt = data.expiresAt || coupon.endDate.toISOString();

    const userCoupons = data.userIds.map((userId) => ({
      user_id: userId,
      coupon_id: data.couponId,
      status: 'available',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    }));

    const { data: inserted, error } = await supabase
      .from('user_coupons')
      .insert(userCoupons)
      .select();

    if (error) {
      logger.error('Error assigning coupons:', error);
      throw new Error('쿠폰 발급에 실패했습니다.');
    }

    return (inserted || []).map(this.mapUserCouponFromDb);
  }

  /**
   * Get user's coupons
   */
  async getUserCoupons(
    userId: string,
    filters?: UserCouponListFilters
  ): Promise<UserCoupon[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('user_coupons')
      .select('*, coupon:coupons(*)')
      .eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching user coupons:', error);
      throw new Error('쿠폰 목록 조회에 실패했습니다.');
    }

    // Also expire any coupons that have passed expiration
    const now = new Date();
    const result = (data || []).map((uc: any) => {
      const mapped = this.mapUserCouponFromDb(uc);
      if (mapped.status === 'available' && new Date(mapped.expiresAt) < now) {
        mapped.status = 'expired';
      }
      return mapped;
    });

    return result;
  }

  // ==================== Coupon Validation & Usage ====================

  /**
   * Validate a coupon code for an order
   */
  async validateCoupon(
    userId: string,
    params: ValidateCouponDto
  ): Promise<CouponValidationResult> {
    const supabase = getSupabaseClient();

    // Get coupon
    const coupon = await this.getCouponByCode(params.code);
    if (!coupon) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: params.orderAmount,
        message: '존재하지 않는 쿠폰입니다.',
        errorCode: 'COUPON_NOT_FOUND',
      };
    }

    // Check status
    if (coupon.status !== 'active') {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: params.orderAmount,
        message: '사용할 수 없는 쿠폰입니다.',
        errorCode: 'COUPON_INACTIVE',
      };
    }

    // Check dates
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: params.orderAmount,
        message: '쿠폰 사용 기간이 아닙니다.',
        errorCode: 'COUPON_EXPIRED',
      };
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: params.orderAmount,
        message: '쿠폰이 모두 소진되었습니다.',
        errorCode: 'COUPON_EXHAUSTED',
      };
    }

    // Check user usage limit
    const { count: userUsageCount } = await supabase
      .from('coupon_usages')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId);

    if ((userUsageCount || 0) >= coupon.usageLimitPerUser) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: params.orderAmount,
        message: '이 쿠폰의 사용 횟수를 초과했습니다.',
        errorCode: 'USER_LIMIT_EXCEEDED',
      };
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && params.orderAmount < coupon.minOrderAmount) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: params.orderAmount,
        message: `최소 주문 금액 ${coupon.minOrderAmount.toLocaleString()}원 이상이어야 합니다.`,
        errorCode: 'MIN_ORDER_NOT_MET',
      };
    }

    // Check scope
    if (coupon.scope !== 'all') {
      if (coupon.scope === 'shop' && coupon.scopeIds && params.shopId) {
        if (!coupon.scopeIds.includes(params.shopId)) {
          return {
            valid: false,
            discountAmount: 0,
            finalAmount: params.orderAmount,
            message: '이 매장에서는 사용할 수 없는 쿠폰입니다.',
            errorCode: 'SCOPE_NOT_MATCHED',
          };
        }
      }
      if (coupon.scope === 'service' && coupon.scopeIds && params.serviceIds) {
        const hasMatchingService = params.serviceIds.some((id) =>
          coupon.scopeIds!.includes(id)
        );
        if (!hasMatchingService) {
          return {
            valid: false,
            discountAmount: 0,
            finalAmount: params.orderAmount,
            message: '적용 가능한 서비스가 없습니다.',
            errorCode: 'SCOPE_NOT_MATCHED',
          };
        }
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.floor(params.orderAmount * (coupon.discountValue / 100));
    } else {
      discountAmount = coupon.discountValue;
    }

    // Apply max discount
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount;
    }

    // Ensure discount doesn't exceed order amount
    if (discountAmount > params.orderAmount) {
      discountAmount = params.orderAmount;
    }

    return {
      valid: true,
      coupon,
      discountAmount,
      finalAmount: params.orderAmount - discountAmount,
    };
  }

  /**
   * Apply a coupon to a reservation
   */
  async applyCoupon(userId: string, params: ApplyCouponDto): Promise<CouponUsage> {
    const supabase = getSupabaseClient();

    // Validate first
    const validation = await this.validateCoupon(userId, {
      code: params.code,
      orderAmount: params.orderAmount,
      shopId: params.shopId,
      serviceIds: params.serviceIds,
    });

    if (!validation.valid || !validation.coupon) {
      throw new Error(validation.message || '쿠폰을 적용할 수 없습니다.');
    }

    // Create usage record
    const { data: usage, error: usageError } = await supabase
      .from('coupon_usages')
      .insert({
        coupon_id: validation.coupon.id,
        user_id: userId,
        reservation_id: params.reservationId,
        discount_amount: validation.discountAmount,
        original_amount: params.orderAmount,
        final_amount: validation.finalAmount,
        used_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (usageError) {
      logger.error('Error creating coupon usage:', usageError);
      throw new Error('쿠폰 적용에 실패했습니다.');
    }

    // Increment used count
    await supabase
      .from('coupons')
      .update({
        used_count: validation.coupon.usedCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validation.coupon.id);

    // Update user coupon status if exists
    await supabase
      .from('user_coupons')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_for_reservation_id: params.reservationId,
      })
      .eq('user_id', userId)
      .eq('coupon_id', validation.coupon.id)
      .eq('status', 'available');

    return {
      id: usage.id,
      couponId: usage.coupon_id,
      userId: usage.user_id,
      reservationId: usage.reservation_id,
      discountAmount: usage.discount_amount,
      originalAmount: usage.original_amount,
      finalAmount: usage.final_amount,
      usedAt: new Date(usage.used_at),
    };
  }

  /**
   * Get available public coupons
   */
  async getPublicCoupons(shopId?: string): Promise<Coupon[]> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    let query = supabase
      .from('coupons')
      .select('*')
      .eq('status', 'active')
      .eq('is_public', true)
      .lte('start_date', now)
      .gte('end_date', now);

    if (shopId) {
      query = query.or(`shop_id.eq.${shopId},shop_id.is.null`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching public coupons:', error);
      return [];
    }

    return (data || []).map(this.mapCouponFromDb);
  }

  // ==================== Helper Methods ====================

  private mapCouponFromDb(data: any): Coupon {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      discountType: data.discount_type,
      discountValue: data.discount_value,
      minOrderAmount: data.min_order_amount,
      maxDiscountAmount: data.max_discount_amount,
      scope: data.scope,
      scopeIds: data.scope_ids,
      usageLimit: data.usage_limit,
      usageLimitPerUser: data.usage_limit_per_user,
      usedCount: data.used_count,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      status: data.status,
      isPublic: data.is_public,
      createdBy: data.created_by,
      shopId: data.shop_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapUserCouponFromDb(data: any): UserCoupon {
    return {
      id: data.id,
      userId: data.user_id,
      couponId: data.coupon_id,
      coupon: data.coupon ? this.mapCouponFromDb(data.coupon) : undefined,
      status: data.status,
      usedAt: data.used_at ? new Date(data.used_at) : undefined,
      usedForReservationId: data.used_for_reservation_id,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
    };
  }
}

export const couponService = new CouponService();
export default couponService;
