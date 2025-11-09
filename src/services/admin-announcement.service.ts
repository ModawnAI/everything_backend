import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface AnnouncementData {
  title: string;
  content: string;
  isImportant?: boolean;
  isActive?: boolean;
  targetUserType?: string[];
  startsAt?: string;
  endsAt?: string;
}

export class AdminAnnouncementService {
  private supabase = getSupabaseClient();

  /**
   * Get all announcements with filtering
   */
  async getAnnouncements(
    page: number,
    limit: number,
    filters: { isActive?: boolean; isImportant?: boolean },
    adminId: string
  ): Promise<any> {
    try {
      const offset = (page - 1) * limit;
      let query = this.supabase
        .from('announcements')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      if (filters.isImportant !== undefined) {
        query = query.eq('is_important', filters.isImportant);
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      logger.info('Announcements retrieved', { adminId, page, limit, filters });

      return {
        announcements: data || [],
        totalCount: count || 0,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      logger.error('Get announcements failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Get announcement by ID
   */
  async getAnnouncementById(announcementId: string, adminId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('announcements')
        .select('*')
        .eq('id', announcementId)
        .single();

      if (error) {
        throw error;
      }

      logger.info('Announcement retrieved', { adminId, announcementId });

      return { announcement: data };
    } catch (error) {
      logger.error('Get announcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        announcementId
      });
      throw error;
    }
  }

  /**
   * Create new announcement
   */
  async createAnnouncement(announcementData: AnnouncementData, adminId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('announcements')
        .insert({
          title: announcementData.title,
          content: announcementData.content,
          is_important: announcementData.isImportant || false,
          is_active: announcementData.isActive !== undefined ? announcementData.isActive : true,
          target_user_type: announcementData.targetUserType || null,
          starts_at: announcementData.startsAt || new Date().toISOString(),
          ends_at: announcementData.endsAt || null,
          created_by: adminId
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Announcement created', { adminId, announcementId: data.id });

      return { announcement: data };
    } catch (error) {
      logger.error('Create announcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Update announcement
   */
  async updateAnnouncement(
    announcementId: string,
    updates: Partial<AnnouncementData>,
    adminId: string
  ): Promise<any> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }
      if (updates.content !== undefined) {
        updateData.content = updates.content;
      }
      if (updates.isImportant !== undefined) {
        updateData.is_important = updates.isImportant;
      }
      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }
      if (updates.targetUserType !== undefined) {
        updateData.target_user_type = updates.targetUserType;
      }
      if (updates.startsAt !== undefined) {
        updateData.starts_at = updates.startsAt;
      }
      if (updates.endsAt !== undefined) {
        updateData.ends_at = updates.endsAt;
      }

      const { data, error } = await this.supabase
        .from('announcements')
        .update(updateData)
        .eq('id', announcementId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Announcement updated', { adminId, announcementId });

      return { announcement: data };
    } catch (error) {
      logger.error('Update announcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        announcementId
      });
      throw error;
    }
  }

  /**
   * Delete announcement
   */
  async deleteAnnouncement(announcementId: string, adminId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Announcement deleted', { adminId, announcementId });

      return { announcement: data };
    } catch (error) {
      logger.error('Delete announcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        announcementId
      });
      throw error;
    }
  }
}

export const adminAnnouncementService = new AdminAnnouncementService();
