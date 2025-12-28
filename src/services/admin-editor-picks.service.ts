/**
 * Editor Picks Admin Service
 * Provides CRUD operations for managing editor's picks
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface CreateEditorPickData {
  shopId: string;
  title?: string;
  description?: string;
  displayOrder?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateEditorPickData {
  shopId?: string;
  title?: string;
  description?: string;
  displayOrder?: number;
  startDate?: string;
  endDate?: string;
  active?: boolean;
}

export interface EditorPickWithShop {
  id: string;
  shop_id: string;
  title: string | null;
  description: string | null;
  display_order: number;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  shop?: {
    id: string;
    name: string;
    main_category: string;
    thumbnail_url: string | null;
  };
  created_by_user?: {
    nickname: string | null;
  };
}

class AdminEditorPicksService {
  /**
   * Get all editor picks (admin view - includes inactive)
   */
  async getAll(): Promise<EditorPickWithShop[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('editor_picks')
      .select(`
        *,
        shops (id, name, main_category, thumbnail_url),
        users!created_by (nickname)
      `)
      .order('display_order', { ascending: true });

    if (error) {
      // Table might not exist yet
      if (error.code === 'PGRST205' || error.message.includes('does not exist')) {
        logger.warn('Editor picks table not found - migration may need to be run');
        throw new Error('Editor picks table not found. Please run the migration first.');
      }
      throw new Error(`Failed to fetch editor picks: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      ...item,
      shop: item.shops,
      created_by_user: item.users,
    }));
  }

  /**
   * Get a single editor pick by ID
   */
  async getById(id: string): Promise<EditorPickWithShop | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('editor_picks')
      .select(`
        *,
        shops (id, name, main_category, thumbnail_url),
        users!created_by (nickname)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch editor pick: ${error.message}`);
    }

    return {
      ...data,
      shop: data.shops,
      created_by_user: data.users,
    };
  }

  /**
   * Create a new editor pick
   */
  async create(data: CreateEditorPickData, adminId?: string): Promise<EditorPickWithShop> {
    const supabase = getSupabaseClient();

    // Verify shop exists
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('id', data.shopId)
      .single();

    if (shopError || !shopData) {
      throw new Error(`Shop not found: ${data.shopId}`);
    }

    // Get the next display order if not provided
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const { data: maxOrderData } = await supabase
        .from('editor_picks')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      displayOrder = (maxOrderData?.display_order || 0) + 1;
    }

    const { data: pick, error } = await supabase
      .from('editor_picks')
      .insert({
        shop_id: data.shopId,
        title: data.title || null,
        description: data.description || null,
        display_order: displayOrder,
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        created_by: adminId || null,
        active: true,
      })
      .select(`
        *,
        shops (id, name, main_category, thumbnail_url)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create editor pick: ${error.message}`);
    }

    logger.info('Editor pick created', {
      pickId: pick.id,
      shopId: data.shopId,
      adminId,
    });

    return {
      ...pick,
      shop: pick.shops,
    };
  }

  /**
   * Update an editor pick
   */
  async update(id: string, data: UpdateEditorPickData): Promise<EditorPickWithShop> {
    const supabase = getSupabaseClient();

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.shopId !== undefined) {
      // Verify new shop exists
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('id', data.shopId)
        .single();

      if (shopError || !shopData) {
        throw new Error(`Shop not found: ${data.shopId}`);
      }
      updateData.shop_id = data.shopId;
    }

    if (data.title !== undefined) updateData.title = data.title || null;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;
    if (data.startDate !== undefined) updateData.start_date = data.startDate || null;
    if (data.endDate !== undefined) updateData.end_date = data.endDate || null;
    if (data.active !== undefined) updateData.active = data.active;

    const { data: pick, error } = await supabase
      .from('editor_picks')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        shops (id, name, main_category, thumbnail_url)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update editor pick: ${error.message}`);
    }

    logger.info('Editor pick updated', { pickId: id, changes: Object.keys(data) });

    return {
      ...pick,
      shop: pick.shops,
    };
  }

  /**
   * Delete an editor pick
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('editor_picks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete editor pick: ${error.message}`);
    }

    logger.info('Editor pick deleted', { pickId: id });
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: string, active: boolean): Promise<EditorPickWithShop> {
    return this.update(id, { active });
  }

  /**
   * Reorder editor picks
   */
  async reorder(picks: { id: string; order: number }[]): Promise<void> {
    const supabase = getSupabaseClient();

    // Use Promise.all for parallel updates
    const updatePromises = picks.map(({ id, order }) =>
      supabase
        .from('editor_picks')
        .update({
          display_order: order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    );

    const results = await Promise.all(updatePromises);

    // Check for errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      throw new Error(`Failed to reorder some picks: ${errors[0].error!.message}`);
    }

    logger.info('Editor picks reordered', { count: picks.length });
  }

  /**
   * Search shops for adding to editor picks
   */
  async searchShops(query: string, limit = 20): Promise<any[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('shops')
      .select('id, name, main_category, thumbnail_url, average_rating')
      .eq('shop_status', 'active')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search shops: ${error.message}`);
    }

    return data || [];
  }
}

export const adminEditorPicksService = new AdminEditorPicksService();
export default adminEditorPicksService;
