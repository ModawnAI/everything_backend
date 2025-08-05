import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ReservationStatus } from '../types/database.types';

export interface ReservationFilters {
  status?: ReservationStatus;
  shopId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string; // Search in customer name, phone, shop name
  minAmount?: number;
  maxAmount?: number;
  hasPointsUsed?: boolean;
  sortBy?: 'reservation_datetime' | 'created_at' | 'total_amount' | 'customer_name' | 'shop_name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ReservationListResponse {
  reservations: Array<{
    id: string;
    reservationDate: string;
    reservationTime: string;
    reservationDatetime: string;
    status: ReservationStatus;
    totalAmount: number;
    depositAmount: number;
    remainingAmount?: number;
    pointsUsed: number;
    pointsEarned: number;
    specialRequests?: string;
    cancellationReason?: string;
    noShowReason?: string;
    confirmedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
    createdAt: string;
    updatedAt: string;
    // Customer information
    customer: {
      id: string;
      name: string;
      email?: string;
      phoneNumber?: string;
      userStatus: string;
    };
    // Shop information
    shop: {
      id: string;
      name: string;
      address: string;
      mainCategory: string;
      shopStatus: string;
    };
    // Services information
    services: Array<{
      id: string;
      name: string;
      category: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    // Payment information
    payments: Array<{
      id: string;
      paymentMethod: string;
      paymentStatus: string;
      amount: number;
      paidAt?: string;
    }>;
    // Computed fields
    daysUntilReservation?: number;
    isOverdue: boolean;
    isToday: boolean;
    isPast: boolean;
    totalPaidAmount: number;
    outstandingAmount: number;
  }>;
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  filters: ReservationFilters;
}

export interface ReservationStatusUpdateRequest {
  status: ReservationStatus;
  notes?: string;
  reason?: string;
  notifyCustomer?: boolean;
  notifyShop?: boolean;
  autoProcessPayment?: boolean;
}

export interface ReservationStatusUpdateResult {
  success: boolean;
  reservation: {
    id: string;
    previousStatus: ReservationStatus;
    newStatus: ReservationStatus;
    updatedAt: string;
  };
  action: {
    type: 'status_update';
    reason?: string;
    notes?: string;
    performedBy: string;
    performedAt: string;
  };
}

export interface ReservationDisputeRequest {
  disputeType: 'customer_complaint' | 'shop_issue' | 'payment_dispute' | 'service_quality' | 'other';
  description: string;
  requestedAction: 'refund' | 'reschedule' | 'compensation' | 'investigation' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  evidence?: string[]; // URLs to evidence files
}

export interface ReservationDisputeResult {
  success: boolean;
  dispute: {
    id: string;
    reservationId: string;
    disputeType: string;
    status: 'open' | 'investigating' | 'resolved' | 'closed';
    priority: string;
    createdAt: string;
  };
}

export interface ReservationAnalytics {
  totalReservations: number;
  activeReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  noShowReservations: number;
  totalRevenue: number;
  averageReservationValue: number;
  reservationsByStatus: Record<ReservationStatus, number>;
  reservationsByCategory: Record<string, number>;
  reservationsByShop: Array<{
    shopId: string;
    shopName: string;
    count: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    reservationId: string;
    customerName: string;
    shopName: string;
    timestamp: string;
  }>;
  trends: {
    dailyReservations: Array<{ date: string; count: number; revenue: number }>;
    weeklyReservations: Array<{ week: string; count: number; revenue: number }>;
    monthlyReservations: Array<{ month: string; count: number; revenue: number }>;
  };
}

export class AdminReservationService {
  private supabase = getSupabaseClient();

  /**
   * Get reservations with comprehensive filtering and admin oversight
   */
  async getReservations(filters: ReservationFilters = {}, adminId: string): Promise<ReservationListResponse> {
    try {
      logger.info('Admin reservation search', { adminId, filters });

      const {
        status,
        shopId,
        userId,
        startDate,
        endDate,
        search,
        minAmount,
        maxAmount,
        hasPointsUsed,
        sortBy = 'reservation_datetime',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = filters;

      const offset = (page - 1) * limit;

      // Build base query with all related information
      let query = this.supabase
        .from('reservations')
        .select(`
          *,
          customer:users!reservations_user_id_fkey(
            id,
            name,
            email,
            phone_number,
            user_status
          ),
          shop:shops!reservations_shop_id_fkey(
            id,
            name,
            address,
            main_category,
            shop_status
          ),
          services:reservation_services(
            id,
            quantity,
            unit_price,
            total_price,
            service:shop_services(
              id,
              name,
              category
            )
          ),
          payments:payments(
            id,
            payment_method,
            payment_status,
            amount,
            paid_at
          )
        `, { count: 'exact' });

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Apply shop filter
      if (shopId) {
        query = query.eq('shop_id', shopId);
      }

      // Apply user filter
      if (userId) {
        query = query.eq('user_id', userId);
      }

      // Apply date range filters
      if (startDate) {
        query = query.gte('reservation_date', startDate);
      }

      if (endDate) {
        query = query.lte('reservation_date', endDate);
      }

      // Apply amount filters
      if (minAmount !== undefined) {
        query = query.gte('total_amount', minAmount);
      }

      if (maxAmount !== undefined) {
        query = query.lte('total_amount', maxAmount);
      }

      // Apply points filter
      if (hasPointsUsed !== undefined) {
        if (hasPointsUsed) {
          query = query.gt('points_used', 0);
        } else {
          query = query.eq('points_used', 0);
        }
      }

      // Apply search filter
      if (search) {
        query = query.or(`customer.name.ilike.%${search}%,customer.phone_number.ilike.%${search}%,shop.name.ilike.%${search}%`);
      }

      // Get total count first
      const { count, error: countError } = await query;

      if (countError) {
        throw new Error(`Failed to get reservation count: ${countError.message}`);
      }

      // Apply sorting and pagination
      const { data: reservations, error } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get reservations: ${error.message}`);
      }

      // Process and enrich reservation data
      const enrichedReservations = (reservations || []).map(reservation => {
        const now = new Date();
        const reservationDate = new Date(reservation.reservation_datetime);
        const daysUntilReservation = Math.floor((reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate payment totals
        const totalPaidAmount = (reservation.payments || []).reduce((sum, payment) => {
          return sum + (payment.payment_status === 'fully_paid' ? payment.amount : 0);
        }, 0);

        const outstandingAmount = reservation.total_amount - totalPaidAmount;

        // Determine reservation state
        const isOverdue = reservation.status === 'confirmed' && daysUntilReservation < 0;
        const isToday = daysUntilReservation === 0;
        const isPast = daysUntilReservation < 0;

        return {
          id: reservation.id,
          reservationDate: reservation.reservation_date,
          reservationTime: reservation.reservation_time,
          reservationDatetime: reservation.reservation_datetime,
          status: reservation.status,
          totalAmount: reservation.total_amount,
          depositAmount: reservation.deposit_amount,
          remainingAmount: reservation.remaining_amount,
          pointsUsed: reservation.points_used,
          pointsEarned: reservation.points_earned,
          specialRequests: reservation.special_requests,
          cancellationReason: reservation.cancellation_reason,
          noShowReason: reservation.no_show_reason,
          confirmedAt: reservation.confirmed_at,
          completedAt: reservation.completed_at,
          cancelledAt: reservation.cancelled_at,
          createdAt: reservation.created_at,
          updatedAt: reservation.updated_at,
          // Customer information
          customer: reservation.customer ? {
            id: reservation.customer.id,
            name: reservation.customer.name,
            email: reservation.customer.email,
            phoneNumber: reservation.customer.phone_number,
            userStatus: reservation.customer.user_status
          } : undefined,
          // Shop information
          shop: reservation.shop ? {
            id: reservation.shop.id,
            name: reservation.shop.name,
            address: reservation.shop.address,
            mainCategory: reservation.shop.main_category,
            shopStatus: reservation.shop.shop_status
          } : undefined,
          // Services information
          services: (reservation.services || []).map(service => ({
            id: service.id,
            name: service.service?.name || 'Unknown Service',
            category: service.service?.category || 'unknown',
            quantity: service.quantity,
            unitPrice: service.unit_price,
            totalPrice: service.total_price
          })),
          // Payment information
          payments: (reservation.payments || []).map(payment => ({
            id: payment.id,
            paymentMethod: payment.payment_method,
            paymentStatus: payment.payment_status,
            amount: payment.amount,
            paidAt: payment.paid_at
          })),
          // Computed fields
          daysUntilReservation,
          isOverdue,
          isToday,
          isPast,
          totalPaidAmount,
          outstandingAmount
        };
      });

      const totalPages = Math.ceil((count || 0) / limit);
      const hasMore = page < totalPages;

      const response: ReservationListResponse = {
        reservations: enrichedReservations,
        totalCount: count || 0,
        hasMore,
        currentPage: page,
        totalPages,
        filters
      };

      // Log admin action
      await this.logAdminAction(adminId, 'reservation_search', {
        filters,
        resultCount: enrichedReservations.length,
        totalCount: count || 0
      });

      logger.info('Admin reservation search completed', { 
        adminId, 
        resultCount: enrichedReservations.length,
        totalCount: count || 0 
      });

      return response;
    } catch (error) {
      logger.error('Admin reservation search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
      });
      throw error;
    }
  }

  /**
   * Update reservation status with admin oversight
   */
  async updateReservationStatus(
    reservationId: string, 
    request: ReservationStatusUpdateRequest, 
    adminId: string
  ): Promise<ReservationStatusUpdateResult> {
    try {
      logger.info('Admin updating reservation status', { adminId, reservationId, request });

      // Get current reservation
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        throw new Error('Reservation not found');
      }

      const previousStatus = reservation.status;

      // Validate status transition
      if (!this.isValidStatusTransition(previousStatus, request.status)) {
        throw new Error(`Invalid status transition: ${previousStatus} → ${request.status}`);
      }

      // Prepare update data
      const updateData: any = {
        status: request.status,
        updated_at: new Date().toISOString()
      };

      // Set status-specific timestamps
      if (request.status === 'confirmed' && !reservation.confirmed_at) {
        updateData.confirmed_at = new Date().toISOString();
      } else if (request.status === 'completed' && !reservation.completed_at) {
        updateData.completed_at = new Date().toISOString();
      } else if (request.status === 'cancelled_by_shop' || request.status === 'cancelled_by_user') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = request.reason;
      } else if (request.status === 'no_show') {
        updateData.no_show_reason = request.reason;
      }

      // Update reservation
      const { error: updateError } = await this.supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId);

      if (updateError) {
        throw new Error(`Failed to update reservation: ${updateError.message}`);
      }

      // Process status-specific actions
      await this.processStatusChangeActions(reservationId, previousStatus, request.status, request, adminId);

      // Log admin action
      await this.logAdminAction(adminId, 'reservation_status_update', {
        reservationId,
        previousStatus,
        newStatus: request.status,
        reason: request.reason,
        notes: request.notes,
        autoProcessPayment: request.autoProcessPayment
      });

      const result: ReservationStatusUpdateResult = {
        success: true,
        reservation: {
          id: reservation.id,
          previousStatus,
          newStatus: request.status,
          updatedAt: new Date().toISOString()
        },
        action: {
          type: 'status_update',
          reason: request.reason,
          notes: request.notes,
          performedBy: adminId,
          performedAt: new Date().toISOString()
        }
      };

      logger.info('Reservation status updated successfully', { 
        adminId, 
        reservationId, 
        previousStatus,
        newStatus: request.status 
      });

      return result;
    } catch (error) {
      logger.error('Reservation status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        reservationId,
        request
      });
      throw error;
    }
  }

  /**
   * Create reservation dispute for admin resolution
   */
  async createReservationDispute(
    reservationId: string,
    request: ReservationDisputeRequest,
    adminId: string
  ): Promise<ReservationDisputeResult> {
    try {
      logger.info('Admin creating reservation dispute', { adminId, reservationId, request });

      // Verify reservation exists
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('id')
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        throw new Error('Reservation not found');
      }

      // Create dispute record
      const { data: dispute, error: disputeError } = await this.supabase
        .from('reservation_disputes')
        .insert({
          reservation_id: reservationId,
          dispute_type: request.disputeType,
          description: request.description,
          requested_action: request.requestedAction,
          priority: request.priority,
          status: 'open',
          created_by: adminId,
          evidence: request.evidence || []
        })
        .select()
        .single();

      if (disputeError) {
        throw new Error(`Failed to create dispute: ${disputeError.message}`);
      }

      // Log admin action
      await this.logAdminAction(adminId, 'reservation_dispute_created', {
        reservationId,
        disputeId: dispute.id,
        disputeType: request.disputeType,
        priority: request.priority
      });

      const result: ReservationDisputeResult = {
        success: true,
        dispute: {
          id: dispute.id,
          reservationId: dispute.reservation_id,
          disputeType: dispute.dispute_type,
          status: dispute.status,
          priority: dispute.priority,
          createdAt: dispute.created_at
        }
      };

      logger.info('Reservation dispute created successfully', { 
        adminId, 
        reservationId, 
        disputeId: dispute.id 
      });

      return result;
    } catch (error) {
      logger.error('Reservation dispute creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        reservationId,
        request
      });
      throw error;
    }
  }

  /**
   * Get reservation analytics for admin dashboard
   */
  async getReservationAnalytics(adminId: string, dateRange?: { startDate: string; endDate: string }): Promise<ReservationAnalytics> {
    try {
      logger.info('Getting reservation analytics', { adminId, dateRange });

      const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];

      // Get basic counts
      const { count: totalReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const { count: activeReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .in('status', ['requested', 'confirmed'])
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const { count: completedReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const { count: cancelledReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .in('status', ['cancelled_by_user', 'cancelled_by_shop'])
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const { count: noShowReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .eq('status', 'no_show')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get revenue data
      const { data: revenueData } = await this.supabase
        .from('reservations')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const totalRevenue = (revenueData || []).reduce((sum, reservation) => sum + reservation.total_amount, 0);
      const averageReservationValue = totalRevenue / (completedReservations || 1);

      // Get reservations by status
      const { data: statusData } = await this.supabase
        .from('reservations')
        .select('status')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const reservationsByStatus = (statusData || []).reduce((acc, reservation) => {
        acc[reservation.status] = (acc[reservation.status] || 0) + 1;
        return acc;
      }, {} as Record<ReservationStatus, number>);

      // Get reservations by category
      const { data: categoryData } = await this.supabase
        .from('reservations')
        .select(`
          shop:shops!reservations_shop_id_fkey(main_category)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const reservationsByCategory = (categoryData || []).reduce((acc, reservation) => {
        const category = (reservation.shop as any)?.main_category || 'unknown';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get reservations by shop
      const { data: shopData } = await this.supabase
        .from('reservations')
        .select(`
          shop_id,
          total_amount,
          shop:shops!reservations_shop_id_fkey(name)
        `)
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const shopStats = (shopData || []).reduce((acc, reservation) => {
        const shopId = reservation.shop_id;
        if (!acc[shopId]) {
          acc[shopId] = { count: 0, revenue: 0, name: (reservation.shop as any)?.name || 'Unknown' };
        }
        acc[shopId].count += 1;
        acc[shopId].revenue += reservation.total_amount;
        return acc;
      }, {} as Record<string, { count: number; revenue: number; name: string }>);

      const reservationsByShop = Object.entries(shopStats).map(([shopId, stats]) => ({
        shopId,
        shopName: stats.name,
        count: stats.count,
        revenue: stats.revenue
      })).sort((a, b) => b.revenue - a.revenue);

      // Get recent activity
      const { data: recentActivity } = await this.supabase
        .from('admin_actions')
        .select(`
          id,
          action_type,
          target_id,
          created_at,
          metadata
        `)
        .eq('target_type', 'reservation')
        .order('created_at', { ascending: false })
        .limit(20);

      const recentActivityList = (recentActivity || []).map(activity => ({
        id: activity.id,
        action: activity.action_type,
        reservationId: activity.target_id,
        customerName: 'Customer', // Would need to join with reservation data
        shopName: 'Shop', // Would need to join with reservation data
        timestamp: activity.created_at
      }));

      // Get trends data
      const { data: dailyData } = await this.supabase
        .from('reservations')
        .select('reservation_date, total_amount')
        .eq('status', 'completed')
        .gte('reservation_date', startDate)
        .lte('reservation_date', endDate);

      const dailyReservations = this.aggregateByDate(dailyData || [], 'reservation_date');

      const analytics: ReservationAnalytics = {
        totalReservations: totalReservations || 0,
        activeReservations: activeReservations || 0,
        completedReservations: completedReservations || 0,
        cancelledReservations: cancelledReservations || 0,
        noShowReservations: noShowReservations || 0,
        totalRevenue,
        averageReservationValue,
        reservationsByStatus,
        reservationsByCategory,
        reservationsByShop,
        recentActivity: recentActivityList,
        trends: {
          dailyReservations,
          weeklyReservations: [], // Would need more complex aggregation
          monthlyReservations: [] // Would need more complex aggregation
        }
      };

      logger.info('Reservation analytics retrieved', { adminId });

      return analytics;
    } catch (error) {
      logger.error('Failed to get reservation analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Validate status transition
   */
  private isValidStatusTransition(fromStatus: ReservationStatus, toStatus: ReservationStatus): boolean {
    const validTransitions: Record<ReservationStatus, ReservationStatus[]> = {
      requested: ['confirmed', 'cancelled_by_user', 'cancelled_by_shop'],
      confirmed: ['completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show'],
      completed: [], // Terminal state
      cancelled_by_user: [], // Terminal state
      cancelled_by_shop: [], // Terminal state
      no_show: [] // Terminal state
    };

    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  /**
   * Process status change actions
   */
  private async processStatusChangeActions(
    reservationId: string,
    previousStatus: ReservationStatus,
    newStatus: ReservationStatus,
    request: ReservationStatusUpdateRequest,
    adminId: string
  ): Promise<void> {
    try {
      // Handle completion - trigger point earning
      if (newStatus === 'completed') {
        await this.processCompletionActions(reservationId);
      }

      // Handle cancellation - trigger refund process
      if (newStatus === 'cancelled_by_shop' || newStatus === 'cancelled_by_user') {
        await this.processCancellationActions(reservationId, request);
      }

      // Handle no-show - trigger no-show penalties
      if (newStatus === 'no_show') {
        await this.processNoShowActions(reservationId);
      }

      // Send notifications if requested
      if (request.notifyCustomer) {
        await this.sendCustomerNotification(reservationId, newStatus, request.notes);
      }

      if (request.notifyShop) {
        await this.sendShopNotification(reservationId, newStatus, request.notes);
      }

    } catch (error) {
      logger.error('Error processing status change actions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        previousStatus,
        newStatus
      });
      // Don't throw - status change should still succeed
    }
  }

  /**
   * Process completion actions
   */
  private async processCompletionActions(reservationId: string): Promise<void> {
    // This would integrate with the point system to award points
    logger.info('Processing completion actions for reservation', { reservationId });
  }

  /**
   * Process cancellation actions
   */
  private async processCancellationActions(reservationId: string, request: ReservationStatusUpdateRequest): Promise<void> {
    // This would integrate with the refund system
    logger.info('Processing cancellation actions for reservation', { reservationId });
  }

  /**
   * Process no-show actions
   */
  private async processNoShowActions(reservationId: string): Promise<void> {
    // This would integrate with the no-show detection system
    logger.info('Processing no-show actions for reservation', { reservationId });
  }

  /**
   * Send customer notification
   */
  private async sendCustomerNotification(reservationId: string, status: ReservationStatus, notes?: string): Promise<void> {
    // This would integrate with the notification system
    logger.info('Sending customer notification', { reservationId, status, notes });
  }

  /**
   * Send shop notification
   */
  private async sendShopNotification(reservationId: string, status: ReservationStatus, notes?: string): Promise<void> {
    // This would integrate with the notification system
    logger.info('Sending shop notification', { reservationId, status, notes });
  }

  /**
   * Aggregate data by date
   */
  private aggregateByDate(data: any[], dateField: string): Array<{ date: string; count: number; revenue: number }> {
    const aggregated = data.reduce((acc, item) => {
      const date = item[dateField];
      if (!acc[date]) {
        acc[date] = { count: 0, revenue: 0 };
      }
      acc[date].count += 1;
      acc[date].revenue += item.total_amount || 0;
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>);

    return Object.entries(aggregated).map(([date, stats]) => ({
      date,
      count: (stats as any).count,
      revenue: (stats as any).revenue
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Log admin action
   */
  private async logAdminAction(adminId: string, action: string, metadata: any): Promise<void> {
    try {
      await this.supabase
        .from('admin_actions')
        .insert({
          admin_id: adminId,
          action_type: action,
          target_type: 'reservation',
          metadata,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging admin action', { error, adminId, action });
    }
  }
}

export const adminReservationService = new AdminReservationService(); 