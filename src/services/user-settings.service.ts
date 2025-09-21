/**
 * User Settings Service
 * 
 * Comprehensive user settings management with validation, 
 * real-time synchronization, and change tracking
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { UserSettings } from '../types/database.types';
import { websocketService } from './websocket.service';

export interface UserSettingsUpdateRequest {
  // Notification settings
  push_notifications_enabled?: boolean;
  reservation_notifications?: boolean;
  event_notifications?: boolean;
  marketing_notifications?: boolean;
  
  // Privacy settings
  location_tracking_enabled?: boolean;
  
  // Preference settings
  language_preference?: 'ko' | 'en' | 'ja' | 'zh';
  currency_preference?: 'KRW' | 'USD' | 'JPY' | 'CNY';
  theme_preference?: 'light' | 'dark' | 'auto';
  
  // Additional settings (extensible)
  timezone?: string;
  date_format?: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  time_format?: '12h' | '24h';
  email_notifications?: boolean;
  sms_notifications?: boolean;
  sound_enabled?: boolean;
  vibration_enabled?: boolean;
}

export interface SettingsCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  settings: SettingField[];
}

export interface SettingField {
  key: string;
  name: string;
  description: string;
  type: 'boolean' | 'string' | 'select' | 'number';
  defaultValue: any;
  options?: Array<{ value: any; label: string }>;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any) => boolean;
  };
  category: string;
  order: number;
}

export interface SettingsChangeHistory {
  id: string;
  user_id: string;
  setting_key: string;
  old_value: any;
  new_value: any;
  changed_at: string;
  changed_by: 'user' | 'system' | 'admin';
  ip_address?: string;
  user_agent?: string;
}

export interface ValidationRule {
  field: string;
  rules: {
    required?: boolean;
    type?: string;
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
    custom?: (value: any) => { valid: boolean; message?: string };
  };
  message: string;
}

export class UserSettingsService {
  private supabase = getSupabaseClient();

  /**
   * Get user settings with defaults
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error fetching user settings:', { userId, error });
        throw new Error(`Failed to fetch user settings: ${error.message}`);
      }

      // If no settings exist, create default settings
      if (!data) {
        return await this.createDefaultSettings(userId);
      }

      return data;
    } catch (error) {
      logger.error('UserSettingsService.getUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId: string, updates: UserSettingsUpdateRequest): Promise<UserSettings> {
    try {
      // Validate updates
      this.validateSettingsUpdate(updates);

      // Get current settings
      const currentSettings = await this.getUserSettings(userId);

      // Track changes for history
      const changes: Array<{ key: string; oldValue: any; newValue: any }> = [];
      
      // Prepare update data
      const updateData: Partial<UserSettings> = {
        updated_at: new Date().toISOString()
      };

      // Process each update
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== currentSettings[key as keyof UserSettings]) {
          (updateData as any)[key] = value;
          changes.push({
            key,
            oldValue: currentSettings[key as keyof UserSettings],
            newValue: value
          });
        }
      }

      // Update settings
      const { data, error } = await this.supabase
        .from('user_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user settings:', { userId, error });
        throw new Error(`Failed to update user settings: ${error.message}`);
      }

      if (!data) {
        throw new Error('Failed to update user settings: No data returned');
      }

      // Log changes to history
      if (changes.length > 0) {
        await this.logSettingsChanges(userId, changes);
      }

      // Broadcast settings update to all user's connected devices
      if (changes.length > 0 && websocketService) {
        const changedFields = changes.map(change => change.key);
        const newValues = changes.reduce((acc, change) => {
          acc[change.key] = change.newValue;
          return acc;
        }, {} as Record<string, any>);

        websocketService.broadcastSettingsUpdate(userId, changedFields, newValues, 'api');
      }

      logger.info('User settings updated successfully:', { 
        userId, 
        updatedFields: Object.keys(updates),
        changes: changes.length 
      });

      return data;
    } catch (error) {
      logger.error('UserSettingsService.updateUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Bulk update multiple settings
   */
  async bulkUpdateSettings(userId: string, settings: UserSettingsUpdateRequest): Promise<UserSettings> {
    try {
      // Validate all settings
      this.validateSettingsUpdate(settings);

      // Get current settings
      const currentSettings = await this.getUserSettings(userId);

      // Track changes for history
      const changes: Array<{ key: string; oldValue: any; newValue: any }> = [];
      
      // Prepare update data
      const updateData: Partial<UserSettings> = {
        updated_at: new Date().toISOString()
      };

      // Process each setting
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined && value !== currentSettings[key as keyof UserSettings]) {
          (updateData as any)[key] = value;
          changes.push({
            key,
            oldValue: currentSettings[key as keyof UserSettings],
            newValue: value
          });
        }
      }

      // Update settings
      const { data, error } = await this.supabase
        .from('user_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error bulk updating user settings:', { userId, error });
        throw new Error(`Failed to bulk update user settings: ${error.message}`);
      }

      if (!data) {
        throw new Error('Failed to bulk update user settings: No data returned');
      }

      // Log changes to history
      if (changes.length > 0) {
        await this.logSettingsChanges(userId, changes);
      }

      // Broadcast settings update to all user's connected devices
      if (changes.length > 0 && websocketService) {
        const changedFields = changes.map(change => change.key);
        const newValues = changes.reduce((acc, change) => {
          acc[change.key] = change.newValue;
          return acc;
        }, {} as Record<string, any>);

        websocketService.broadcastSettingsUpdate(userId, changedFields, newValues, 'api');
      }

      logger.info('User settings bulk updated successfully:', { 
        userId, 
        updatedFields: Object.keys(settings),
        changes: changes.length 
      });

      return data;
    } catch (error) {
      logger.error('UserSettingsService.bulkUpdateSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Reset user settings to defaults
   */
  async resetUserSettings(userId: string): Promise<UserSettings> {
    try {
      const defaultSettings = this.getDefaultSettings();

      // Get current settings for history
      const currentSettings = await this.getUserSettings(userId);

      // Track changes for history
      const changes: Array<{ key: string; oldValue: any; newValue: any }> = [];
      
      // Compare current settings with defaults
      for (const [key, defaultValue] of Object.entries(defaultSettings)) {
        const currentValue = currentSettings[key as keyof UserSettings];
        if (currentValue !== defaultValue) {
          changes.push({
            key,
            oldValue: currentValue,
            newValue: defaultValue
          });
        }
      }

      // Reset to defaults
      const { data, error } = await this.supabase
        .from('user_settings')
        .update({
          ...defaultSettings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error resetting user settings:', { userId, error });
        throw new Error(`Failed to reset user settings: ${error.message}`);
      }

      if (!data) {
        throw new Error('Failed to reset user settings: No data returned');
      }

      // Log changes to history
      if (changes.length > 0) {
        await this.logSettingsChanges(userId, changes);
      }

      // Broadcast settings reset to all user's connected devices
      if (changes.length > 0 && websocketService) {
        const changedFields = changes.map(change => change.key);
        const newValues = changes.reduce((acc, change) => {
          acc[change.key] = change.newValue;
          return acc;
        }, {} as Record<string, any>);

        websocketService.broadcastSettingsUpdate(userId, changedFields, newValues, 'api');
      }

      logger.info('User settings reset to defaults:', { 
        userId, 
        changes: changes.length 
      });

      return data;
    } catch (error) {
      logger.error('UserSettingsService.resetUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Get default settings
   */
  getDefaultSettings(): Partial<UserSettings> {
    return {
      push_notifications_enabled: true,
      reservation_notifications: true,
      event_notifications: true,
      marketing_notifications: false,
      location_tracking_enabled: true,
      language_preference: 'ko',
      currency_preference: 'KRW',
      theme_preference: 'light'
    };
  }

  /**
   * Get settings categories and fields
   */
  getSettingsCategories(): SettingsCategory[] {
    return [
      {
        id: 'notifications',
        name: '알림 설정',
        description: '푸시 알림 및 이메일 알림 설정',
        icon: 'bell',
        settings: [
          {
            key: 'push_notifications_enabled',
            name: '푸시 알림',
            description: '모든 푸시 알림을 받습니다',
            type: 'boolean',
            defaultValue: true,
            category: 'notifications',
            order: 1
          },
          {
            key: 'reservation_notifications',
            name: '예약 알림',
            description: '예약 관련 알림을 받습니다',
            type: 'boolean',
            defaultValue: true,
            category: 'notifications',
            order: 2
          },
          {
            key: 'event_notifications',
            name: '이벤트 알림',
            description: '이벤트 및 프로모션 알림을 받습니다',
            type: 'boolean',
            defaultValue: true,
            category: 'notifications',
            order: 3
          },
          {
            key: 'marketing_notifications',
            name: '마케팅 알림',
            description: '마케팅 정보 및 광고 알림을 받습니다',
            type: 'boolean',
            defaultValue: false,
            category: 'notifications',
            order: 4
          }
        ]
      },
      {
        id: 'privacy',
        name: '개인정보 보호',
        description: '개인정보 및 위치 추적 설정',
        icon: 'shield',
        settings: [
          {
            key: 'location_tracking_enabled',
            name: '위치 추적',
            description: '위치 기반 서비스를 사용합니다',
            type: 'boolean',
            defaultValue: true,
            category: 'privacy',
            order: 1
          }
        ]
      },
      {
        id: 'preferences',
        name: '환경 설정',
        description: '언어, 통화, 테마 등 기본 설정',
        icon: 'settings',
        settings: [
          {
            key: 'language_preference',
            name: '언어',
            description: '앱에서 사용할 언어를 선택하세요',
            type: 'select',
            defaultValue: 'ko',
            options: [
              { value: 'ko', label: '한국어' },
              { value: 'en', label: 'English' },
              { value: 'ja', label: '日本語' },
              { value: 'zh', label: '中文' }
            ],
            category: 'preferences',
            order: 1
          },
          {
            key: 'currency_preference',
            name: '통화',
            description: '가격 표시에 사용할 통화를 선택하세요',
            type: 'select',
            defaultValue: 'KRW',
            options: [
              { value: 'KRW', label: '원 (₩)' },
              { value: 'USD', label: 'Dollar ($)' },
              { value: 'JPY', label: 'Yen (¥)' },
              { value: 'CNY', label: 'Yuan (¥)' }
            ],
            category: 'preferences',
            order: 2
          },
          {
            key: 'theme_preference',
            name: '테마',
            description: '앱의 테마를 선택하세요',
            type: 'select',
            defaultValue: 'light',
            options: [
              { value: 'light', label: '라이트 모드' },
              { value: 'dark', label: '다크 모드' },
              { value: 'auto', label: '시스템 설정 따름' }
            ],
            category: 'preferences',
            order: 3
          }
        ]
      }
    ];
  }

  /**
   * Get validation rules for settings
   */
  getValidationRules(): ValidationRule[] {
    return [
      {
        field: 'language_preference',
        rules: {
          required: false,
          enum: ['ko', 'en', 'ja', 'zh']
        },
        message: '지원되는 언어를 선택해주세요.'
      },
      {
        field: 'currency_preference',
        rules: {
          required: false,
          enum: ['KRW', 'USD', 'JPY', 'CNY']
        },
        message: '지원되는 통화를 선택해주세요.'
      },
      {
        field: 'theme_preference',
        rules: {
          required: false,
          enum: ['light', 'dark', 'auto']
        },
        message: '지원되는 테마를 선택해주세요.'
      },
      {
        field: 'push_notifications_enabled',
        rules: {
          required: false,
          type: 'boolean'
        },
        message: '푸시 알림 설정은 true 또는 false 값이어야 합니다.'
      },
      {
        field: 'reservation_notifications',
        rules: {
          required: false,
          type: 'boolean'
        },
        message: '예약 알림 설정은 true 또는 false 값이어야 합니다.'
      },
      {
        field: 'event_notifications',
        rules: {
          required: false,
          type: 'boolean'
        },
        message: '이벤트 알림 설정은 true 또는 false 값이어야 합니다.'
      },
      {
        field: 'marketing_notifications',
        rules: {
          required: false,
          type: 'boolean'
        },
        message: '마케팅 알림 설정은 true 또는 false 값이어야 합니다.'
      },
      {
        field: 'location_tracking_enabled',
        rules: {
          required: false,
          type: 'boolean'
        },
        message: '위치 추적 설정은 true 또는 false 값이어야 합니다.'
      }
    ];
  }

  /**
   * Get settings change history
   */
  async getSettingsHistory(userId: string, limit: number = 50, offset: number = 0): Promise<SettingsChangeHistory[]> {
    try {
      // This would typically query a settings_history table
      // For now, return empty array as history tracking needs to be implemented
      return [];
    } catch (error) {
      logger.error('UserSettingsService.getSettingsHistory error:', { userId, error });
      throw error;
    }
  }

  /**
   * Create default settings for new user
   */
  private async createDefaultSettings(userId: string): Promise<UserSettings> {
    try {
      const defaultSettings = this.getDefaultSettings();
      
      const { data, error } = await this.supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          ...defaultSettings
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating default user settings:', { userId, error });
        throw new Error(`Failed to create default user settings: ${error.message}`);
      }

      if (!data) {
        throw new Error('Failed to create default user settings: No data returned');
      }

      logger.info('Default user settings created:', { userId });
      return data;
    } catch (error) {
      logger.error('UserSettingsService.createDefaultSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Validate settings update
   */
  private validateSettingsUpdate(updates: UserSettingsUpdateRequest): void {
    const validationRules = this.getValidationRules();
    
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      
      const rule = validationRules.find(r => r.field === key);
      if (!rule) continue;

      // Type validation
      if (rule.rules.type === 'boolean' && typeof value !== 'boolean') {
        throw new Error(rule.message);
      }

      // Enum validation
      if (rule.rules.enum && !rule.rules.enum.includes(value)) {
        throw new Error(rule.message);
      }

      // Custom validation
      if (rule.rules.custom) {
        const result = rule.rules.custom(value);
        if (!result.valid) {
          throw new Error(result.message || rule.message);
        }
      }
    }
  }

  /**
   * Log settings changes to history
   */
  private async logSettingsChanges(
    userId: string, 
    changes: Array<{ key: string; oldValue: any; newValue: any }>
  ): Promise<void> {
    try {
      // This would typically insert into a settings_history table
      // For now, just log the changes
      logger.info('Settings changes logged:', { 
        userId, 
        changes: changes.map(c => ({
          key: c.key,
          oldValue: c.oldValue,
          newValue: c.newValue
        }))
      });
    } catch (error) {
      logger.error('Failed to log settings changes:', { userId, error });
    }
  }
}

// Export singleton instance
export const userSettingsService = new UserSettingsService();
export default userSettingsService;
