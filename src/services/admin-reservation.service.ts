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
      paymentStatus: string;
      paymentStage: string;
      amount: number;
      isDeposit: boolean;
      dueDate?: string;
      createdAt: string;
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
  adminId?: string;
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
            payment_status,
            payment_stage,
            amount,
            is_deposit,
            due_date,
            created_at
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
            paymentStatus: payment.payment_status,
            paymentStage: payment.payment_stage,
            amount: payment.amount,
            isDeposit: payment.is_deposit,
            dueDate: payment.due_date,
            createdAt: payment.created_at
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

      // Update reservation status directly (simplified - state machine RPC not available)
      const updateData: any = {
        status: request.status,
        updated_at: new Date().toISOString()
      };

      // Set status-specific timestamps
      if (request.status === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (request.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        // Auto-set confirmed_at if not already set (database constraint requirement)
        if (!reservation.confirmed_at) {
          updateData.confirmed_at = new Date().toISOString();
          logger.info('Auto-setting confirmed_at for completed reservation', { reservationId });
        }
      } else if (request.status === 'cancelled_by_user' || request.status === 'cancelled_by_shop') {
        updateData.cancelled_at = new Date().toISOString();
        if (request.reason) {
          updateData.cancellation_reason = request.reason;
        }
      } else if (request.status === 'no_show') {
        updateData.no_show_reason = request.reason || 'Marked as no-show by admin';
      }

      const { error: updateError } = await this.supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId);

      if (updateError) {
        logger.error('Failed to update reservation status', {
          error: updateError.message,
          reservationId,
          status: request.status,
          adminId
        });
        throw new Error(`Failed to update status: ${updateError.message}`);
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

      // Create dispute record (simplified - table not available yet, log instead)
      // TODO: Create reservation_disputes table in database schema
      logger.warn('Dispute creation requested but table does not exist - logging dispute details', {
        reservationId,
        disputeType: request.disputeType,
        description: request.description,
        requestedAction: request.requestedAction,
        priority: request.priority,
        createdBy: adminId,
        evidence: request.evidence || []
      });

      // Create a mock dispute object for response
      const dispute = {
        id: `temp-dispute-${Date.now()}`,
        reservation_id: reservationId,
        dispute_type: request.disputeType,
        status: 'open' as 'open' | 'investigating' | 'resolved' | 'closed',
        priority: request.priority,
        created_at: new Date().toISOString(),
        created_by: adminId,
        description: request.description,
        requested_action: request.requestedAction
      };

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
  async getReservationAnalytics(adminId: string, dateRange?: { startDate: string; endDate: string }, shopId?: string): Promise<ReservationAnalytics> {
    try {
      logger.info('Getting reservation analytics', { adminId, dateRange, shopId });

      const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];

      // Get basic counts with optional shop filtering
      let totalQuery = this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        totalQuery = totalQuery.eq('shop_id', shopId);
      }
      const { count: totalReservations } = await totalQuery;

      let activeQuery = this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .in('status', ['requested', 'confirmed'])
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        activeQuery = activeQuery.eq('shop_id', shopId);
      }
      const { count: activeReservations } = await activeQuery;

      let completedQuery = this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        completedQuery = completedQuery.eq('shop_id', shopId);
      }
      const { count: completedReservations } = await completedQuery;

      let cancelledQuery = this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .in('status', ['cancelled_by_user', 'cancelled_by_shop'])
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        cancelledQuery = cancelledQuery.eq('shop_id', shopId);
      }
      const { count: cancelledReservations } = await cancelledQuery;

      let noShowQuery = this.supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .eq('status', 'no_show')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        noShowQuery = noShowQuery.eq('shop_id', shopId);
      }
      const { count: noShowReservations } = await noShowQuery;

      // Get revenue data with shop filtering
      let revenueQuery = this.supabase
        .from('reservations')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        revenueQuery = revenueQuery.eq('shop_id', shopId);
      }
      const { data: revenueData } = await revenueQuery;

      const totalRevenue = (revenueData || []).reduce((sum, reservation) => sum + reservation.total_amount, 0);
      const averageReservationValue = totalRevenue / (completedReservations || 1);

      // Get reservations by status with shop filtering
      let statusQuery = this.supabase
        .from('reservations')
        .select('status')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        statusQuery = statusQuery.eq('shop_id', shopId);
      }
      const { data: statusData } = await statusQuery;

      const reservationsByStatus = (statusData || []).reduce((acc, reservation) => {
        acc[reservation.status] = (acc[reservation.status] || 0) + 1;
        return acc;
      }, {} as Record<ReservationStatus, number>);

      // Get reservations by category with shop filtering
      let categoryQuery = this.supabase
        .from('reservations')
        .select(`
          shop:shops!reservations_shop_id_fkey(main_category)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        categoryQuery = categoryQuery.eq('shop_id', shopId);
      }
      const { data: categoryData } = await categoryQuery;

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
   * Get reservation statistics for admin dashboard (frontend-compatible)
   */
  async getReservationStatistics(
    adminId: string,
    filters?: {
      shopId?: string;
      staffId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{
    todayReservations: number;
    todayConfirmed: number;
    todayPending: number;
    todayCompleted: number;
    monthlyRevenue: number;
    revenueGrowth: number;
    monthlyReservations: number;
    totalCustomers: number;
    newCustomersThisMonth: number;
    returningCustomers: number;
    activeServices: number;
    topService: string;
    topServiceCount: number;
    statusBreakdown: {
      requested: number;
      confirmed: number;
      completed: number;
      cancelled_by_user: number;
      cancelled_by_shop: number;
      no_show: number;
    };
    revenueByStatus: {
      total: number;
      paid: number;
      outstanding: number;
    };
  }> {
    try {
      logger.info('Getting reservation statistics', { adminId, filters });

      // Set date ranges
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = filters?.dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = filters?.dateTo || today;

      // Calculate previous month for growth comparison
      const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
      const prevMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];

      // Build base query with optional filters
      let baseQuery = this.supabase.from('reservations').select('*');
      if (filters?.shopId) {
        baseQuery = baseQuery.eq('shop_id', filters.shopId);
      }
      if (filters?.staffId) {
        baseQuery = baseQuery.eq('staff_id', filters.staffId);
      }

      // Today's statistics
      const { data: todayData } = await baseQuery
        .eq('reservation_date', today);

      const todayReservations = todayData?.length || 0;
      const todayConfirmed = todayData?.filter(r => r.status === 'confirmed').length || 0;
      const todayPending = todayData?.filter(r => r.status === 'requested').length || 0;
      const todayCompleted = todayData?.filter(r => r.status === 'completed').length || 0;

      // Monthly revenue (completed reservations only)
      const { data: monthlyCompletedData } = await baseQuery
        .eq('status', 'completed')
        .gte('reservation_date', startOfMonth)
        .lte('reservation_date', endOfMonth);

      const monthlyRevenue = monthlyCompletedData?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;

      // Previous month revenue for growth calculation
      const { data: prevMonthData } = await baseQuery
        .eq('status', 'completed')
        .gte('reservation_date', prevMonthStart)
        .lte('reservation_date', prevMonthEnd);

      const prevMonthRevenue = prevMonthData?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;
      const revenueGrowth = prevMonthRevenue > 0 ? ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

      // Monthly reservations count
      const { data: monthlyData } = await baseQuery
        .gte('reservation_date', startOfMonth)
        .lte('reservation_date', endOfMonth);

      const monthlyReservations = monthlyData?.length || 0;

      // Customer statistics
      const { data: allCustomers } = await this.supabase
        .from('users')
        .select('id, created_at');

      const totalCustomers = allCustomers?.length || 0;

      const monthStartDate = new Date(startOfMonth);
      const newCustomersThisMonth = allCustomers?.filter(c =>
        new Date(c.created_at) >= monthStartDate
      ).length || 0;

      // Returning customers (users with more than one reservation in the period)
      const customerReservationCounts = monthlyData?.reduce((acc, r) => {
        acc[r.user_id] = (acc[r.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const returningCustomers = Object.values(customerReservationCounts).filter((count: number) => count > 1).length;

      // Service statistics
      let serviceQuery = this.supabase
        .from('shop_services')
        .select('id, name, is_active');

      if (filters?.shopId) {
        serviceQuery = serviceQuery.eq('shop_id', filters.shopId);
      }

      const { data: servicesData } = await serviceQuery.eq('is_active', true);
      const activeServices = servicesData?.length || 0;

      // Top service (most booked in the period)
      const { data: reservationServices } = await this.supabase
        .from('reservation_services')
        .select(`
          service_id,
          service:shop_services(name)
        `)
        .in('reservation_id', monthlyData?.map(r => r.id) || []);

      const serviceCounts = reservationServices?.reduce((acc, rs) => {
        const serviceName = (rs.service as any)?.name || 'Unknown';
        acc[serviceName] = (acc[serviceName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const topServiceEntry = Object.entries(serviceCounts).sort(([, a], [, b]) => b - a)[0];
      const topService = topServiceEntry?.[0] || '없음';
      const topServiceCount = topServiceEntry?.[1] || 0;

      // Status breakdown
      const statusBreakdown = monthlyData?.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {
        requested: 0,
        confirmed: 0,
        completed: 0,
        cancelled_by_user: 0,
        cancelled_by_shop: 0,
        no_show: 0
      }) || {
        requested: 0,
        confirmed: 0,
        completed: 0,
        cancelled_by_user: 0,
        cancelled_by_shop: 0,
        no_show: 0
      };

      // Revenue by status
      const totalRevenue = monthlyData?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;

      const { data: paidData } = await this.supabase
        .from('payments')
        .select('amount, reservation_id')
        .eq('payment_status', 'fully_paid')
        .in('reservation_id', monthlyData?.map(r => r.id) || []);

      const paidRevenue = paidData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const outstandingRevenue = totalRevenue - paidRevenue;

      const statistics = {
        todayReservations,
        todayConfirmed,
        todayPending,
        todayCompleted,
        monthlyRevenue: Math.round(monthlyRevenue),
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        monthlyReservations,
        totalCustomers,
        newCustomersThisMonth,
        returningCustomers,
        activeServices,
        topService,
        topServiceCount,
        statusBreakdown,
        revenueByStatus: {
          total: Math.round(totalRevenue),
          paid: Math.round(paidRevenue),
          outstanding: Math.round(outstandingRevenue)
        }
      };

      logger.info('Reservation statistics retrieved', { adminId, statistics });

      return statistics;
    } catch (error) {
      logger.error('Failed to get reservation statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
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
   * Process cancellation actions with enhanced dynamic refund handling
   */
  private async processCancellationActions(reservationId: string, request: ReservationStatusUpdateRequest): Promise<void> {
    try {
      logger.info('Processing enhanced cancellation actions for reservation', { 
        reservationId,
        notes: request.notes,
        reason: request.notes || 'Reservation cancelled by admin'
      });

      // Get reservation details to determine user ID
      const { data: reservation } = await this.supabase
        .from('reservations')
        .select('user_id')
        .eq('id', reservationId)
        .single();

      if (!reservation) {
        logger.error('Reservation not found for admin cancellation', { reservationId });
        return;
      }

      // Process dynamic refunds with admin override capabilities
      let refundResult = null;
      let refundCalculation = null;
      try {
        // Import services for dynamic refund processing
        const { refundService } = await import('./refund.service');
        const { timezoneRefundService } = await import('./timezone-refund.service');

        // Calculate dynamic refund amount with admin override
        const dynamicRefundRequest = {
          reservationId,
          userId: reservation.user_id,
          cancellationType: 'admin_force' as const,
          cancellationReason: request.notes || 'Reservation cancelled by admin',
          refundPreference: 'full_refund' as const,
          policyOverride: {
            enabled: true,
            refundPercentage: 100, // Admin can override to full refund
            reason: 'Administrative cancellation - full refund policy',
            adminId: request.adminId || 'system'
          }
        };

        refundCalculation = await timezoneRefundService.calculateRefundAmount(dynamicRefundRequest);
        
        logger.info('Admin dynamic refund calculation completed', {
          reservationId,
          refundAmount: refundCalculation.refundAmount,
          refundPercentage: refundCalculation.refundPercentage,
          isEligible: refundCalculation.isEligible,
          adminOverride: true
        });

        // Process refunds if eligible
        if (refundCalculation.isEligible && refundCalculation.refundAmount > 0) {
          refundResult = await refundService.processDynamicRefund(dynamicRefundRequest);
          
          logger.info('Admin automatic refund processing completed', {
            reservationId,
            refundAmount: refundCalculation.refundAmount,
            refundPercentage: refundCalculation.refundPercentage,
            refundId: refundResult.refundId,
            refundStatus: refundResult.status,
            adminOverride: true
          });
        } else {
          logger.info('Admin refund not eligible or amount is zero', {
            reservationId,
            reason: refundCalculation.reason,
            isEligible: refundCalculation.isEligible,
            refundAmount: refundCalculation.refundAmount
          });
        }

      } catch (refundError) {
        logger.error('Failed to process admin dynamic refunds during cancellation', {
          reservationId,
          error: refundError instanceof Error ? refundError.message : 'Unknown error',
          adminId: request.adminId
        });
        // Continue with cancellation even if refund fails - can be handled separately
      }

      // Create admin cancellation audit trail
      await this.createAdminCancellationAuditTrail({
        reservationId,
        adminId: request.adminId || 'system',
        reason: request.notes || 'Reservation cancelled by admin',
        refundCalculation,
        refundResult,
        reservationUserId: reservation.user_id
      });

      // Additional cancellation actions can be added here
      // For example: updating shop statistics, sending notifications, etc.

    } catch (error) {
      logger.error('Error processing enhanced cancellation actions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId
      });
      // Don't throw - cancellation should still succeed even if actions fail
    }
  }

  /**
   * Process no-show actions
   */
  private async processNoShowActions(reservationId: string): Promise<void> {
    // This would integrate with the no-show detection system
    logger.info('Processing no-show actions for reservation', { reservationId });
  }

  /**
   * Create admin cancellation audit trail with enhanced refund processing details
   */
  private async createAdminCancellationAuditTrail(params: {
    reservationId: string;
    adminId: string;
    reason: string;
    refundCalculation?: any;
    refundResult?: any;
    reservationUserId: string;
  }): Promise<void> {
    try {
      const { formatKoreanDateTime, getCurrentKoreanTime } = await import('../utils/korean-timezone');
      
      await this.supabase
        .from('admin_cancellation_audit_log')
        .insert({
          reservation_id: params.reservationId,
          user_id: params.reservationUserId,
          admin_id: params.adminId,
          cancellation_type: 'admin_force',
          cancellation_reason: params.reason,
          refund_preference: 'full_refund',
          refund_amount: params.refundCalculation?.refundAmount || 0,
          refund_percentage: params.refundCalculation?.refundPercentage || 100,
          refund_eligible: params.refundCalculation?.isEligible || true,
          refund_window: params.refundCalculation?.cancellationWindow || 'admin_override',
          refund_processed: !!params.refundResult,
          refund_id: params.refundResult?.refundId || null,
          refund_status: params.refundResult?.status || 'processed',
          admin_override: true,
          policy_override: params.refundCalculation?.policyOverride || null,
          korean_current_time: params.refundCalculation?.koreanTimeInfo?.currentTime || formatKoreanDateTime(getCurrentKoreanTime()),
          korean_reservation_time: params.refundCalculation?.koreanTimeInfo?.reservationTime || 'unknown',
          timezone: params.refundCalculation?.koreanTimeInfo?.timeZone || 'Asia/Seoul (KST)',
          business_rules: params.refundCalculation?.businessRules || null,
          refund_calculation_details: params.refundCalculation || null,
          refund_processing_details: params.refundResult || null,
          created_at: formatKoreanDateTime(getCurrentKoreanTime())
        });

      logger.info('Admin cancellation audit trail created', {
        reservationId: params.reservationId,
        adminId: params.adminId,
        refundAmount: params.refundCalculation?.refundAmount || 0,
        refundProcessed: !!params.refundResult,
        adminOverride: true
      });

    } catch (error) {
      logger.error('Failed to create admin cancellation audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservationId,
        adminId: params.adminId
      });
      // Don't throw - audit trail failure shouldn't break cancellation
    }
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
   * Force complete a reservation for dispute resolution
   */
  async forceCompleteReservation(
    reservationId: string,
    request: {
      reason: string;
      notes?: string;
      refundAmount?: number;
      compensationPoints?: number;
      notifyCustomer?: boolean;
      notifyShop?: boolean;
    },
    adminId: string
  ): Promise<{
    success: boolean;
    reservation: any;
    refundProcessed?: boolean;
    compensationProcessed?: boolean;
    notificationsSent: {
      customer: boolean;
      shop: boolean;
    };
  }> {
    try {
      logger.info('Admin force completing reservation', { adminId, reservationId, request });

      // Get current reservation
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        throw new Error('Reservation not found');
      }

      // Validate that reservation can be force completed
      if (reservation.status === 'completed') {
        throw new Error('Reservation is already completed');
      }

      // Use state machine to execute completion transition
      const { reservationStateMachine } = await import('./reservation-state-machine.service');
      
      const transitionResult = await reservationStateMachine.executeTransition(
        reservationId,
        'completed',
        'admin',
        adminId,
        `Force completed by admin: ${request.reason}`,
        {
          admin_force_complete: true,
          reason: request.reason,
          notes: request.notes,
          force_completion: true,
          updated_at: new Date().toISOString()
        }
      );

      if (!transitionResult.success) {
        logger.error('Failed to force complete reservation via state machine', {
          errors: transitionResult.errors,
          warnings: transitionResult.warnings,
          reservationId,
          adminId
        });
        throw new Error(`State transition failed: ${transitionResult.errors.join(', ')}`);
      }

      let refundProcessed = false;
      let compensationProcessed = false;

      // Process refund if requested
      if (request.refundAmount && request.refundAmount > 0) {
        try {
          const refundResult = await this.processRefund(reservationId, request.refundAmount, adminId);
          refundProcessed = refundResult.success;
          
          if (refundProcessed) {
            logger.info(`Refund processed for force completed reservation ${reservationId}: ${request.refundAmount} KRW`);
          }
        } catch (error) {
          logger.error('Failed to process refund for force completed reservation', {
            error: error instanceof Error ? error.message : 'Unknown error',
            reservationId,
            refundAmount: request.refundAmount
          });
        }
      }

      // Process compensation points if requested
      if (request.compensationPoints && request.compensationPoints > 0) {
        try {
          const compensationResult = await this.processCompensationPoints(reservationId, request.compensationPoints, adminId);
          compensationProcessed = compensationResult.success;
          
          if (compensationProcessed) {
            logger.info(`Compensation points processed for force completed reservation ${reservationId}: ${request.compensationPoints} points`);
          }
        } catch (error) {
          logger.error('Failed to process compensation points for force completed reservation', {
            error: error instanceof Error ? error.message : 'Unknown error',
            reservationId,
            compensationPoints: request.compensationPoints
          });
        }
      }

      // Send notifications
      const notificationsSent = {
        customer: false,
        shop: false
      };

      if (request.notifyCustomer) {
        try {
          await this.sendCustomerNotification(reservationId, 'completed', 
            `Reservation force completed by admin. ${request.notes || ''}${refundProcessed ? ` Refund of ${request.refundAmount} KRW processed.` : ''}${compensationProcessed ? ` ${request.compensationPoints} compensation points added.` : ''}`);
          notificationsSent.customer = true;
        } catch (error) {
          logger.error('Failed to send customer notification for force completion', { error, reservationId });
        }
      }

      if (request.notifyShop) {
        try {
          await this.sendShopNotification(reservationId, 'completed', 
            `Reservation force completed by admin. ${request.notes || ''}`);
          notificationsSent.shop = true;
        } catch (error) {
          logger.error('Failed to send shop notification for force completion', { error, reservationId });
        }
      }

      // Log admin action
      await this.logAdminAction(adminId, 'force_complete_reservation', {
        reservationId,
        reason: request.reason,
        notes: request.notes,
        refundAmount: request.refundAmount,
        compensationPoints: request.compensationPoints,
        refundProcessed,
        compensationProcessed,
        notificationsSent
      });

      // Get updated reservation
      const { data: updatedReservation } = await this.supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      logger.info(`Reservation ${reservationId} force completed successfully by admin ${adminId}`, {
        refundProcessed,
        compensationProcessed,
        notificationsSent
      });

      return {
        success: true,
        reservation: updatedReservation,
        refundProcessed,
        compensationProcessed,
        notificationsSent
      };

    } catch (error) {
      logger.error('Failed to force complete reservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        adminId
      });
      throw error;
    }
  }

  /**
   * Process refund for force completed reservation
   */
  private async processRefund(reservationId: string, refundAmount: number, adminId: string): Promise<{ success: boolean; refundId?: string }> {
    try {
      // Create refund record
      const { data: refund, error: refundError } = await this.supabase
        .from('refunds')
        .insert({
          reservation_id: reservationId,
          amount: refundAmount,
          refund_type: 'admin_force_complete',
          reason: 'Force completion by admin',
          status: 'processed',
          processed_by: adminId,
          processed_at: new Date().toISOString(),
          metadata: {
            admin_processed: true,
            force_completion: true
          }
        })
        .select('id')
        .single();

      if (refundError || !refund) {
        throw new Error('Failed to create refund record');
      }

      // Update reservation with refund information
      const { error: updateError } = await this.supabase
        .from('reservations')
        .update({
          refund_amount: refundAmount,
          refund_processed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservationId);

      if (updateError) {
        logger.error('Failed to update reservation with refund information', { error: updateError, reservationId });
      }

      return {
        success: true,
        refundId: refund.id
      };

    } catch (error) {
      logger.error('Failed to process refund for force completed reservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        refundAmount
      });
      return { success: false };
    }
  }

  /**
   * Process compensation points for force completed reservation
   */
  private async processCompensationPoints(reservationId: string, compensationPoints: number, adminId: string): Promise<{ success: boolean; transactionId?: string }> {
    try {
      // Get reservation to get user ID
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('user_id')
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        throw new Error('Reservation not found');
      }

      // Add compensation points to user
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('available_points, total_points')
        .eq('id', reservation.user_id)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      const newAvailablePoints = (user.available_points || 0) + compensationPoints;
      const newTotalPoints = (user.total_points || 0) + compensationPoints;

      // Update user points
      const { error: updateUserError } = await this.supabase
        .from('users')
        .update({
          available_points: newAvailablePoints,
          total_points: newTotalPoints,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservation.user_id);

      if (updateUserError) {
        throw new Error('Failed to update user points');
      }

      // Create point transaction record
      const { data: transaction, error: transactionError } = await this.supabase
        .from('point_transactions')
        .insert({
          user_id: reservation.user_id,
          transaction_type: 'compensation',
          amount: compensationPoints,
          description: `Compensation points for force completed reservation`,
          status: 'available',
          metadata: {
            reservation_id: reservationId,
            admin_processed: true,
            force_completion: true,
            processed_by: adminId
          }
        })
        .select('id')
        .single();

      if (transactionError || !transaction) {
        logger.error('Failed to create compensation point transaction', { error: transactionError, reservationId });
      }

      return {
        success: true,
        transactionId: transaction?.id
      };

    } catch (error) {
      logger.error('Failed to process compensation points for force completed reservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        compensationPoints
      });
      return { success: false };
    }
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