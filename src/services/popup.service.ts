/**
 * Popup Service
 *
 * Manages app popups including:
 * - Fetching active popups for users
 * - Tracking popup views and clicks
 * - Handling popup dismissals
 * - Admin CRUD operations
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  AppPopup,
  PopupDismissal,
  PopupResponse,
  AdminPopupResponse,
  GetActivePopupsRequest,
  CreatePopupRequest,
  UpdatePopupRequest,
  DismissPopupRequest,
  AdminListPopupsRequest,
  AdminPopupListResponse,
  toPopupResponse,
  toAdminPopupResponse,
  PopupStatistics,
} from '../types/popup.types';

class PopupService {
  /**
   * Get active popups for a user/device
   * Filters out permanently dismissed popups
   */
  async getActivePopups(request: GetActivePopupsRequest): Promise<PopupResponse[]> {
    const supabase = getSupabaseClient();

    try {
      const now = new Date().toISOString();

      // First, get all active popups within date range
      let query = supabase
        .from('app_popups')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });

      // Apply date filters
      query = query.or(`start_date.is.null,start_date.lte.${now}`);
      query = query.or(`end_date.is.null,end_date.gte.${now}`);

      // Apply target audience filter
      if (request.isNewUser) {
        query = query.or('target_audience.eq.all,target_audience.eq.new_users');
      } else {
        query = query.or('target_audience.eq.all,target_audience.eq.returning');
      }

      const { data: popups, error } = await query;

      if (error) {
        logger.error('Failed to fetch active popups', { error: error.message });
        return [];
      }

      if (!popups || popups.length === 0) {
        return [];
      }

      // Get permanently dismissed popup IDs for this user/device
      const dismissedPopupIds = await this.getDismissedPopupIds(
        request.userId,
        request.deviceId
      );

      // Filter out dismissed popups
      const filteredPopups = popups.filter(
        (popup: AppPopup) => !dismissedPopupIds.includes(popup.id)
      );

      // Record view counts for shown popups
      if (filteredPopups.length > 0) {
        await this.recordViews(filteredPopups.map((p: AppPopup) => p.id));
      }

      return filteredPopups.map((popup: AppPopup) => toPopupResponse(popup));
    } catch (error) {
      logger.error('Error in getActivePopups', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get popup IDs that have been permanently dismissed
   */
  private async getDismissedPopupIds(
    userId?: string,
    deviceId?: string
  ): Promise<string[]> {
    if (!userId && !deviceId) {
      return [];
    }

    const supabase = getSupabaseClient();

    try {
      let query = supabase
        .from('popup_dismissals')
        .select('popup_id')
        .eq('dismiss_type', 'never_show');

      // Build OR condition for user_id or device_id
      // Supabase PostgREST 필터 문법: UUID 값은 따옴표로 감싸야 함
      if (userId && deviceId) {
        query = query.or(`user_id.eq."${userId}",device_id.eq."${deviceId}"`);
      } else if (userId) {
        query = query.eq('user_id', userId);
      } else if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch dismissed popup IDs', { error: error.message });
        return [];
      }

      return (data || []).map((d: { popup_id: string }) => d.popup_id);
    } catch (error) {
      logger.error('Error in getDismissedPopupIds', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Record view counts for popups
   */
  private async recordViews(popupIds: string[]): Promise<void> {
    if (popupIds.length === 0) return;

    const supabase = getSupabaseClient();

    try {
      // Use the database function to increment view counts
      const { error } = await supabase.rpc('increment_popup_view_count', {
        popup_ids: popupIds,
      });

      if (error) {
        logger.warn('Failed to record popup views', { error: error.message });
      }
    } catch (error) {
      logger.warn('Error recording popup views', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Record a click on a popup
   */
  async recordClick(popupId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase.rpc('increment_popup_click_count', {
        p_popup_id: popupId,
      });

      if (error) {
        logger.warn('Failed to record popup click', { error: error.message });
        return false;
      }

      return true;
    } catch (error) {
      logger.warn('Error recording popup click', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Dismiss a popup (close or never show again)
   */
  async dismissPopup(request: DismissPopupRequest): Promise<boolean> {
    const supabase = getSupabaseClient();

    // Require either userId or deviceId
    if (!request.userId && !request.deviceId) {
      logger.warn('Dismiss popup requires userId or deviceId');
      return false;
    }

    try {
      // Build the query to check for existing dismissal
      let existingQuery = supabase
        .from('popup_dismissals')
        .select('id')
        .eq('popup_id', request.popupId);

      if (request.userId) {
        existingQuery = existingQuery.eq('user_id', request.userId);
      } else {
        existingQuery = existingQuery.eq('device_id', request.deviceId);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        // Update existing dismissal
        let updateQuery = supabase
          .from('popup_dismissals')
          .update({
            dismiss_type: request.dismissType,
            dismissed_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        const { error } = await updateQuery;

        if (error) {
          logger.error('Failed to update popup dismissal', { error: error.message });
          return false;
        }
      } else {
        // Insert new dismissal
        const { error } = await supabase.from('popup_dismissals').insert({
          user_id: request.userId || null,
          device_id: request.deviceId || null,
          popup_id: request.popupId,
          dismiss_type: request.dismissType,
          dismissed_at: new Date().toISOString(),
        });

        if (error) {
          // Ignore duplicate key errors (race condition)
          if (error.code === '23505') {
            logger.debug('Popup dismissal already exists (race condition)', {
              popupId: request.popupId,
            });
            return true;
          }
          logger.error('Failed to dismiss popup', { error: error.message, code: error.code });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error in dismissPopup', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get a single popup by ID
   */
  async getPopupById(popupId: string): Promise<AdminPopupResponse | null> {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase
        .from('app_popups')
        .select('*')
        .eq('id', popupId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Failed to fetch popup', { error: error.message });
        return null;
      }

      return toAdminPopupResponse(data);
    } catch (error) {
      logger.error('Error in getPopupById', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // =============================================
  // ADMIN METHODS
  // =============================================

  /**
   * List all popups (admin)
   */
  async listPopups(request: AdminListPopupsRequest): Promise<AdminPopupListResponse> {
    const supabase = getSupabaseClient();

    const page = request.page || 0;
    const limit = request.limit || 20;
    const sortBy = request.sortBy || 'display_order';
    const sortOrder = request.sortOrder || 'asc';

    try {
      let query = supabase.from('app_popups').select('*', { count: 'exact' });

      // Apply filters
      if (request.active !== undefined) {
        query = query.eq('active', request.active);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = page * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to list popups', { error: error.message });
        return {
          popups: [],
          total: 0,
          page,
          limit,
          hasMore: false,
        };
      }

      const total = count || 0;

      return {
        popups: (data || []).map((popup: AppPopup) => toAdminPopupResponse(popup)),
        total,
        page,
        limit,
        hasMore: (page + 1) * limit < total,
      };
    } catch (error) {
      logger.error('Error in listPopups', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        popups: [],
        total: 0,
        page,
        limit,
        hasMore: false,
      };
    }
  }

  /**
   * Create a new popup (admin)
   */
  async createPopup(
    request: CreatePopupRequest,
    createdBy?: string
  ): Promise<AdminPopupResponse | null> {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase
        .from('app_popups')
        .insert({
          title: request.title,
          image_url: request.imageUrl,
          link_url: request.linkUrl || null,
          link_type: request.linkType || 'none',
          display_order: request.displayOrder || 0,
          active: request.active !== undefined ? request.active : true,
          start_date: request.startDate || null,
          end_date: request.endDate || null,
          target_audience: request.targetAudience || 'all',
          created_by: createdBy || null,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create popup', { error: error.message });
        return null;
      }

      return toAdminPopupResponse(data);
    } catch (error) {
      logger.error('Error in createPopup', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update an existing popup (admin)
   */
  async updatePopup(
    popupId: string,
    request: UpdatePopupRequest
  ): Promise<AdminPopupResponse | null> {
    const supabase = getSupabaseClient();

    try {
      // Build update object with only provided fields
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (request.title !== undefined) updateData.title = request.title;
      if (request.imageUrl !== undefined) updateData.image_url = request.imageUrl;
      if (request.linkUrl !== undefined) updateData.link_url = request.linkUrl;
      if (request.linkType !== undefined) updateData.link_type = request.linkType;
      if (request.displayOrder !== undefined) updateData.display_order = request.displayOrder;
      if (request.active !== undefined) updateData.active = request.active;
      if (request.startDate !== undefined) updateData.start_date = request.startDate;
      if (request.endDate !== undefined) updateData.end_date = request.endDate;
      if (request.targetAudience !== undefined) updateData.target_audience = request.targetAudience;

      const { data, error } = await supabase
        .from('app_popups')
        .update(updateData)
        .eq('id', popupId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update popup', { error: error.message });
        return null;
      }

      return toAdminPopupResponse(data);
    } catch (error) {
      logger.error('Error in updatePopup', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Delete a popup (admin)
   */
  async deletePopup(popupId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase.from('app_popups').delete().eq('id', popupId);

      if (error) {
        logger.error('Failed to delete popup', { error: error.message });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in deletePopup', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Reorder popups (admin)
   */
  async reorderPopups(popupOrders: { id: string; displayOrder: number }[]): Promise<boolean> {
    const supabase = getSupabaseClient();

    try {
      // Update each popup's display order
      const updates = popupOrders.map(({ id, displayOrder }) =>
        supabase
          .from('app_popups')
          .update({ display_order: displayOrder, updated_at: new Date().toISOString() })
          .eq('id', id)
      );

      const results = await Promise.all(updates);

      const hasError = results.some((result) => result.error);
      if (hasError) {
        logger.error('Failed to reorder popups');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in reorderPopups', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get popup statistics (admin)
   */
  async getStatistics(): Promise<PopupStatistics> {
    const supabase = getSupabaseClient();

    try {
      // Get all popups
      const { data: popups, error } = await supabase
        .from('app_popups')
        .select('*')
        .order('click_count', { ascending: false });

      if (error) {
        logger.error('Failed to fetch popup statistics', { error: error.message });
        return {
          totalPopups: 0,
          activePopups: 0,
          totalViews: 0,
          totalClicks: 0,
          averageClickRate: 0,
          topPerformingPopups: [],
        };
      }

      const total = popups?.length || 0;
      const active = popups?.filter((p: AppPopup) => p.active).length || 0;
      const totalViews = popups?.reduce((sum: number, p: AppPopup) => sum + p.view_count, 0) || 0;
      const totalClicks = popups?.reduce((sum: number, p: AppPopup) => sum + p.click_count, 0) || 0;
      const avgClickRate = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

      return {
        totalPopups: total,
        activePopups: active,
        totalViews,
        totalClicks,
        averageClickRate: Math.round(avgClickRate * 100) / 100,
        topPerformingPopups: (popups || []).slice(0, 5).map((p: AppPopup) => toAdminPopupResponse(p)),
      };
    } catch (error) {
      logger.error('Error in getStatistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        totalPopups: 0,
        activePopups: 0,
        totalViews: 0,
        totalClicks: 0,
        averageClickRate: 0,
        topPerformingPopups: [],
      };
    }
  }
}

export const popupService = new PopupService();
export default popupService;
