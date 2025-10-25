/**
 * User Profile Management Service
 * 
 * Handles comprehensive user profile operations including:
 * - Profile CRUD operations
 * - Profile image upload and management
 * - Privacy settings management
 * - Profile completion tracking
 * - Data validation and sanitization
 */

import { getSupabaseClient } from '../config/database';
import { User, UserSettings } from '../types/database.types';
import { logger } from '../utils/logger';
import { normalizeSupabaseUrl } from '../utils/supabase-url';
import sharp from 'sharp';
import { websocketService } from './websocket.service';

// Profile completion requirements
export interface ProfileCompletionRequirements {
  hasName: boolean;
  hasPhone: boolean;
  hasPhoneVerified: boolean;
  hasGender: boolean;
  hasBirthDate: boolean;
  hasProfileImage: boolean;
  hasTermsAccepted: boolean;
  hasPrivacyAccepted: boolean;
}

export interface ProfileCompletionStatus {
  isComplete: boolean;
  completionPercentage: number;
  missingFields: string[];
  requirements: ProfileCompletionRequirements;
}

export interface ProfileUpdateRequest {
  name?: string;
  nickname?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birth_date?: string;
  profile_image_url?: string;
  marketing_consent?: boolean;
}

export interface PrivacySettingsUpdateRequest {
  push_notifications_enabled?: boolean;
  reservation_notifications?: boolean;
  event_notifications?: boolean;
  marketing_notifications?: boolean;
  location_tracking_enabled?: boolean;
  language_preference?: string;
  currency_preference?: string;
  theme_preference?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  sound_enabled?: boolean;
  vibration_enabled?: boolean;
}

export interface SettingsHistoryItem {
  id: string;
  user_id: string;
  field_name: string;
  old_value: any;
  new_value: any;
  changed_at: string;
  change_reason?: string;
}

export interface SettingsBackup {
  id: string;
  user_id: string;
  settings: UserSettings;
  created_at: string;
  backup_name?: string;
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

export interface SettingsMetadata {
  field: string;
  name: string;
  description: string;
  type: 'boolean' | 'string' | 'select' | 'number';
  defaultValue: any;
  options?: Array<{ value: any; label: string }>;
  required: boolean;
  category: 'notifications' | 'privacy' | 'preferences' | 'appearance' | 'accessibility';
}

export interface SettingsStats {
  totalSettings: number;
  configuredSettings: number;
  lastUpdated: string;
  mostChangedField: string;
  changeFrequency: number;
}

export interface ProfileImageUploadResult {
  success: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  metadata?: {
    originalSize: number;
    optimizedSize: number;
    width: number;
    height: number;
    format: string;
  };
  error?: string;
}

export class UserProfileService {
  private supabase = getSupabaseClient();

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Error fetching user profile:', { userId, error });
        throw new Error(`Failed to fetch user profile: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error('UserProfileService.getUserProfile error:', { userId, error });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: ProfileUpdateRequest): Promise<User> {
    try {
      // Validate updates
      this.validateProfileUpdates(updates);

      // Check if user exists
      const existingUser = await this.getUserProfile(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Prepare update data
      const updateData: Partial<User> = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user profile:', { userId, error });
        throw new Error(`Failed to update user profile: ${error.message}`);
      }

      logger.info('User profile updated successfully:', { userId, updatedFields: Object.keys(updates) });
      return data;
    } catch (error) {
      logger.error('UserProfileService.updateUserProfile error:', { userId, error });
      throw error;
    }
  }

  /**
   * Get user privacy settings
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
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

      return data;
    } catch (error) {
      logger.error('UserProfileService.getUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Update user privacy settings
   */
  async updateUserSettings(userId: string, updates: PrivacySettingsUpdateRequest): Promise<UserSettings | null> {
    try {
      // Validate settings updates
      this.validateSettingsUpdates(updates);

      // Check if settings exist, create if not
      let existingSettings: UserSettings | null = await this.getUserSettings(userId);
      
      if (!existingSettings) {
        // Create default settings
        const { data: newSettings, error: createError } = await this.supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            ...updates
          })
          .select()
          .single();

        if (createError) {
          logger.error('Error creating user settings:', { userId, error: createError });
          throw new Error(`Failed to create user settings: ${createError.message}`);
        }

        existingSettings = newSettings;
      } else {
        // Update existing settings
        const { data, error } = await this.supabase
          .from('user_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
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

        existingSettings = data;
      }

      // Broadcast settings update to all user's connected devices
      if (websocketService && Object.keys(updates).length > 0) {
        const changedFields = Object.keys(updates);
        const newValues = { ...updates };

        websocketService.broadcastSettingsUpdate(userId, changedFields, newValues, 'api');
      }

      logger.info('User settings updated successfully:', { userId, updatedFields: Object.keys(updates) });
      return existingSettings;
    } catch (error) {
      logger.error('UserProfileService.updateUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Bulk update user settings
   */
  async bulkUpdateUserSettings(userId: string, settings: PrivacySettingsUpdateRequest): Promise<UserSettings> {
    try {
      // Validate all settings
      this.validateSettingsUpdates(settings);

      // Get existing settings or create default
      let existingSettings = await this.getUserSettings(userId);
      if (!existingSettings) {
        existingSettings = await this.createDefaultSettings(userId);
      }

      // Update settings
      const { data, error } = await this.supabase
        .from('user_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error bulk updating user settings:', { userId, error });
        throw new Error(`Failed to bulk update user settings: ${error.message}`);
      }

      // Log settings history
      await this.logSettingsHistory(userId, existingSettings, data, 'bulk_update');

      // Broadcast settings update to all user's connected devices
      if (websocketService && Object.keys(settings).length > 0) {
        const changedFields = Object.keys(settings);
        const newValues = { ...settings };

        websocketService.broadcastSettingsUpdate(userId, changedFields, newValues, 'api');
      }

      logger.info('User settings bulk updated successfully:', { userId, updatedFields: Object.keys(settings) });
      return data;
    } catch (error) {
      logger.error('UserProfileService.bulkUpdateUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Reset user settings to defaults
   */
  async resetUserSettings(userId: string): Promise<UserSettings> {
    try {
      const defaultSettings = this.getDefaultSettings();

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

      // Log settings history
      await this.logSettingsHistory(userId, null, data, 'reset');

      logger.info('User settings reset successfully:', { userId });
      return data;
    } catch (error) {
      logger.error('UserProfileService.resetUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Get settings history
   */
  async getSettingsHistory(userId: string, limit: number = 50, offset: number = 0): Promise<SettingsHistoryItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('settings_history')
        .select('*')
        .eq('user_id', userId)
        .order('changed_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error fetching settings history:', { userId, error });
        throw new Error(`Failed to fetch settings history: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('UserProfileService.getSettingsHistory error:', { userId, error });
      throw error;
    }
  }

  /**
   * Get settings by category
   */
  async getSettingsByCategory(userId: string, category: string): Promise<Partial<UserSettings>> {
    try {
      const settings = await this.getUserSettings(userId);
      if (!settings) {
        return {};
      }

      const categoryMappings = {
        notifications: {
          push_notifications_enabled: settings.push_notifications_enabled,
          reservation_notifications: settings.reservation_notifications,
          event_notifications: settings.event_notifications,
          marketing_notifications: settings.marketing_notifications,
          email_notifications: true, // Default value since not in UserSettings
          sms_notifications: false // Default value since not in UserSettings
        },
        privacy: {
          location_tracking_enabled: settings.location_tracking_enabled
        },
        preferences: {
          language_preference: settings.language_preference,
          currency_preference: settings.currency_preference,
          timezone: 'UTC', // Default since not in UserSettings
          date_format: 'YYYY-MM-DD', // Default since not in UserSettings
          time_format: '24h' // Default since not in UserSettings
        },
        appearance: {
          theme_preference: settings.theme_preference
        },
        accessibility: {
          sound_enabled: true, // Default since not in UserSettings
          vibration_enabled: true // Default since not in UserSettings
        }
      };

      const result = categoryMappings[category as keyof typeof categoryMappings] || {};
      // Filter out properties that don't exist in UserSettings
      const filteredResult: Partial<UserSettings> = {};
      Object.keys(result).forEach(key => {
        if (key in settings) {
          (filteredResult as any)[key] = (result as any)[key];
        }
      });
      return filteredResult;
    } catch (error) {
      logger.error('UserProfileService.getSettingsByCategory error:', { userId, error });
      throw error;
    }
  }

  /**
   * Validate settings
   */
  async validateSettings(settings: PrivacySettingsUpdateRequest): Promise<SettingsValidationResult> {
    try {
      const errors: Array<{ field: string; message: string }> = [];

      // Validate each field
      Object.entries(settings).forEach(([field, value]) => {
        const validation = this.validateSettingsField(field, value);
        if (!validation.valid) {
          errors.push({ field, message: validation.message || 'Invalid value' });
        }
      });

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('UserProfileService.validateSettings error:', { error });
      throw error;
    }
  }

  /**
   * Get settings metadata
   */
  async getSettingsMetadata(): Promise<SettingsMetadata[]> {
    return [
      {
        field: 'push_notifications_enabled',
        name: '푸시 알림',
        description: '모든 푸시 알림을 받습니다',
        type: 'boolean',
        defaultValue: true,
        required: false,
        category: 'notifications'
      },
      {
        field: 'reservation_notifications',
        name: '예약 알림',
        description: '예약 관련 알림을 받습니다',
        type: 'boolean',
        defaultValue: true,
        required: false,
        category: 'notifications'
      },
      {
        field: 'event_notifications',
        name: '이벤트 알림',
        description: '이벤트 및 프로모션 알림을 받습니다',
        type: 'boolean',
        defaultValue: true,
        required: false,
        category: 'notifications'
      },
      {
        field: 'marketing_notifications',
        name: '마케팅 알림',
        description: '마케팅 정보 및 광고 알림을 받습니다',
        type: 'boolean',
        defaultValue: false,
        required: false,
        category: 'notifications'
      },
      {
        field: 'location_tracking_enabled',
        name: '위치 추적',
        description: '위치 기반 서비스를 사용합니다',
        type: 'boolean',
        defaultValue: true,
        required: false,
        category: 'privacy'
      },
      {
        field: 'language_preference',
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
        required: false,
        category: 'preferences'
      },
      {
        field: 'currency_preference',
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
        required: false,
        category: 'preferences'
      },
      {
        field: 'theme_preference',
        name: '테마',
        description: '앱의 테마를 선택하세요',
        type: 'select',
        defaultValue: 'light',
        options: [
          { value: 'light', label: '라이트 모드' },
          { value: 'dark', label: '다크 모드' },
          { value: 'auto', label: '시스템 설정 따름' }
        ],
        required: false,
        category: 'appearance'
      },
      {
        field: 'timezone',
        name: '시간대',
        description: '사용할 시간대를 선택하세요',
        type: 'string',
        defaultValue: 'Asia/Seoul',
        required: false,
        category: 'preferences'
      },
      {
        field: 'date_format',
        name: '날짜 형식',
        description: '날짜 표시 형식을 선택하세요',
        type: 'select',
        defaultValue: 'YYYY-MM-DD',
        options: [
          { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
          { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }
        ],
        required: false,
        category: 'preferences'
      },
      {
        field: 'time_format',
        name: '시간 형식',
        description: '시간 표시 형식을 선택하세요',
        type: 'select',
        defaultValue: '24h',
        options: [
          { value: '12h', label: '12시간 형식' },
          { value: '24h', label: '24시간 형식' }
        ],
        required: false,
        category: 'preferences'
      },
      {
        field: 'email_notifications',
        name: '이메일 알림',
        description: '이메일로 알림을 받습니다',
        type: 'boolean',
        defaultValue: true,
        required: false,
        category: 'notifications'
      },
      {
        field: 'sms_notifications',
        name: 'SMS 알림',
        description: 'SMS로 알림을 받습니다',
        type: 'boolean',
        defaultValue: false,
        required: false,
        category: 'notifications'
      },
      {
        field: 'sound_enabled',
        name: '소리',
        description: '알림 소리를 재생합니다',
        type: 'boolean',
        defaultValue: true,
        required: false,
        category: 'accessibility'
      },
      {
        field: 'vibration_enabled',
        name: '진동',
        description: '알림 시 진동을 사용합니다',
        type: 'boolean',
        defaultValue: true,
        required: false,
        category: 'accessibility'
      }
    ];
  }

  /**
   * Get settings statistics
   */
  async getSettingsStats(userId: string): Promise<SettingsStats> {
    try {
      const settings = await this.getUserSettings(userId);
      const history = await this.getSettingsHistory(userId, 100);

      if (!settings) {
        return {
          totalSettings: 0,
          configuredSettings: 0,
          lastUpdated: new Date().toISOString(),
          mostChangedField: '',
          changeFrequency: 0
        };
      }

      const totalSettings = Object.keys(settings).length;
      const configuredSettings = Object.values(settings).filter(value => value !== null && value !== undefined).length;
      
      // Find most changed field
      const fieldChanges = history.reduce((acc, item) => {
        acc[item.field_name] = (acc[item.field_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostChangedField = Object.entries(fieldChanges)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || '';

      return {
        totalSettings,
        configuredSettings,
        lastUpdated: settings.updated_at || settings.created_at,
        mostChangedField,
        changeFrequency: history.length
      };
    } catch (error) {
      logger.error('UserProfileService.getSettingsStats error:', { userId, error });
      throw error;
    }
  }

  /**
   * Create settings backup
   */
  async createSettingsBackup(userId: string, backupName?: string): Promise<SettingsBackup> {
    try {
      const settings = await this.getUserSettings(userId);
      if (!settings) {
        throw new Error('No settings found to backup');
      }

      const { data, error } = await this.supabase
        .from('settings_backups')
        .insert({
          user_id: userId,
          settings: settings,
          backup_name: backupName || `Backup ${new Date().toISOString()}`
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating settings backup:', { userId, error });
        throw new Error(`Failed to create settings backup: ${error.message}`);
      }

      logger.info('Settings backup created successfully:', { userId, backupId: data.id });
      return data;
    } catch (error) {
      logger.error('UserProfileService.createSettingsBackup error:', { userId, error });
      throw error;
    }
  }

  /**
   * Get settings backups
   */
  async getSettingsBackups(userId: string): Promise<SettingsBackup[]> {
    try {
      const { data, error } = await this.supabase
        .from('settings_backups')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching settings backups:', { userId, error });
        throw new Error(`Failed to fetch settings backups: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('UserProfileService.getSettingsBackups error:', { userId, error });
      throw error;
    }
  }

  /**
   * Restore settings from backup
   */
  async restoreSettingsFromBackup(userId: string, backupId: string): Promise<UserSettings> {
    try {
      const { data: backup, error: fetchError } = await this.supabase
        .from('settings_backups')
        .select('*')
        .eq('id', backupId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !backup) {
        throw new Error('Backup not found');
      }

      const { data, error } = await this.supabase
        .from('user_settings')
        .update({
          ...backup.settings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error restoring settings from backup:', { userId, error });
        throw new Error(`Failed to restore settings: ${error.message}`);
      }

      // Log settings history
      await this.logSettingsHistory(userId, null, data, 'restore_from_backup');

      logger.info('Settings restored from backup successfully:', { userId, backupId });
      return data;
    } catch (error) {
      logger.error('UserProfileService.restoreSettingsFromBackup error:', { userId, error });
      throw error;
    }
  }

  /**
   * Get profile completion status
   */
  async getProfileCompletionStatus(userId: string): Promise<ProfileCompletionStatus> {
    try {
      const user = await this.getUserProfile(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const requirements: ProfileCompletionRequirements = {
        hasName: !!user.name && user.name.trim().length > 0,
        hasPhone: !!user.phone_number,
        hasPhoneVerified: user.phone_verified,
        hasGender: !!user.gender,
        hasBirthDate: !!user.birth_date,
        hasProfileImage: !!user.profile_image_url,
        hasTermsAccepted: !!user.terms_accepted_at,
        hasPrivacyAccepted: !!user.privacy_accepted_at
      };

      const totalRequirements = Object.keys(requirements).length;
      const completedRequirements = Object.values(requirements).filter(Boolean).length;
      const completionPercentage = Math.round((completedRequirements / totalRequirements) * 100);

      const missingFields = Object.entries(requirements)
        .filter(([_, completed]) => !completed)
        .map(([field, _]) => field.replace('has', '').toLowerCase());

      return {
        isComplete: completionPercentage === 100,
        completionPercentage,
        missingFields,
        requirements
      };
    } catch (error) {
      logger.error('UserProfileService.getProfileCompletionStatus error:', { userId, error });
      throw error;
    }
  }

  /**
   * Upload profile image with Sharp.js processing
   */
  async uploadProfileImage(userId: string, imageBuffer: Buffer, fileName: string): Promise<ProfileImageUploadResult> {
    try {
      // Validate file
      this.validateImageFile(imageBuffer, fileName);

      // Extract original metadata
      const originalMetadata = await this.extractImageMetadata(imageBuffer);

      // Generate unique filename
      const uniqueFileName = `profile-${userId}-${Date.now()}`;
      
      // Process images with Sharp.js
      const { mainImage, thumbnailImage } = await this.processProfileImages(imageBuffer);

      // Upload both images to Supabase Storage
      const [mainImageUrl, thumbnailUrl] = await Promise.all([
        this.uploadImageToStorage(mainImage.buffer, `${uniqueFileName}.webp`, 'image/webp'),
        this.uploadImageToStorage(thumbnailImage.buffer, `thumbnails/${uniqueFileName}.webp`, 'image/webp')
      ]);

      // Update user profile with new image URL
      await this.updateUserProfile(userId, { profile_image_url: mainImageUrl });

      logger.info('Profile image uploaded successfully:', { 
        userId, 
        imageUrl: mainImageUrl,
        thumbnailUrl,
        originalSize: originalMetadata.size,
        optimizedSize: mainImage.buffer.length
      });

      return {
        success: true,
        imageUrl: mainImageUrl,
        thumbnailUrl,
        metadata: {
          originalSize: originalMetadata.size,
          optimizedSize: mainImage.buffer.length,
          width: mainImage.metadata.width,
          height: mainImage.metadata.height,
          format: 'webp'
        }
      };
    } catch (error) {
      logger.error('UserProfileService.uploadProfileImage error:', { userId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteUserAccount(userId: string, reason?: string): Promise<void> {
    try {
      // Check if user exists
      const existingUser = await this.getUserProfile(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Soft delete user
      const { error } = await this.supabase
        .from('users')
        .update({
          user_status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('Error deleting user account:', { userId, error });
        throw new Error(`Failed to delete user account: ${error.message}`);
      }

      // Log the deletion
      logger.info('User account deleted successfully:', { userId, reason });

      // TODO: Implement additional cleanup tasks
      // - Cancel active reservations
      // - Process refunds if needed
      // - Archive user data
      // - Send confirmation email
    } catch (error) {
      logger.error('UserProfileService.deleteUserAccount error:', { userId, error });
      throw error;
    }
  }

  /**
   * Accept terms and conditions
   */
  async acceptTerms(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('Error accepting terms:', { userId, error });
        throw new Error(`Failed to accept terms: ${error.message}`);
      }

      logger.info('Terms accepted successfully:', { userId });
    } catch (error) {
      logger.error('UserProfileService.acceptTerms error:', { userId, error });
      throw error;
    }
  }

  /**
   * Accept privacy policy
   */
  async acceptPrivacy(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          privacy_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('Error accepting privacy policy:', { userId, error });
        throw new Error(`Failed to accept privacy policy: ${error.message}`);
      }

      logger.info('Privacy policy accepted successfully:', { userId });
    } catch (error) {
      logger.error('UserProfileService.acceptPrivacy error:', { userId, error });
      throw error;
    }
  }

  /**
   * Validate profile updates
   */
  private validateProfileUpdates(updates: ProfileUpdateRequest): void {
    if (updates.name !== undefined) {
      if (!updates.name.trim() || updates.name.length > 100) {
        throw new Error('Name must be between 1 and 100 characters');
      }
    }

    if (updates.nickname !== undefined) {
      if (updates.nickname.length > 50) {
        throw new Error('Nickname must be 50 characters or less');
      }
    }

    if (updates.birth_date !== undefined) {
      const birthDate = new Date(updates.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (isNaN(birthDate.getTime())) {
        throw new Error('Invalid birth date format');
      }
      
      if (age < 14) {
        throw new Error('User must be at least 14 years old');
      }
      
      if (age > 120) {
        throw new Error('Invalid birth date');
      }
    }

    if (updates.gender !== undefined) {
      const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
      if (!validGenders.includes(updates.gender)) {
        throw new Error('Invalid gender selection');
      }
    }
  }

  /**
   * Validate settings updates
   */
  private validateSettingsUpdates(updates: PrivacySettingsUpdateRequest): void {
    if (updates.language_preference !== undefined) {
      const validLanguages = ['ko', 'en', 'ja', 'zh'];
      if (!validLanguages.includes(updates.language_preference)) {
        throw new Error('Invalid language preference');
      }
    }

    if (updates.currency_preference !== undefined) {
      const validCurrencies = ['KRW', 'USD', 'JPY', 'CNY'];
      if (!validCurrencies.includes(updates.currency_preference)) {
        throw new Error('Invalid currency preference');
      }
    }

    if (updates.theme_preference !== undefined) {
      const validThemes = ['light', 'dark', 'auto'];
      if (!validThemes.includes(updates.theme_preference)) {
        throw new Error('Invalid theme preference');
      }
    }
  }

  /**
   * Validate image file
   */
  private validateImageFile(imageBuffer: Buffer, fileName: string): void {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    if (imageBuffer.length > maxSize) {
      throw new Error('Image file size must be less than 5MB');
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      throw new Error('Only JPG, PNG, and WebP images are allowed');
    }
  }

  /**
   * Get content type for file extension
   */
  private getContentType(extension?: string): string {
    switch (extension?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  /**
   * Extract image metadata using Sharp.js
   */
  private async extractImageMetadata(imageBuffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: imageBuffer.length
      };
    } catch (error) {
      logger.error('Failed to extract image metadata:', { error });
      throw new Error('Invalid image file');
    }
  }

  /**
   * Process profile images with Sharp.js
   */
  private async processProfileImages(imageBuffer: Buffer): Promise<{
    mainImage: { buffer: Buffer; metadata: any };
    thumbnailImage: { buffer: Buffer; metadata: any };
  }> {
    try {
      // Process main image (resize to max 800x800, convert to WebP)
      const mainImageBuffer = await sharp(imageBuffer)
        .resize(800, 800, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toBuffer();

      const mainImageMetadata = await sharp(mainImageBuffer).metadata();

      // Process thumbnail image (resize to 150x150, convert to WebP)
      const thumbnailImageBuffer = await sharp(imageBuffer)
        .resize(150, 150, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 80 })
        .toBuffer();

      const thumbnailMetadata = await sharp(thumbnailImageBuffer).metadata();

      return {
        mainImage: {
          buffer: mainImageBuffer,
          metadata: mainImageMetadata
        },
        thumbnailImage: {
          buffer: thumbnailImageBuffer,
          metadata: thumbnailMetadata
        }
      };
    } catch (error) {
      logger.error('Failed to process profile images:', { error });
      throw new Error('Failed to process image');
    }
  }

  /**
   * Upload image to Supabase Storage
   */
  private async uploadImageToStorage(
    imageBuffer: Buffer, 
    fileName: string, 
    contentType: string
  ): Promise<string> {
    try {
      const filePath = `profile-images/${fileName}`;

      const { data, error } = await this.supabase.storage
        .from('profile-images')
        .upload(filePath, imageBuffer, {
          contentType,
          upsert: false
        });

      if (error) {
        logger.error('Error uploading to storage:', { fileName, error });
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      return normalizeSupabaseUrl(urlData.publicUrl);
    } catch (error) {
      logger.error('Upload to storage failed:', { fileName, error });
      throw error;
    }
  }

  /**
   * Create default settings for user
   */
  private async createDefaultSettings(userId: string): Promise<UserSettings> {
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
      logger.error('Error creating default settings:', { userId, error });
      throw new Error(`Failed to create default settings: ${error.message}`);
    }

    return data;
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): Record<string, any> {
    return {
      push_notifications_enabled: true,
      reservation_notifications: true,
      event_notifications: true,
      marketing_notifications: false,
      location_tracking_enabled: true,
      language_preference: 'ko',
      currency_preference: 'KRW',
      theme_preference: 'light',
      timezone: 'Asia/Seoul',
      date_format: 'YYYY-MM-DD',
      time_format: '24h',
      email_notifications: true,
      sms_notifications: false,
      sound_enabled: true,
      vibration_enabled: true
    };
  }

  /**
   * Validate individual settings field
   */
  private validateSettingsField(field: string, value: any): { valid: boolean; message?: string } {
    const validationRules: Record<string, (value: any) => { valid: boolean; message?: string }> = {
      push_notifications_enabled: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: '푸시 알림 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      },
      reservation_notifications: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: '예약 알림 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      },
      event_notifications: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: '이벤트 알림 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      },
      marketing_notifications: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: '마케팅 알림 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      },
      location_tracking_enabled: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: '위치 추적 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      },
      language_preference: (val) => {
        if (!['ko', 'en', 'ja', 'zh'].includes(val)) {
          return { valid: false, message: '지원되는 언어를 선택해주세요. (ko, en, ja, zh)' };
        }
        return { valid: true };
      },
      currency_preference: (val) => {
        if (!['KRW', 'USD', 'JPY', 'CNY'].includes(val)) {
          return { valid: false, message: '지원되는 통화를 선택해주세요. (KRW, USD, JPY, CNY)' };
        }
        return { valid: true };
      },
      theme_preference: (val) => {
        if (!['light', 'dark', 'auto'].includes(val)) {
          return { valid: false, message: '지원되는 테마를 선택해주세요. (light, dark, auto)' };
        }
        return { valid: true };
      },
      timezone: (val) => {
        if (!/^[A-Za-z_]+\/[A-Za-z_]+$/.test(val)) {
          return { valid: false, message: '올바른 시간대 형식을 입력해주세요. (예: Asia/Seoul)' };
        }
        return { valid: true };
      },
      date_format: (val) => {
        if (!['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'].includes(val)) {
          return { valid: false, message: '지원되는 날짜 형식을 선택해주세요.' };
        }
        return { valid: true };
      },
      time_format: (val) => {
        if (!['12h', '24h'].includes(val)) {
          return { valid: false, message: '지원되는 시간 형식을 선택해주세요. (12h, 24h)' };
        }
        return { valid: true };
      },
      email_notifications: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: '이메일 알림 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      },
      sms_notifications: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: 'SMS 알림 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      },
      sound_enabled: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: '소리 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      },
      vibration_enabled: (val) => {
        if (typeof val !== 'boolean') {
          return { valid: false, message: '진동 설정은 true 또는 false 값이어야 합니다.' };
        }
        return { valid: true };
      }
    };

    const validator = validationRules[field];
    if (!validator) {
      return { valid: false, message: '지원되지 않는 설정 필드입니다.' };
    }

    return validator(value);
  }

  /**
   * Log settings history
   */
  private async logSettingsHistory(
    userId: string, 
    oldSettings: UserSettings | null, 
    newSettings: UserSettings, 
    reason: string
  ): Promise<void> {
    try {
      if (!oldSettings) {
        // For new settings or reset, log all fields
        const historyEntries = Object.entries(newSettings)
          .filter(([key, value]) => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at')
          .map(([field, value]) => ({
            user_id: userId,
            field_name: field,
            old_value: null,
            new_value: value,
            change_reason: reason
          }));

        if (historyEntries.length > 0) {
          await this.supabase
            .from('settings_history')
            .insert(historyEntries);
        }
      } else {
        // For updates, log only changed fields
        const historyEntries = Object.entries(newSettings)
          .filter(([key, value]) => {
            if (key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') {
              return false;
            }
            return oldSettings[key as keyof UserSettings] !== value;
          })
          .map(([field, value]) => ({
            user_id: userId,
            field_name: field,
            old_value: oldSettings[field as keyof UserSettings],
            new_value: value,
            change_reason: reason
          }));

        if (historyEntries.length > 0) {
          await this.supabase
            .from('settings_history')
            .insert(historyEntries);
        }
      }
    } catch (error) {
      logger.error('Error logging settings history:', { userId, error });
      // Don't throw error as this is not critical
    }
  }
}

export const userProfileService = new UserProfileService(); 