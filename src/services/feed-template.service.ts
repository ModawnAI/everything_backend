/**
 * Feed Template Service
 *
 * Handles feed post templates for shop owners
 * Allows shop owners to save and reuse post templates
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  FeedTemplate,
  TemplateCategory,
  CreateFeedTemplateRequest,
  UpdateFeedTemplateRequest
} from '../types/database.types';

export interface TemplateResult {
  success: boolean;
  template?: FeedTemplate;
  error?: string;
}

export interface TemplatesListResult {
  success: boolean;
  templates?: FeedTemplate[];
  total?: number;
  error?: string;
}

/**
 * Feed Template Service
 * Manages reusable post templates for shop owners
 */
export class FeedTemplateService {
  private supabase = getSupabaseClient();

  /**
   * Get all templates for a shop
   */
  async getTemplates(shopId: string): Promise<TemplatesListResult> {
    try {
      const { data, error, count } = await this.supabase
        .from('feed_templates')
        .select('*', { count: 'exact' })
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching feed templates', { error, shopId });
        return { success: false, error: 'Failed to fetch templates' };
      }

      const templates = (data || []).map(this.mapTemplate);

      return {
        success: true,
        templates,
        total: count || 0
      };

    } catch (error) {
      logger.error('Error in getTemplates', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: string, shopId: string): Promise<TemplateResult> {
    try {
      const { data, error } = await this.supabase
        .from('feed_templates')
        .select('*')
        .eq('id', templateId)
        .eq('shop_id', shopId)
        .single();

      if (error || !data) {
        return { success: false, error: 'Template not found' };
      }

      return {
        success: true,
        template: this.mapTemplate(data)
      };

    } catch (error) {
      logger.error('Error in getTemplate', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(
    shopId: string,
    data: CreateFeedTemplateRequest
  ): Promise<TemplateResult> {
    try {
      // Validate input
      if (!data.name || data.name.trim().length === 0) {
        return { success: false, error: 'Template name is required' };
      }

      if (data.name.length > 100) {
        return { success: false, error: 'Template name must be 100 characters or less' };
      }

      if (!data.content || data.content.trim().length === 0) {
        return { success: false, error: 'Template content is required' };
      }

      if (data.content.length > 2000) {
        return { success: false, error: 'Template content must be 2000 characters or less' };
      }

      // Validate category if provided
      const validCategories: TemplateCategory[] = ['event', 'promotion', 'daily', 'announcement'];
      if (data.category && !validCategories.includes(data.category)) {
        return { success: false, error: 'Invalid template category' };
      }

      const now = new Date().toISOString();

      const { data: template, error } = await this.supabase
        .from('feed_templates')
        .insert({
          shop_id: shopId,
          name: data.name.trim(),
          content: data.content.trim(),
          category: data.category || null,
          is_default: false,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating feed template', { error, shopId });
        return { success: false, error: 'Failed to create template' };
      }

      logger.info('Feed template created successfully', {
        templateId: template.id,
        shopId,
        name: data.name
      });

      return {
        success: true,
        template: this.mapTemplate(template)
      };

    } catch (error) {
      logger.error('Error in createTemplate', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    shopId: string,
    data: UpdateFeedTemplateRequest
  ): Promise<TemplateResult> {
    try {
      // Check if template exists
      const { data: existing, error: checkError } = await this.supabase
        .from('feed_templates')
        .select('id')
        .eq('id', templateId)
        .eq('shop_id', shopId)
        .single();

      if (checkError || !existing) {
        return { success: false, error: 'Template not found' };
      }

      // Build update object
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (data.name !== undefined) {
        if (data.name.length > 100) {
          return { success: false, error: 'Template name must be 100 characters or less' };
        }
        updateData.name = data.name.trim();
      }

      if (data.content !== undefined) {
        if (data.content.length > 2000) {
          return { success: false, error: 'Template content must be 2000 characters or less' };
        }
        updateData.content = data.content.trim();
      }

      if (data.category !== undefined) {
        const validCategories: TemplateCategory[] = ['event', 'promotion', 'daily', 'announcement'];
        if (data.category && !validCategories.includes(data.category)) {
          return { success: false, error: 'Invalid template category' };
        }
        updateData.category = data.category;
      }

      if (data.is_default !== undefined) {
        updateData.is_default = data.is_default;

        // If setting as default, unset other defaults for this shop
        if (data.is_default) {
          await this.supabase
            .from('feed_templates')
            .update({ is_default: false })
            .eq('shop_id', shopId)
            .neq('id', templateId);
        }
      }

      const { data: template, error } = await this.supabase
        .from('feed_templates')
        .update(updateData)
        .eq('id', templateId)
        .eq('shop_id', shopId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating feed template', { error, templateId, shopId });
        return { success: false, error: 'Failed to update template' };
      }

      logger.info('Feed template updated successfully', { templateId, shopId });

      return {
        success: true,
        template: this.mapTemplate(template)
      };

    } catch (error) {
      logger.error('Error in updateTemplate', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, shopId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('feed_templates')
        .delete()
        .eq('id', templateId)
        .eq('shop_id', shopId);

      if (error) {
        logger.error('Error deleting feed template', { error, templateId, shopId });
        return { success: false, error: 'Failed to delete template' };
      }

      logger.info('Feed template deleted successfully', { templateId, shopId });

      return { success: true };

    } catch (error) {
      logger.error('Error in deleteTemplate', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get the default template for a shop
   */
  async getDefaultTemplate(shopId: string): Promise<TemplateResult> {
    try {
      const { data, error } = await this.supabase
        .from('feed_templates')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_default', true)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching default template', { error, shopId });
        return { success: false, error: 'Failed to fetch default template' };
      }

      if (!data) {
        return { success: true, template: undefined };
      }

      return {
        success: true,
        template: this.mapTemplate(data)
      };

    } catch (error) {
      logger.error('Error in getDefaultTemplate', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(shopId: string, category: TemplateCategory): Promise<TemplatesListResult> {
    try {
      const { data, error, count } = await this.supabase
        .from('feed_templates')
        .select('*', { count: 'exact' })
        .eq('shop_id', shopId)
        .eq('category', category)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching templates by category', { error, shopId, category });
        return { success: false, error: 'Failed to fetch templates' };
      }

      const templates = (data || []).map(this.mapTemplate);

      return {
        success: true,
        templates,
        total: count || 0
      };

    } catch (error) {
      logger.error('Error in getTemplatesByCategory', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Map database row to FeedTemplate interface
   */
  private mapTemplate(data: any): FeedTemplate {
    return {
      id: data.id,
      shop_id: data.shop_id,
      name: data.name,
      content: data.content,
      category: data.category,
      is_default: data.is_default,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }
}

export const feedTemplateService = new FeedTemplateService();
