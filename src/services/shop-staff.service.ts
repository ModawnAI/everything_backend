import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  ShopStaff,
  CreateStaffDto,
  UpdateStaffDto,
  StaffRevenueSummary,
} from '../types/shop-staff.types';

class ShopStaffService {
  /**
   * Get all staff for a shop
   */
  async getStaff(
    shopId: string,
    options: { includeInactive?: boolean } = {}
  ): Promise<ShopStaff[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('shop_staff')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at');

    if (!options.includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch staff', { error, shopId });
      throw new Error(`Failed to fetch staff: ${error.message}`);
    }

    return (data || []).map(this.mapStaff);
  }

  /**
   * Get single staff member
   */
  async getStaffById(shopId: string, staffId: string): Promise<ShopStaff | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('shop_staff')
      .select('*')
      .eq('id', staffId)
      .eq('shop_id', shopId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Failed to fetch staff by id', { error, staffId, shopId });
      return null;
    }

    return this.mapStaff(data);
  }

  /**
   * Create new staff member
   */
  async createStaff(shopId: string, dto: CreateStaffDto): Promise<ShopStaff> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('shop_staff')
      .insert({
        shop_id: shopId,
        name: dto.name,
        nickname: dto.nickname,
        profile_image: dto.profileImage,
        role: dto.role || 'staff',
        phone: dto.phone,
        email: dto.email,
        commission_rate: dto.commissionRate || 0,
        hire_date: dto.hireDate,
        notes: dto.notes,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create staff', { error, shopId, dto });
      throw new Error(`Failed to create staff: ${error.message}`);
    }

    logger.info('Staff created', { staffId: data.id, shopId });
    return this.mapStaff(data);
  }

  /**
   * Update staff member
   */
  async updateStaff(
    shopId: string,
    staffId: string,
    dto: UpdateStaffDto
  ): Promise<ShopStaff> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    if (dto.profileImage !== undefined) updateData.profile_image = dto.profileImage;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.commissionRate !== undefined) updateData.commission_rate = dto.commissionRate;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;
    if (dto.hireDate !== undefined) updateData.hire_date = dto.hireDate;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const { data, error } = await supabase
      .from('shop_staff')
      .update(updateData)
      .eq('id', staffId)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update staff', { error, staffId, shopId });
      throw new Error(`Failed to update staff: ${error.message}`);
    }

    logger.info('Staff updated', { staffId, shopId });
    return this.mapStaff(data);
  }

  /**
   * Delete (deactivate) staff member
   */
  async deleteStaff(shopId: string, staffId: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from('shop_staff')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', staffId)
      .eq('shop_id', shopId);

    if (error) {
      logger.error('Failed to delete staff', { error, staffId, shopId });
      throw new Error(`Failed to delete staff: ${error.message}`);
    }

    logger.info('Staff deactivated', { staffId, shopId });
  }

  /**
   * Get staff revenue summary
   */
  async getStaffRevenue(
    shopId: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<StaffRevenueSummary[]> {
    const supabase = getSupabaseClient();
    const { startDate, endDate } = options;

    // Try to use the view first
    const { data, error } = await supabase
      .from('staff_revenue_summary')
      .select('*')
      .eq('shop_id', shopId);

    if (error) {
      logger.warn('Failed to use staff_revenue_summary view, falling back to manual calculation', { error });
      // Fallback to manual calculation
      return this.calculateStaffRevenue(shopId, startDate, endDate);
    }

    return (data || []).map(item => ({
      staffId: item.staff_id,
      staffName: item.staff_name,
      staffNickname: item.staff_nickname,
      staffRole: item.staff_role,
      commissionRate: parseFloat(item.commission_rate) || 0,
      totalReservations: parseInt(item.total_reservations) || 0,
      totalRevenue: parseFloat(item.total_revenue) || 0,
      completedCount: parseInt(item.completed_count) || 0,
      avgRating: parseFloat(item.avg_rating) || 0,
    }));
  }

  /**
   * Manual revenue calculation fallback
   */
  private async calculateStaffRevenue(
    shopId: string,
    startDate?: string,
    endDate?: string
  ): Promise<StaffRevenueSummary[]> {
    const supabase = getSupabaseClient();

    // Get staff list
    const staff = await this.getStaff(shopId);

    const summaries: StaffRevenueSummary[] = [];

    for (const s of staff) {
      let query = supabase
        .from('reservations')
        .select(`
          id,
          status,
          created_at
        `)
        .eq('staff_id', s.id);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: reservations } = await query;

      const totalReservations = reservations?.length || 0;
      const completedReservations = reservations?.filter(r => r.status === 'completed') || [];

      // Get payments for completed reservations
      let totalRevenue = 0;
      if (completedReservations.length > 0) {
        const reservationIds = completedReservations.map(r => r.id);
        const { data: payments } = await supabase
          .from('payments')
          .select('amount')
          .in('reservation_id', reservationIds);

        totalRevenue = (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      }

      // Get ratings
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .in('reservation_id', (reservations || []).map(r => r.id));

      const ratings = (reviews || []).map(r => r.rating).filter(Boolean);
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

      summaries.push({
        staffId: s.id,
        staffName: s.name,
        staffNickname: s.nickname,
        staffRole: s.role,
        commissionRate: s.commissionRate,
        totalReservations,
        totalRevenue,
        completedCount: completedReservations.length,
        avgRating,
      });
    }

    return summaries;
  }

  /**
   * Assign staff to reservation
   */
  async assignToReservation(
    shopId: string,
    reservationId: string,
    staffId: string
  ): Promise<void> {
    const supabase = getSupabaseClient();

    // Verify staff belongs to shop
    const staff = await this.getStaffById(shopId, staffId);
    if (!staff) {
      throw new Error('Staff not found');
    }

    const { error } = await supabase
      .from('reservations')
      .update({ staff_id: staffId })
      .eq('id', reservationId)
      .eq('shop_id', shopId);

    if (error) {
      logger.error('Failed to assign staff to reservation', {
        error,
        staffId,
        reservationId,
        shopId
      });
      throw new Error(`Failed to assign staff: ${error.message}`);
    }

    logger.info('Staff assigned to reservation', { staffId, reservationId, shopId });
  }

  /**
   * Remove staff assignment from reservation
   */
  async removeFromReservation(
    shopId: string,
    reservationId: string
  ): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('reservations')
      .update({ staff_id: null })
      .eq('id', reservationId)
      .eq('shop_id', shopId);

    if (error) {
      logger.error('Failed to remove staff from reservation', {
        error,
        reservationId,
        shopId
      });
      throw new Error(`Failed to remove staff: ${error.message}`);
    }
  }

  private mapStaff(data: any): ShopStaff {
    return {
      id: data.id,
      shopId: data.shop_id,
      name: data.name,
      nickname: data.nickname,
      profileImage: data.profile_image,
      role: data.role,
      phone: data.phone,
      email: data.email,
      commissionRate: parseFloat(data.commission_rate) || 0,
      isActive: data.is_active,
      hireDate: data.hire_date ? new Date(data.hire_date) : undefined,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const shopStaffService = new ShopStaffService();
