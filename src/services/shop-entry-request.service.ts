/**
 * Shop Entry Request Service
 *
 * Manages shop entry requests including:
 * - Submitting new requests (public)
 * - Listing requests (admin)
 * - Updating request status (admin)
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  ShopEntryRequest,
  ShopEntryRequestWithRequester,
  AdminShopEntryRequestResponse,
  AdminShopEntryRequestListResponse,
  ShopEntryRequestResponse,
  CreateShopEntryRequest,
  UpdateShopEntryRequestStatus,
  AdminListShopEntryRequestsRequest,
  toShopEntryRequestResponse,
  toAdminShopEntryRequestResponse,
} from '../types/shop-entry-request.types';

class ShopEntryRequestService {
  /**
   * Submit a new shop entry request (public)
   */
  async submitRequest(
    data: CreateShopEntryRequest,
    userId?: string
  ): Promise<ShopEntryRequestResponse | null> {
    const supabase = getSupabaseClient();

    try {
      const { data: request, error } = await supabase
        .from('shop_entry_requests')
        .insert({
          requester_user_id: userId || null,
          requester_email: data.requesterEmail || null,
          requester_phone: data.requesterPhone || null,
          shop_name: data.shopName,
          shop_address: data.shopAddress || null,
          shop_phone: data.shopPhone || null,
          shop_category: data.shopCategory || null,
          additional_info: data.additionalInfo || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create shop entry request', { error: error.message });
        return null;
      }

      logger.info('Shop entry request created', {
        requestId: request.id,
        shopName: data.shopName,
        userId: userId || 'anonymous',
      });

      return toShopEntryRequestResponse(request);
    } catch (error) {
      logger.error('Error in submitRequest', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get a single shop entry request by ID
   */
  async getRequestById(requestId: string): Promise<AdminShopEntryRequestResponse | null> {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase
        .from('shop_entry_requests')
        .select(
          `
          *,
          requester:users!shop_entry_requests_requester_user_id_fkey(nickname, email),
          processor:users!shop_entry_requests_processed_by_fkey(nickname, email)
        `
        )
        .eq('id', requestId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Failed to fetch shop entry request', { error: error.message });
        return null;
      }

      return toAdminShopEntryRequestResponse(data as ShopEntryRequestWithRequester);
    } catch (error) {
      logger.error('Error in getRequestById', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * List shop entry requests (admin)
   */
  async listRequests(
    request: AdminListShopEntryRequestsRequest
  ): Promise<AdminShopEntryRequestListResponse> {
    const supabase = getSupabaseClient();

    const page = request.page || 0;
    const limit = request.limit || 50;
    const sortBy = request.sortBy || 'created_at';
    const sortOrder = request.sortOrder || 'desc';

    try {
      let query = supabase
        .from('shop_entry_requests')
        .select(
          `
          *,
          requester:users!shop_entry_requests_requester_user_id_fkey(nickname, email),
          processor:users!shop_entry_requests_processed_by_fkey(nickname, email)
        `,
          { count: 'exact' }
        );

      // Apply status filter
      if (request.status) {
        query = query.eq('status', request.status);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = page * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to list shop entry requests', { error: error.message });
        return {
          requests: [],
          total: 0,
          page,
          limit,
          hasMore: false,
        };
      }

      const total = count || 0;

      return {
        requests: (data || []).map((req: ShopEntryRequestWithRequester) =>
          toAdminShopEntryRequestResponse(req)
        ),
        total,
        page,
        limit,
        hasMore: (page + 1) * limit < total,
      };
    } catch (error) {
      logger.error('Error in listRequests', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        requests: [],
        total: 0,
        page,
        limit,
        hasMore: false,
      };
    }
  }

  /**
   * Update shop entry request status (admin)
   */
  async updateRequestStatus(
    requestId: string,
    updateData: UpdateShopEntryRequestStatus,
    adminId: string
  ): Promise<AdminShopEntryRequestResponse | null> {
    const supabase = getSupabaseClient();

    try {
      const updateFields: Record<string, any> = {
        status: updateData.status,
        processed_by: adminId,
        processed_at: new Date().toISOString(),
      };

      if (updateData.adminNotes !== undefined) {
        updateFields.admin_notes = updateData.adminNotes;
      }

      const { data, error } = await supabase
        .from('shop_entry_requests')
        .update(updateFields)
        .eq('id', requestId)
        .select(
          `
          *,
          requester:users!shop_entry_requests_requester_user_id_fkey(nickname, email),
          processor:users!shop_entry_requests_processed_by_fkey(nickname, email)
        `
        )
        .single();

      if (error) {
        logger.error('Failed to update shop entry request', { error: error.message });
        return null;
      }

      logger.info('Shop entry request status updated', {
        requestId,
        newStatus: updateData.status,
        adminId,
      });

      return toAdminShopEntryRequestResponse(data as ShopEntryRequestWithRequester);
    } catch (error) {
      logger.error('Error in updateRequestStatus', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Delete shop entry request (admin)
   */
  async deleteRequest(requestId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase.from('shop_entry_requests').delete().eq('id', requestId);

      if (error) {
        logger.error('Failed to delete shop entry request', { error: error.message });
        return false;
      }

      logger.info('Shop entry request deleted', { requestId });
      return true;
    } catch (error) {
      logger.error('Error in deleteRequest', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get statistics for shop entry requests (admin)
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    contacted: number;
    registered: number;
    rejected: number;
  }> {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase.from('shop_entry_requests').select('status');

      if (error) {
        logger.error('Failed to fetch shop entry request statistics', { error: error.message });
        return { total: 0, pending: 0, contacted: 0, registered: 0, rejected: 0 };
      }

      const stats = {
        total: data?.length || 0,
        pending: 0,
        contacted: 0,
        registered: 0,
        rejected: 0,
      };

      (data || []).forEach((req: { status: string }) => {
        if (req.status === 'pending') stats.pending++;
        else if (req.status === 'contacted') stats.contacted++;
        else if (req.status === 'registered') stats.registered++;
        else if (req.status === 'rejected') stats.rejected++;
      });

      return stats;
    } catch (error) {
      logger.error('Error in getStatistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { total: 0, pending: 0, contacted: 0, registered: 0, rejected: 0 };
    }
  }
}

export const shopEntryRequestService = new ShopEntryRequestService();
export default shopEntryRequestService;
